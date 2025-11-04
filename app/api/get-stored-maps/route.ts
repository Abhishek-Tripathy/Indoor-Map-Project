import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function GET() {
  try {
    const client = new MongoClient(process.env.MONGODB_URI as string);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME); 
    
    const maps = await db.collection('maps')
      .find({})
      .sort({ _id: -1 })
      .toArray();
    
    await client.close();

    console.log(`Found ${maps.length} maps in database`); 

    return NextResponse.json({ maps });
  } catch (error) {
    console.error('Failed to fetch stored maps:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stored maps' },
      { status: 500 }
    );
  }
}