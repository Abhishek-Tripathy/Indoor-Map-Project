import { NextRequest, NextResponse } from 'next/server';
import { getLayoutsCollection } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params; 
    
    const layoutsCollection = await getLayoutsCollection();
    const layout = await layoutsCollection.findOne({
      _id: new ObjectId(id)
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
  } catch (error) {
    console.error('Layout fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layout' },
      { status: 500 }
    );
  }
}