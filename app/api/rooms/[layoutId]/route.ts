import { NextRequest, NextResponse } from 'next/server';
import { getRoomsCollection } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface RouteParams {
  params: Promise<{
    layoutId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { layoutId } = await params;

    if (!layoutId) {
      return NextResponse.json(
        { error: 'Layout ID is required' },
        { status: 400 }
      );
    }

    const roomsCollection = await getRoomsCollection();
    const roomDoc = await roomsCollection.findOne({
      layoutId: new ObjectId(layoutId)
    });

    if (!roomDoc) {
      return NextResponse.json({
        rooms: [],
        message: 'No rooms detected for this layout yet'
      });
    }

    return NextResponse.json({
      rooms: roomDoc.rooms
    });

  } catch (error) {
    console.error('Get rooms error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}