"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Room } from "@/types/rooms";

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom room icon
const roomIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwMGI4ZmYiIHN0cm9rZT0iIzAwNjZkZCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik0xMiA4VjE2IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTggMTJIMTYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const labeledRoomIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwMGZmMDAiIHN0cm9rZT0iIzAwYjAwMCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik03IDEyLjVMOS41IDE1TDE3IDgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface AdminLeafletComponentProps {
  geojsonData: any;
  rooms: Room[];
  layoutId: string;
  onRoomLabel: (roomId: string, name: string) => void;
  onRoomCreate: (center: [number, number]) => void;
}

export default function AdminLeafletComponent({
  geojsonData,
  rooms,
  layoutId,
  onRoomLabel,
  onRoomCreate,
}: AdminLeafletComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [mode, setMode] = useState<"view" | "add-room">("view");

  useEffect(() => {
    if (!mapContainer.current || !geojsonData) return;

    // Initialize map
    map.current = L.map(mapContainer.current, {
      crs: L.CRS.Simple,
      zoomControl: true,
      attributionControl: false,
    });

    // Scale coordinates function
    const scaleCoordinates = (coords: any): any => {
      if (Array.isArray(coords[0])) {
        return coords.map((coord: any) => scaleCoordinates(coord));
      } else if (coords.length >= 2 && typeof coords[0] === "number") {
        return [coords[0] / 1000, coords[1] / 1000];
      }
      return coords;
    };

    // Add original floor plan
    const allScaledCoords: [number, number][] = [];

    geojsonData.features.forEach((feature: any) => {
      if (!feature.geometry?.coordinates) return;

      const scaledCoords = scaleCoordinates(feature.geometry.coordinates);
      const layer = feature.properties?.layer;

      let color = "#999";
      let weight = 1;

      switch (layer) {
        case "WALL":
          color = "#333";
          weight = 4;
          break;
        case "DOOR":
          color = "#b38e59";
          weight = 3;
          break;
        case "STAIR":
          color = "#ff9999";
          weight = 2;
          break;
        case "FUR":
          color = "#ccc";
          weight = 1;
          break;
      }

      if (feature.geometry.type === "LineString") {
        scaledCoords.forEach((coord: [number, number]) =>
          allScaledCoords.push(coord)
        );
        L.polyline(scaledCoords, { color, weight, opacity: 0.7 }).addTo(
          map.current!
        );
      } else if (feature.geometry.type === "Polygon") {
        const polygonCoords = scaledCoords[0];
        polygonCoords.forEach((coord: [number, number]) =>
          allScaledCoords.push(coord)
        );
        L.polygon(polygonCoords, {
          color,
          weight,
          fillColor: layer === "STAIR" ? "#ff9999" : "transparent",
          fillOpacity: layer === "STAIR" ? 0.3 : 0,
        }).addTo(map.current!);
      }
    });

    // Add room markers
    rooms.forEach((room) => {
      const center: [number, number] = [
        room.center[0], // X coordinate as-is
        room.center[1], // Y coordinate as-is
      ];

      console.log(`Placing room ${room.roomId} at:`, center);

      const marker = L.marker(center, {
        icon: room.name ? labeledRoomIcon : roomIcon,
      }).addTo(map.current!);

      const popupContent = room.name
        ? `
        <div class="p-2 text-center">
          <strong>${room.name}</strong><br/>
          <small>Click to edit name</small>
        </div>
      `
        : `
        <div class="p-2 text-center">
          <strong>Unnamed Room</strong><br/>
          <small>Click to add name</small>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Add click handler for editing
      marker.on("click", () => {
        setSelectedRoom(room);
        setLabelInput(room.name || "");
      });
    });

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (mode === "add-room") {
        console.log("Map clicked at:", e.latlng);

        const center: [number, number] = [e.latlng.lng, e.latlng.lat];

        console.log("Center for new room:", center);
        onRoomCreate(center);
        setMode("view");
      }
    };

    map.current.on("click", handleMapClick);

    // Set map bounds
    if (allScaledCoords.length > 0) {
      const bounds = L.latLngBounds(allScaledCoords);
      map.current.fitBounds(bounds, { padding: [20, 20] });
    }

    // Listen for edit room messages from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "editRoom") {
        const room = rooms.find((r) => r.roomId === event.data.roomId);
        if (room) {
          setSelectedRoom(room);
          setLabelInput(room.name || "");
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      if (map.current) {
        map.current.remove();
      }
    };
  }, [geojsonData, rooms, mode, onRoomCreate]);

  const handleLabelSubmit = () => {
    if (selectedRoom && labelInput.trim()) {
      onRoomLabel(selectedRoom.roomId, labelInput.trim());
      setSelectedRoom(null);
      setLabelInput("");
    }
  };

  const startAddRoom = () => {
    setMode("add-room");
  };

  const cancelAddRoom = () => {
    setMode("view");
  };

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="h-full w-full bg-gray-100" />

      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg z-1000">
        <div className="space-y-2">
          <div className="font-semibold">Room Management</div>

          <button
            onClick={startAddRoom}
            disabled={mode === "add-room"}
            className={`w-full py-2 px-3 rounded text-sm ${
              mode === "add-room"
                ? "bg-green-600 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {mode === "add-room" ? "Click on Map to Add Room" : "Add New Room"}
          </button>

          {mode === "add-room" && (
            <button
              onClick={cancelAddRoom}
              className="w-full py-2 px-3 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
            >
              Cancel
            </button>
          )}

          <div className="text-xs text-gray-600 border-t pt-2">
            <div>Rooms: {rooms.length}</div>
            <div>Labeled: {rooms.filter((r) => r.name).length}</div>
          </div>
        </div>
      </div>

      {/* Labeling Modal */}
      {selectedRoom && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg z-1000 min-w-64">
          <h3 className="font-bold mb-2">
            {selectedRoom.name ? "Edit Room Name" : "Add Room Name"}
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            Room ID: {selectedRoom.roomId}
          </p>

          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Enter room name (e.g., Pharmacy)"
            className="w-full p-2 border border-gray-300 rounded mb-2"
            autoFocus
          />

          <div className="flex gap-2">
            <button
              onClick={handleLabelSubmit}
              className="flex-1 bg-blue-600 text-white py-1 px-3 rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={() => setSelectedRoom(null)}
              className="flex-1 bg-gray-500 text-white py-1 px-3 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mode Indicator */}
      {mode === "add-room" && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-1000">
          Click on the map to add a room marker
        </div>
      )}
    </div>
  );
}
