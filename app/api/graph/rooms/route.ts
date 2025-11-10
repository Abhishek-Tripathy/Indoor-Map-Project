import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getGraphCollection } from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const layoutId = searchParams.get("layoutId");
    if (!layoutId)
      return NextResponse.json({ error: "Layout ID required" }, { status: 400 });

    const graphCollection = await getGraphCollection();
    const db = (graphCollection as any).db || graphCollection; // supports either pattern
    const nodesCollection = db.collection("graph_nodes");

    const nodes = await nodesCollection
      .find({ layoutId: new ObjectId(layoutId) })
      .project({ name: 1 })
      .toArray();

    const rooms = nodes
      .map((n: any) => n.name)
      .filter(Boolean)
      .filter((name: string) => name !== "door"); // skip doors

    return NextResponse.json({
      success: true,
      rooms,
      count: rooms.length,
    });
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}
