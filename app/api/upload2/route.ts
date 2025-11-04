import { NextRequest, NextResponse } from "next/server";
import { convertToGeoJSON } from "@/lib/dxf-filter";
import { getLayoutsCollection } from "@/lib/mongodb";
import { DXFData, LayoutDocument } from "@/types/dxf";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { hospitalId, floorNumber, dxfData } = body;

    // Validate input
    if (!hospitalId || floorNumber === undefined || !dxfData) {
      return NextResponse.json(
        {
          error: "Missing required fields: hospitalId, floorNumber, or dxfData",
        },
        { status: 400 }
      );
    }

    console.log(
      `Processing DXF for hospital ${hospitalId}, floor ${floorNumber}`
    );

    // Step 1: Extract entities from DXF data
    const entities = (dxfData as DXFData).entities || dxfData;
    if (!Array.isArray(entities)) {
      return NextResponse.json(
        { error: "Invalid DXF data structure" },
        { status: 400 }
      );
    }

    // Step 2: Convert ALL entities to GeoJSON (no filtering)
    const geoJSON = convertToGeoJSON(entities);

    // Step 3: Get MongoDB collection
    const layoutsCollection = await getLayoutsCollection();

    // Step 4: Check if layout already exists for this hospital/floor
    const existingLayout = await layoutsCollection.findOne({
      hospitalId: parseInt(hospitalId),
      floorNumber: parseInt(floorNumber),
    });

    const metadata = {
      processedAt: new Date().toISOString(),
      originalEntities: entities.length,
      convertedEntities: geoJSON.features.length,
      conversionRate: ((geoJSON.features.length / entities.length) * 100).toFixed(1),
    };

    let result;
    if (existingLayout) {
      // Update existing layout
      result = await layoutsCollection.updateOne(
        {
          hospitalId: parseInt(hospitalId),
          floorNumber: parseInt(floorNumber),
        },
        {
          $set: {
            geojson: geoJSON,
            metadata: metadata,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      // Create new layout
      const layoutDoc: Omit<LayoutDocument, "_id"> = {
        hospitalId: parseInt(hospitalId),
        floorNumber: parseInt(floorNumber),
        geojson: geoJSON,
        metadata: metadata,
        createdAt: new Date(),
      };

      result = await layoutsCollection.insertOne(layoutDoc);
    }

    console.log(
      `Successfully processed DXF: ${geoJSON.features.length} features created`
    );

    return NextResponse.json({
      success: true,
      layoutId: existingLayout?._id || result.insertedId,
      stats: {
        originalEntities: entities.length,
        convertedEntities: geoJSON.features.length,
        conversionRate: metadata.conversionRate,
      },
      geojson: geoJSON,
    });
  } catch (error) {
    console.error("Upload processing error:", error);
    return NextResponse.json(
      { error: "Failed to process DXF file: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// Optional: GET handler to test the endpoint
export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    message: "Upload2 endpoint is working. Use POST to upload DXF data.",
    usage: {
      method: "POST",
      body: {
        hospitalId: "number",
        floorNumber: "number",
        dxfData: "DXF JSON object",
      },
    },
  });
}