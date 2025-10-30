import { NextResponse } from "next/server";
import DxfParser from "dxf-parser";
import { MongoClient } from "mongodb";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const textData = Buffer.from(arrayBuffer).toString("utf-8");

  const parser = new DxfParser();
  let parsedJson;

  try {
    parsedJson = parser.parseSync(textData);
  } catch (error) {
    console.error("DXF parse error:", error);
    return NextResponse.json({ error: "Failed to parse DXF" }, { status: 400 });
  }

  try {
    const client = new MongoClient(process.env.MONGODB_URI as string);
    await client.connect();
    const db = client.db();
    await db.collection("maps").insertOne({ parsedJson });
    await client.close();
  } catch (error) {
    console.error("DB error:", error);
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: parsedJson });
}
