import { NextRequest, NextResponse } from 'next/server';
import { getLayoutsCollection } from '@/lib/mongodb';


export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const hospitalId = searchParams.get('hospitalId');
    const floorNumber = searchParams.get('floorNumber');

    const layoutsCollection = await getLayoutsCollection();
    
    // If specific hospitalId and floorNumber provided, get single layout
    if (hospitalId && floorNumber) {
      const layout = await layoutsCollection.findOne({
        hospitalId: parseInt(hospitalId),
        floorNumber: parseInt(floorNumber)
      });

      if (!layout) {
        return NextResponse.json(
          { error: 'Layout not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        layout: layout
      });
    }
    
    // Otherwise, get all layouts
    const layouts = await layoutsCollection
      .find({})
      .sort({ hospitalId: 1, floorNumber: 1, createdAt: -1 })
      .toArray();

    return NextResponse.json({
      layouts: layouts
    });

  } catch (error) {
    console.error('Layout fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layouts' },
      { status: 500 }
    );
  }
}