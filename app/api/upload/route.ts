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
    
    // Analysis - check what we got
    console.log("\n===== DXF ANALYSIS =====");
    console.log("File name:", file.name);
    console.log("Total entities:", parsedJson.entities?.length || 0);
    
    // Collect all unique layers
    const layers = new Set<string>();
    const entityTypes = new Set<string>();
    
    parsedJson.entities?.forEach((e: any) => {
      if (e.layer) layers.add(e.layer);
      if (e.type) entityTypes.add(e.type);
    });
    
    console.log("\nAll layers found:", Array.from(layers));
    console.log("\nAll entity types found:", Array.from(entityTypes));
    
    // Count entities per layer
    const layerCounts: Record<string, number> = {};
    parsedJson.entities?.forEach((e: any) => {
      const layer = e.layer || 'NO_LAYER';
      layerCounts[layer] = (layerCounts[layer] || 0) + 1;
    });
    
    console.log("\nEntities per layer:");
    Object.entries(layerCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .forEach(([layer, count]) => {
        console.log(`  ${layer}: ${count}`);
      });
    
    // Count entities per type
    const typeCounts: Record<string, number> = {};
    parsedJson.entities?.forEach((e: any) => {
      const type = e.type || 'NO_TYPE';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    console.log("\nEntities per type:");
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    
    console.log("========================\n");
    
  } catch (error) {
    console.error("DXF parse error:", error);
    return NextResponse.json({ error: "Failed to parse DXF" }, { status: 400 });
  }
  
  try {
    const client = new MongoClient(process.env.MONGODB_URI as string);
    await client.connect();
    const db = client.db();
    await db.collection("maps").insertOne({ 
      parsedJson,
      fileName: file.name,
      uploadedAt: new Date()
    });
    await client.close();
  } catch (error) {
    console.error("DB error:", error);
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    totalEntities: parsedJson.entities?.length || 0,
    message: "Check server console for detailed analysis"
  });
}