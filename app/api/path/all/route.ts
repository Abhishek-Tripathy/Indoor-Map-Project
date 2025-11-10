import { NextRequest, NextResponse } from "next/server";
import { getWalkablePathsCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const layoutId = searchParams.get("layoutId");

    if (!layoutId) {
      return NextResponse.json({ error: "layoutId is required" }, { status: 400 });
    }

    const collection = await getWalkablePathsCollection();
    const paths = await collection
      .find({ layoutId: new ObjectId(layoutId) })
      .limit(1000)
      .toArray();

    return NextResponse.json({
      success: true,
      count: paths.length,
      paths,
    });
  } catch (err) {
    console.error("paths/all error:", err);
    return NextResponse.json({ error: "Failed to load paths" }, { status: 500 });
  }
}
