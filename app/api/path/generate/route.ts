import { NextRequest, NextResponse } from "next/server";
import { getLayoutsCollection, getWalkablePathsCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import * as turf from "@turf/turf";

export async function POST(req: NextRequest) {
  try {
    const { layoutId } = await req.json();
    if (!layoutId) {
      return NextResponse.json({ error: "layoutId is required" }, { status: 400 });
    }

    // 1) get layout
    const layoutsCol = await getLayoutsCollection();
    const layout = await layoutsCol.findOne({ _id: new ObjectId(layoutId) });
    if (!layout || !layout.geojson || !layout.geojson.features) {
      return NextResponse.json({ error: "layout not found or invalid geojson" }, { status: 404 });
    }

    const features = layout.geojson.features;
    // 2) get bbox of everything (no union, no difference)
    const fc = turf.featureCollection(features);
    const bbox = turf.bbox(fc); // [minX, minY, maxX, maxY]
    const [minX, minY, maxX, maxY] = bbox;
    const width = maxX - minX;
    const height = maxY - minY;

    // safety: if bbox is weird
    if (width <= 0 || height <= 0) {
      return NextResponse.json({ error: "invalid bbox from layout" }, { status: 400 });
    }

    // 3) generate simple grid paths (always works)
    // we'll make some vertical and horizontal lines across the floor
    const verticalCount = 20;
    const horizontalCount = 20;
    const pathLines: any[] = [];

    // vertical lines
    for (let i = 0; i < verticalCount; i++) {
      const x = minX + (width * i) / (verticalCount - 1);
      const line = turf.lineString([
        [x, minY],
        [x, maxY],
      ]);
      pathLines.push(line);
    }

    // horizontal lines
    for (let j = 0; j < horizontalCount; j++) {
      const y = minY + (height * j) / (horizontalCount - 1);
      const line = turf.lineString([
        [minX, y],
        [maxX, y],
      ]);
      pathLines.push(line);
    }

    // 4) store in DB
    const walkableCol = await getWalkablePathsCollection();
    await walkableCol.deleteMany({ layoutId: new ObjectId(layoutId) });

    const docs = pathLines.map((l) => ({
      layoutId: new ObjectId(layoutId),
      type: "walkable_path",
      line: l.geometry,
      createdAt: new Date(),
    }));

    if (docs.length > 0) {
      await walkableCol.insertMany(docs);
    }

    return NextResponse.json({
      success: true,
      layoutId,
      pathsStored: docs.length,
      bbox,
      message: `stored ${docs.length} simple paths`,
    });
  } catch (err) {
    console.error("paths/generate error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
