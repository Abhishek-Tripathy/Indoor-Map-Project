// import { NextRequest, NextResponse } from "next/server";
// import { MongoClient } from "mongodb";

// export async function GET(request: NextRequest) {
//   try {
//     const client = new MongoClient(process.env.MONGODB_URI as string);
//     await client.connect();
//     const db = client.db(process.env.MONGODB_DB_NAME);

//     const maps = await db.collection("maps").find({}).toArray();
//     await client.close();

//     const mtextAnalysis = maps.map((mapDoc) => {
//       const entities = mapDoc.parsedJson?.entities || [];
//       const mtextEntities = entities.filter((e: any) => e.type === "MTEXT");

//       console.log("\n=== RAW MTEXT ENTITIES ===");
//       // In /app/api/debug/mtext-raw/route.ts - update the logging:
//       mtextEntities.forEach((mtext: any, i: number) => {
//         console.log(`MTEXT ${i + 1}:`);
//         console.log("  All properties:", Object.keys(mtext));
//         console.log("  text:", mtext.text);
//         console.log("  string:", mtext.string);
//         console.log("  value:", mtext.value);
//         console.log("  content:", mtext.content);
//         console.log("  rawText:", mtext.rawText);
//         console.log("  extendedData:", mtext.extendedData);
//         console.log("  ---");
//       });

//       return {
//         mapId: mapDoc._id,
//         totalMTEXT: mtextEntities.length,
//         rawMTEXT: mtextEntities,
//       };
//     });

//     return NextResponse.json({ success: true, analysis: mtextAnalysis });
//   } catch (error) {
//     return NextResponse.json({ error: "Failed" }, { status: 500 });
//   }
// }


import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

export async function GET(request: NextRequest) {
  try {
    const client = new MongoClient(process.env.MONGODB_URI as string);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME);

    // Fetch all layout documents
    const layouts = await db.collection("layouts").find({}).toArray();
    await client.close();

    if (layouts.length === 0) {
      console.log("No layouts found in database.");
      return NextResponse.json({ error: "No layouts found" }, { status: 404 });
    }

    const analysisResults = layouts.map((layoutDoc, index) => {
      const features = layoutDoc.geojson?.features || [];
      console.log(`\n=== Layout ${index + 1} (${layoutDoc._id}) ===`);
      console.log(`Total features: ${features.length}`);

      const dxfTypeCounts: Record<string, number> = {};

      features.forEach((feature: any) => {
        const dxfType = feature.properties?.dxfType || "UNKNOWN";
        dxfTypeCounts[dxfType] = (dxfTypeCounts[dxfType] || 0) + 1;
      });

      // Print summary
      console.log("DXF Types found:");
      Object.entries(dxfTypeCounts).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      return {
        layoutId: layoutDoc._id,
        totalFeatures: features.length,
        dxfTypeCounts,
      };
    });

    return NextResponse.json({
      success: true,
      totalLayouts: layouts.length,
      analysis: analysisResults,
    });
  } catch (error) {
    console.error("DXF Type Analysis Error:", error);
    return NextResponse.json(
      { error: "Analysis failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

