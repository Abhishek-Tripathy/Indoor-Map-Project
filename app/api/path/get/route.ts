import { NextRequest, NextResponse } from "next/server";
import { getWalkablePathsCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const layoutId = searchParams.get("layoutId");
  if (!layoutId) return NextResponse.json({ error: "layoutId required" }, { status: 400 });

  const col = await getWalkablePathsCollection();
  const paths = await col.find({ layoutId: new ObjectId(layoutId) }).toArray();
  return NextResponse.json({ success: true, paths });
}
