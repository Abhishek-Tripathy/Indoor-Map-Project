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


// Only MTEXT OBJECTS

// import { NextRequest, NextResponse } from "next/server";
// import { MongoClient } from "mongodb";

// export async function GET(request: NextRequest) {
//   try {
//     const client = new MongoClient(process.env.MONGODB_URI as string);
//     await client.connect();
//     const db = client.db(process.env.MONGODB_DB_NAME);

//     // Fetch all layout documents
//     const layouts = await db.collection("layouts").find({}).toArray();
//     await client.close();

//     if (layouts.length === 0) {
//       console.log("❌ No layouts found in database.");
//       return NextResponse.json({ error: "No layouts found" }, { status: 404 });
//     }

//     console.log("\n=== MTEXT Feature Inspection ===");

//     const analysisResults = layouts.map((layoutDoc, index) => {
//       const features = layoutDoc.geojson?.features || [];

//       // Filter only MTEXT features
//       const mtextFeatures = features.filter(
//         (f: any) => f.properties?.dxfType === "MTEXT"
//       );

//       console.log(`\n📄 Layout ${index + 1} (${layoutDoc._id})`);
//       console.log(`Total MTEXT features: ${mtextFeatures.length}`);

//       // Log each MTEXT feature in detail
//       mtextFeatures.forEach((feature: any, i: number) => {
//         console.log(`\n🧩 MTEXT Feature ${i + 1}:`);
//         console.log("Properties:", feature.properties);
//         console.log("Geometry:", feature.geometry);
//         console.log("------------------------------------");
//       });

//       return {
//         layoutId: layoutDoc._id,
//         totalMTEXT: mtextFeatures.length,
//       };
//     });

//     return NextResponse.json({
//       success: true,
//       totalLayouts: layouts.length,
//       analysis: analysisResults,
//     });
//   } catch (error) {
//     console.error("MTEXT inspection error:", error);
//     return NextResponse.json(
//       { error: "Analysis failed: " + (error as Error).message },
//       { status: 500 }
//     );
//   }
// }


import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import * as turf from "@turf/turf";

export async function GET(req: NextRequest) {
  try {
    const client = new MongoClient(process.env.MONGODB_URI as string);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME);
    const layout = await db.collection("layouts").findOne({});
    await client.close();

    if (!layout) return NextResponse.json({ error: "No layout found" });

    const geojson = layout.geojson;
    const walls = geojson.features.filter((f: any) =>
      (f.properties?.layer || "").toUpperCase().includes("WALL")
    );

    const wallCollection = turf.featureCollection(walls);
    const wallBBox = turf.bbox(wallCollection);
    const wallBBoxPoly = turf.bboxPolygon(wallBBox);
    const wallArea = turf.area(wallBBoxPoly);

    return NextResponse.json({
      wallBBox,
      wallArea,
      width: wallBBox[2] - wallBBox[0],
      height: wallBBox[3] - wallBBox[1],
      wallCount: walls.length,
      note: "Use this bbox as your grid or graph limit, not the entire drawing bbox."
    });
  } catch (err) {
    console.error("active-region error:", err);
    return NextResponse.json({ error: (err as Error).message });
  }
}
