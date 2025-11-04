import { NextRequest, NextResponse } from 'next/server';
import { getLayoutsCollection, getRoomsCollection } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { layoutId } = await request.json();

    if (!layoutId) {
      return NextResponse.json({ error: 'Layout ID required' }, { status: 400 });
    }

    const layoutsCollection = await getLayoutsCollection();
    const layout = await layoutsCollection.findOne({
      _id: new ObjectId(layoutId)
    });

    if (!layout) {
      return NextResponse.json({ error: 'Layout not found' }, { status: 404 });
    }

    // Instead of auto-detection, just return an empty array
    // Admin will manually create rooms by clicking on the map
    const emptyRooms: any[] = [];

    // Store empty rooms (admin will add them manually)
    const roomsCollection = await getRoomsCollection();
    await roomsCollection.updateOne(
      { layoutId: new ObjectId(layoutId) },
      { 
        $set: { 
          layoutId: new ObjectId(layoutId),
          rooms: emptyRooms,
          detectedAt: new Date()
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      rooms: emptyRooms,
      count: 0,
      message: "Ready for manual room creation - click 'Add Room' on the map"
    });

  } catch (error) {
    console.error('Room detection error:', error);
    return NextResponse.json(
      { error: 'Room detection failed' },
      { status: 500 }
    );
  }
}