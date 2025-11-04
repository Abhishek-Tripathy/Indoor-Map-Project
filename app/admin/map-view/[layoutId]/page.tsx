"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLeafletMap from "@/components/AdminLeafletMap";
import { Room, RoomDetectionResponse } from "@/types/rooms";

interface Layout {
  _id: string;
  hospitalId: number;
  floorNumber: number;
  geojson: any;
  metadata: any;
}

export default function AdminMapViewPage() {
  const params = useParams();
  const router = useRouter();
  const layoutId = params.layoutId as string;

  const [layout, setLayout] = useState<Layout | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (layoutId) {
      loadLayoutAndRooms();
    }
  }, [layoutId]);

  const loadLayoutAndRooms = async () => {
    try {
      setLoading(true);

      // Load layout
      const layoutResponse = await fetch(`/api/layouts2/${layoutId}`);
      const layoutData = await layoutResponse.json();

      if (!layoutData.layout) {
        setError("Layout not found");
        return;
      }
      setLayout(layoutData.layout);

      // Load rooms
      await loadRooms();
    } catch (error) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async () => {
    try {
      const response = await fetch(`/api/rooms/${layoutId}`);
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  };

  const detectRooms = async () => {
    try {
      setDetecting(true);
      const response = await fetch("/api/rooms/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutId }),
      });

      const data: RoomDetectionResponse = await response.json();

      if (data.success) {
        setRooms(data.rooms);
        alert(`Detected ${data.count} rooms!`);
      } else {
        alert("Room detection failed");
      }
    } catch (error) {
      alert("Room detection failed");
    } finally {
      setDetecting(false);
    }
  };

  const handleRoomLabel = async (roomId: string, name: string) => {
    try {
      const response = await fetch("/api/rooms/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutId, roomId, name }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setRooms((prev) =>
          prev.map((room) =>
            room.roomId === roomId ? { ...room, name } : room
          )
        );
      } else {
        alert("Failed to save room name");
      }
    } catch (error) {
      alert("Failed to save room name");
    }
  };

  const handleRoomCreate = async (center: [number, number]) => {
    try {
      // Find which room area this point falls into
      const clickedRoom = findRoomAtPoint(center, layout.geojson);

      if (!clickedRoom) {
        alert("Please click inside a room area (between walls)");
        return;
      }

      const roomId = `room_${Date.now()}`;

      const newRoom: Room = {
        roomId: roomId,
        name: "",
        bounds: clickedRoom.bounds,
        center: clickedRoom.center,
        area: clickedRoom.area,
        type: "room",
        source: "manual",
        createdAt: new Date(),
      };

      // Add to local state immediately
      setRooms((prev) => [...prev, newRoom]);

      // Save to database
      const response = await fetch("/api/rooms/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layoutId,
          roomId: roomId,
          name: "",
          center: clickedRoom.center,
          bounds: clickedRoom.bounds,
          area: clickedRoom.area,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save room");
      }

      alert("Room created at " + clickedRoom.center.join(", "));
    } catch (error) {
      console.error("Failed to create room:", error);
      alert("Failed to create room");
    }
  };

  // Function to detect which room area contains the clicked point
  const findRoomAtPoint = (point: [number, number], geojson: any) => {
    // Simple room detection - find the largest wall-enclosed area containing the point
    const walls = geojson.features.filter(
      (f: any) =>
        f.properties?.layer?.includes("WALL") &&
        f.geometry.type === "LineString"
    );

    // Find approximate room boundaries around the point
    const roomBounds = findRoomBoundsAroundPoint(point, walls);

    if (roomBounds) {
      return {
        center: [
          (roomBounds.minX + roomBounds.maxX) / 2,
          (roomBounds.minY + roomBounds.maxY) / 2,
        ],
        bounds: roomBounds,
        area:
          (roomBounds.maxX - roomBounds.minX) *
          (roomBounds.maxY - roomBounds.minY),
      };
    }

    return null;
  };

  const findRoomBoundsAroundPoint = (point: [number, number], walls: any[]) => {
    // Find walls around the point to determine room boundaries
    let minX = point[0] - 5000; // Search radius
    let maxX = point[0] + 5000;
    let minY = point[1] - 5000;
    let maxY = point[1] + 5000;

    // Adjust boundaries based on nearby walls
    walls.forEach((wall) => {
      wall.geometry.coordinates.forEach((coord: number[]) => {
        const distance = Math.sqrt(
          Math.pow(coord[0] - point[0], 2) + Math.pow(coord[1] - point[1], 2)
        );

        if (distance < 5000) {
          // Within search radius
          if (Math.abs(coord[0] - point[0]) < Math.abs(minX - point[0]))
            minX = coord[0];
          if (Math.abs(coord[0] - point[0]) < Math.abs(maxX - point[0]))
            maxX = coord[0];
          if (Math.abs(coord[1] - point[1]) < Math.abs(minY - point[1]))
            minY = coord[1];
          if (Math.abs(coord[1] - point[1]) < Math.abs(maxY - point[1]))
            maxY = coord[1];
        }
      });
    });

    // Ensure we found reasonable boundaries
    if (maxX - minX > 1000 && maxY - minY > 1000) {
      return { minX, minY, maxX, maxY };
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading admin interface...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">
            Hospital {layout?.hospitalId} - Floor {layout?.floorNumber}
          </h1>
          <p className="text-sm text-gray-600">
            {rooms.length} rooms detected • {rooms.filter((r) => r.name).length}{" "}
            labeled
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={detectRooms}
            disabled={detecting}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {detecting ? "Detecting..." : "Detect Rooms"}
          </button>

          <button
            onClick={() => router.push("/layouts-list")}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Back to List
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <AdminLeafletMap
          geojsonData={layout?.geojson}
          rooms={rooms}
          layoutId={layoutId}
          onRoomLabel={handleRoomLabel}
          onRoomCreate={handleRoomCreate}
        />
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 border-t px-4 py-2 text-sm">
        <strong>Instructions:</strong> Click "Detect Rooms" first, then click on
        the blue (+) icons to add room names.
      </div>
    </div>
  );
}
