import { NextRequest, NextResponse } from "next/server";
import { getLayoutsCollection, getGraphCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import * as turf from "@turf/turf";

export async function POST(request: NextRequest) {
  try {
    const { layoutId } = await request.json();
    if (!layoutId)
      return NextResponse.json(
        { error: "Layout ID required" },
        { status: 400 }
      );

    const layoutsCollection = await getLayoutsCollection();
    const layout = await layoutsCollection.findOne({
      _id: new ObjectId(layoutId),
    });
    if (!layout)
      return NextResponse.json({ error: "Layout not found" }, { status: 404 });

    console.log("Generating graph for layout:", layoutId);

    const graph = generateNavigationGraph(layout.geojson); 

    const graphCollection = await getGraphCollection();

    const db = (graphCollection as any).db;
    if (!db) {
      if (typeof (graphCollection as any).collection === "function") {
        const dbDirect = graphCollection as any;
        await storeGraphInDb(dbDirect, layoutId, graph);
      } else {
        throw new Error(
          "Unable to obtain database instance from getGraphCollection()"
        );
      }
    } else {
      await storeGraphInDb(db, layoutId, graph, graphCollection);
    }

    return NextResponse.json({
      success: true,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      message: `Graph generated with ${graph.nodes.length} nodes and ${graph.edges.length} edges (stored)`,
    });
  } catch (error) {
    console.error("Graph generation error:", error);
    return NextResponse.json(
      { error: "Graph generation failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}
async function storeGraphInDb(
  db: any,
  layoutId: string,
  graph: any,
  graphCollectionOptional?: any
) {
  const nodesCollection = db.collection("graph_nodes");
  const edgesCollection = db.collection("graph_edges");
  const metaCollection = graphCollectionOptional || db.collection("graph");

  // Clean old entries for this layout
  await nodesCollection.deleteMany({ layoutId: new ObjectId(layoutId) });
  await edgesCollection.deleteMany({ layoutId: new ObjectId(layoutId) });

  // Prepare docs with layoutId
  const nodeDocs = graph.nodes.map((n: any) => ({
    ...n,
    layoutId: new ObjectId(layoutId),
  }));
  const edgeDocs = graph.edges.map((e: any) => ({
    ...e,
    layoutId: new ObjectId(layoutId),
  }));

  // Insert in chunks
  const insertChunks = async (
    collection: any,
    docs: any[],
    chunkSize = 5000
  ) => {
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      if (chunk.length) await collection.insertMany(chunk);
    }
  };

  if (nodeDocs.length) await insertChunks(nodesCollection, nodeDocs);
  if (edgeDocs.length) await insertChunks(edgesCollection, edgeDocs);

  // Save metadata (one small document)
  await metaCollection.updateOne(
    { layoutId: new ObjectId(layoutId) },
    {
      $set: {
        layoutId: new ObjectId(layoutId),
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        generatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  console.log(
    `✅ Stored graph in DB: ${graph.nodes.length} nodes, ${graph.edges.length} edges`
  );
}

function generateNavigationGraph(geojson: any) {
  const features = geojson.features || [];

  const bufferTolerance = 0.2; // Wall buffer
  const maxConnectionDistance = 120; // Max edge distance
  const cellSize = 10; // Partition size

  const mtextFeatures = features.filter(
    (f: any) =>
      f.properties?.dxfType === "MTEXT" &&
      f.geometry?.type === "Point" &&
      (f.properties?.text || f.properties?.value)
  );

  const doorFeatures = features.filter(
    (f: any) =>
      (f.properties?.layer || "").toUpperCase().includes("DOOR") ||
      (f.properties?.layer || "").toUpperCase().includes("WINDOW")
  );

  const wallFeatures = features.filter(
    (f: any) =>
      (f.properties?.layer || "").toUpperCase().includes("WALL") &&
      f.geometry?.type === "LineString"
  );

  console.log(
    `Found ${mtextFeatures.length} MTEXT, ${doorFeatures.length} DOORS, ${wallFeatures.length} WALLS`
  );

  // === Helpers ===
  const cleanText = (raw: string) =>
    (raw || "").replace(/\{\\f[^}]*\}/g, "").trim();

  const nodeMap = new Map<string, any>();
  const pushNode = (coord: number[], meta: any) => {
    const key = `${coord[0].toFixed(4)},${coord[1].toFixed(4)}`;
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: `node_${nodeMap.size}`,
        name: meta?.name || null,
        coordinates: coord,
        meta,
      });
    }
  };

  for (const f of mtextFeatures) {
    const coord = f.geometry.coordinates;
    const label = cleanText(f.properties?.text || f.properties?.value || "");
    pushNode(coord, { name: label, source: "mtext" });
  }

  for (const f of doorFeatures) {
    let coord: number[] | null = null;
    if (f.geometry.type === "Point") coord = f.geometry.coordinates;
    else if (f.geometry.type === "LineString") {
      const coords = f.geometry.coordinates;
      coord = coords[Math.floor(coords.length / 2)];
    }
    if (coord) pushNode(coord, { name: "door", source: "door" });
  }

  const nodes = Array.from(nodeMap.values());
  console.log(`Total nodes: ${nodes.length}`);

  const bufferedWalls: any[] = [];
  for (let i = 0; i < wallFeatures.length; i += 10) {
    try {
      const w = wallFeatures[i];
      const buffered = turf.buffer(w, bufferTolerance, { units: "meters" });
      const bbox = turf.bbox(w);
      bufferedWalls.push({ buffered, bbox });
    } catch {}
  }

  const bboxIntersects = (a: number[], b: number[]) =>
    !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

  const grid: Record<string, any[]> = {};
  const cellKey = (coord: number[]) => {
    const cx = Math.floor(coord[0] / cellSize);
    const cy = Math.floor(coord[1] / cellSize);
    return `${cx},${cy}`;
  };

  for (const node of nodes) {
    const key = cellKey(node.coordinates);
    if (!grid[key]) grid[key] = [];
    grid[key].push(node);
  }

  const nearbyNodes = (node: any): any[] => {
    const [x, y] = node.coordinates;
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    const result: any[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        if (grid[key]) result.push(...grid[key]);
      }
    }
    return result;
  };

  // === Build edges ===
  const edges: any[] = [];

  for (const A of nodes) {
    const neighbors = nearbyNodes(A);
    for (const B of neighbors) {
      if (A.id === B.id) continue;

      const dx = A.coordinates[0] - B.coordinates[0];
      const dy = A.coordinates[1] - B.coordinates[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0 || dist > maxConnectionDistance) continue;

      const line = turf.lineString([A.coordinates, B.coordinates]);
      const lineBbox = turf.bbox(line);

      let blocked = false;
      for (const bw of bufferedWalls) {
        if (!bboxIntersects(lineBbox, bw.bbox)) continue;
        try {
          if (turf.booleanIntersects(line, bw.buffered)) {
            blocked = true;
            break;
          }
        } catch {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        edges.push({
          id: `edge_${A.id}_${B.id}`,
          from: A.id,
          to: B.id,
          weight: dist,
          bidirectional: true,
        });
      }
    }
  }

  console.log(`✅ Graph done: ${nodes.length} nodes, ${edges.length} edges`);

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.name,
      coordinates: n.coordinates,
      meta: n.meta,
    })),
    edges,
  };
}

function calculateDistance(coord1: number[], coord2: number[]): number {
  const dx = coord1[0] - coord2[0];
  const dy = coord1[1] - coord2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function cleanText(raw: string): string {
  return raw.replace(/\{\\f[^}]*\}/g, "").trim();
}
