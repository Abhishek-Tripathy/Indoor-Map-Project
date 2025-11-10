import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getGraphCollection } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const { layoutId, fromRoom, toRoom } = await request.json();
    if (!layoutId || !fromRoom || !toRoom)
      return NextResponse.json(
        { error: "Layout ID, fromRoom, toRoom required" },
        { status: 400 }
      );

    const graphCollection = await getGraphCollection();
    const db = (graphCollection as any).db || graphCollection;
    const nodesCollection = db.collection("graph_nodes");
    const edgesCollection = db.collection("graph_edges");

    const nodes = await nodesCollection
      .find({ layoutId: new ObjectId(layoutId) })
      .toArray();
    const edges = await edgesCollection
      .find({ layoutId: new ObjectId(layoutId) })
      .toArray();

    const fromNode = nodes.find(
      (n: any) =>
        n.name?.toLowerCase().includes(fromRoom.toLowerCase()) ||
        fromRoom.toLowerCase().includes(n.name?.toLowerCase())
    );
    const toNode = nodes.find(
      (n: any) =>
        n.name?.toLowerCase().includes(toRoom.toLowerCase()) ||
        toRoom.toLowerCase().includes(n.name?.toLowerCase())
    );

    if (!fromNode || !toNode)
      return NextResponse.json(
        { error: "Could not find nodes for given rooms" },
        { status: 404 }
      );

    // Build adjacency list
    const adj: Record<string, { id: string; weight: number }[]> = {};
    edges.forEach((e: any) => {
      if (!adj[e.from]) adj[e.from] = [];
      if (!adj[e.to]) adj[e.to] = [];
      adj[e.from].push({ id: e.to, weight: e.weight });
      adj[e.to].push({ id: e.from, weight: e.weight });
    });

    const path = dijkstra(adj, fromNode.id, toNode.id);
    if (!path)
      return NextResponse.json({ error: "No path found" }, { status: 404 });

    const coords = path.map(
      (nodeId) => nodes.find((n: any) => n.id === nodeId)?.coordinates
    );

    return NextResponse.json({
      success: true,
      from: fromNode.name,
      to: toNode.name,
      steps: path.length,
      distance: calcPathLength(coords),
      coordinates: coords,
    });
  } catch (error) {
    console.error("Pathfinding error:", error);
    return NextResponse.json(
      { error: "Pathfinding failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

function dijkstra(
  adj: Record<string, { id: string; weight: number }[]>,
  start: string,
  end: string
) {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const queue = new Set(Object.keys(adj));

  Object.keys(adj).forEach((k) => (dist[k] = Infinity));
  dist[start] = 0;

  while (queue.size) {
    const u = [...queue].reduce((a, b) =>
      dist[a] < dist[b] ? a : b
    );

    if (u === end) break;
    queue.delete(u);

    adj[u]?.forEach(({ id: v, weight }) => {
      const alt = dist[u] + weight;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    });
  }

  const path: string[] = [];
  let u: string | undefined = end;
  while (u) {
    path.unshift(u);
    u = prev[u] || undefined;
  }
  return path[0] === start ? path : null;
}

function calcPathLength(coords: number[][]) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    const [x1, y1] = coords[i - 1];
    const [x2, y2] = coords[i];
    d += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }
  return d;
}
