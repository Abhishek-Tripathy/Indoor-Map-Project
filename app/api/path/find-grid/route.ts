// /app/api/path/find-grid/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";
import * as turf from "@turf/turf";
import PF from "pathfinding";

const MONGO_URI = process.env.MONGODB_URI as string;
const DB_NAME = process.env.MONGODB_DB_NAME as string;

async function getLayout(layoutId: string) {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const layout = await db
    .collection("layouts")
    .findOne({ _id: new ObjectId(layoutId) });
  await client.close();
  return layout;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const layoutId = body.layoutId;
    const fromRoom = body.fromRoom;
    const toRoom = body.toRoom;
    let requestedCellSize = body.cellSize; // optional override

    if (!layoutId || !fromRoom || !toRoom) {
      return NextResponse.json(
        { error: "layoutId, fromRoom, toRoom required" },
        { status: 400 }
      );
    }

    const layout = await getLayout(layoutId);
    if (!layout)
      return NextResponse.json({ error: "Layout not found" }, { status: 404 });

    const features = layout.geojson?.features || [];

    // --- collect walls and texts
    const wallFeatures = features.filter(
      (f: any) =>
        (f.properties?.layer || "").toUpperCase().includes("WALL") &&
        (f.geometry?.type === "LineString" || f.geometry?.type === "Polygon")
    );
    const textFeatures = features.filter(
      (f: any) =>
        f.properties?.dxfType === "MTEXT" && f.geometry?.type === "Point"
    );

    if (wallFeatures.length === 0) {
      return NextResponse.json(
        { error: "No wall features found in layout" },
        { status: 400 }
      );
    }
    if (textFeatures.length === 0) {
      return NextResponse.json(
        { error: "No MTEXT points found (rooms)" },
        { status: 400 }
      );
    }

    // --- active wall bbox (use only this region)
    const wallCollection = turf.featureCollection(wallFeatures);
    const wallBBox = turf.bbox(wallCollection); // [minX, minY, maxX, maxY]
    const width = wallBBox[2] - wallBBox[0];
    const height = wallBBox[3] - wallBBox[1];
    const area = Math.max(1, width * height);

    // --- choose cell size automatically if not provided
    // targetCells ~ <= 60k for reasonable performance on laptop
    const targetMaxCells = 60000;
    let cellSize =
      typeof requestedCellSize === "number" && requestedCellSize > 0
        ? requestedCellSize
        : Math.max(0.25, Math.sqrt(area / targetMaxCells)); // at least 0.25 units

    // clamp to sensible ranges
    if (cellSize < 0.25) cellSize = 0.25;
    if (cellSize > Math.max(width, height)) cellSize = Math.max(width, height);

    const xCount = Math.max(2, Math.round(width / cellSize));
    const yCount = Math.max(2, Math.round(height / cellSize));
    const totalCells = xCount * yCount;

    // safety check
    const HARD_MAX_CELLS = 300000;
    if (totalCells > HARD_MAX_CELLS) {
      return NextResponse.json(
        {
          error: `Grid too large (${totalCells} cells). Try increasing cellSize (example: 1 or 2).`,
        },
        { status: 400 }
      );
    }

    console.log(
      `[path-find-grid] layout ${layoutId} bbox=${wallBBox.map((n) =>
        n.toFixed(2)
      )} width=${width.toFixed(2)} height=${height.toFixed(
        2
      )} cellSize=${cellSize} grid=${xCount}x${yCount}=${totalCells}cells`
    );

    // --- build buffered walls (one polygon per wall) for fast checking
    // sample/warn: we will buffer all wall features but that's OK for active bbox small area
    const wallBuffers = wallFeatures
      .map((w) => {
        try {
          const buf = turf.buffer(w, 0.25, { units: "meters" }); // use 0.25; adjust if needed
          return { buffered: buf, bbox: turf.bbox(w) };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean) as { buffered: any; bbox: number[] }[];

    const bboxIntersects = (a: number[], b: number[]) =>
      !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

    // --- Build matrix: 0 = walkable, 1 = blocked
    const matrix: number[][] = Array.from({ length: yCount }, () =>
      Array(xCount).fill(0)
    );

    // For each cell center, test against buffered walls
    for (let yi = 0; yi < yCount; yi++) {
      const py = wallBBox[1] + (yi + 0.5) * (height / yCount);
      for (let xi = 0; xi < xCount; xi++) {
        const px = wallBBox[0] + (xi + 0.5) * (width / xCount);
        const pt = turf.point([px, py]);

        // quick cull by bbox for each buffered wall, then precise booleanPointInPolygon on buffered polygon
        let blocked = false;
        for (const wb of wallBuffers) {
          if (!bboxIntersects([px, py, px, py], wb.bbox)) {
            // not in bbox, skip
            continue;
          }
          try {
            if (turf.booleanPointInPolygon(pt, wb.buffered)) {
              blocked = true;
              break;
            }
          } catch {
            // treat as blocked on error
            blocked = true;
            break;
          }
        }
        matrix[yi][xi] = blocked ? 1 : 0;
      }
    }

    // --- find start/end grid indices from MTEXT names
    const findTextByName = (name: string) => {
      const target = name.toLowerCase();
      return textFeatures.find((t: any) => {
        const v = (
          t.properties?.text ||
          t.properties?.value ||
          t.properties?.string ||
          ""
        )
          .toString()
          .toLowerCase();
        return v.includes(target);
      });
    };

    const fromFeature = findTextByName(fromRoom);
    const toFeature = findTextByName(toRoom);
    if (!fromFeature || !toFeature) {
      return NextResponse.json(
        { error: "Could not find MTEXT features for fromRoom/toRoom" },
        { status: 404 }
      );
    }

    const coordToIndex = (coord: number[]) => {
      const xRel = (coord[0] - wallBBox[0]) / width;
      const yRel = (coord[1] - wallBBox[1]) / height;
      const xi = Math.max(0, Math.min(xCount - 1, Math.floor(xRel * xCount)));
      const yi = Math.max(0, Math.min(yCount - 1, Math.floor(yRel * yCount)));
      return [xi, yi];
    };

    const [startX, startY] = coordToIndex(fromFeature.geometry.coordinates);
    const [endX, endY] = coordToIndex(toFeature.geometry.coordinates);

    // If start or end is blocked, try to nudge to nearest free neighbor
    const findNearestFree = (sx: number, sy: number, maxRadius = 6) => {
      if (matrix[sy][sx] === 0) return [sx, sy];
      for (let r = 1; r <= maxRadius; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = sx + dx;
            const ny = sy + dy;
            if (nx < 0 || ny < 0 || nx >= xCount || ny >= yCount) continue;
            if (matrix[ny][nx] === 0) return [nx, ny];
          }
        }
      }
      return null;
    };

    const startCell = findNearestFree(startX, startY);
    const endCell = findNearestFree(endX, endY);
    if (!startCell || !endCell) {
      return NextResponse.json(
        { error: "Start or end point is fully blocked by walls" },
        { status: 400 }
      );
    }

    // --- Run A* using pathfinding library
    const pfGrid = new PF.Grid(matrix);
    const finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: false,
    });
    const rawPath = finder.findPath(
      startCell[0],
      startCell[1],
      endCell[0],
      endCell[1],
      pfGrid
    );

    if (!rawPath || rawPath.length === 0) {
      return NextResponse.json(
        { error: "No walkable path found" },
        { status: 404 }
      );
    }

    // convert path indices to coordinates (use cell center mapping consistent above)
    const pathCoords = rawPath.map(([xi, yi]) => {
      const px = wallBBox[0] + (xi + 0.5) * (width / xCount);
      const py = wallBBox[1] + (yi + 0.5) * (height / yCount);
      return [px, py];
    });

    const pathLine = turf.lineString(pathCoords);

    // --- Compute total path distance
    let totalDistance = 0;
    for (let i = 1; i < pathCoords.length; i++) {
      const [x1, y1] = pathCoords[i - 1];
      const [x2, y2] = pathCoords[i];
      totalDistance += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    // --- Return in format the map expects
    return NextResponse.json({
      success: true,
      from: fromRoom,
      to: toRoom,
      coordinates: pathCoords, // renamed from pathCoords
      steps: rawPath.length,
      distance: totalDistance,
      cellSize,
    });
  } catch (err) {
    console.error("path/find-grid error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
