import { NextRequest, NextResponse } from "next/server";
import { getRoomsCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  try {
    const {
      layoutId,
      roomId,
      name = "",
      center = [0, 0],
      bounds,
      area,
    } = await request.json();

    if (!layoutId || !roomId) {
      return NextResponse.json(
        { error: "Layout ID and Room ID are required" },
        { status: 400 }
      );
    }

    const roomsCollection = await getRoomsCollection();

    // Check if room already exists
    const existingDoc = await roomsCollection.findOne({
      layoutId: new ObjectId(layoutId),
    });

    if (existingDoc) {
      // Update existing room
      const roomExists = existingDoc.rooms.some(
        (r: any) => r.roomId === roomId
      );

      if (roomExists) {
        // Update room name
        const result = await roomsCollection.updateOne(
          {
            layoutId: new ObjectId(layoutId),
            "rooms.roomId": roomId,
          },
          {
            $set: {
              "rooms.$.name": name,
              "rooms.$.labeledAt": new Date(),
              "rooms.$.labeledBy": "admin",
            },
          }
        );

        if (result.modifiedCount === 0) {
          return NextResponse.json(
            { error: "Room not found or update failed" },
            { status: 404 }
          );
        }
      } else {
        // Add new room to existing document
        const newRoom = {
          roomId,
          name,
          center: center, // Use the actual center coordinates
          bounds: bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 },
          area: area || 0,
          type: "room",
          source: "manual",
          createdAt: new Date(),
        };

        await roomsCollection.updateOne(
          { layoutId: new ObjectId(layoutId) },
          { $push: { rooms: newRoom } }
        );
      }
    } else {
      // Create new document with this room
      const newRoom = {
        roomId,
        name,
        center: [0, 0],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        area: 0,
        type: "room",
        source: "manual",
        createdAt: new Date(),
      };

      await roomsCollection.insertOne({
        layoutId: new ObjectId(layoutId),
        rooms: [newRoom],
        detectedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: name
        ? `Room ${roomId} labeled as "${name}"`
        : `Room ${roomId} created`,
    });
  } catch (error) {
    console.error("Room labeling error:", error);
    return NextResponse.json(
      { error: "Room labeling failed" },
      { status: 500 }
    );
  }
}