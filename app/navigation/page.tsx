"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Layout {
  _id: string;
  hospitalId: number;
  floorNumber: number;
  metadata: any;
}

export default function NavigationPage() {
  const router = useRouter();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<string>("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [fromRoom, setFromRoom] = useState<string>("");
  const [toRoom, setToRoom] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [pathResult, setPathResult] = useState<any>(null);

  useEffect(() => {
    fetchLayouts();
  }, []);

  const fetchLayouts = async () => {
    try {
      const response = await fetch("/api/layouts2");
      const data = await response.json();
      setLayouts(data.layouts || []);
    } catch (error) {
      console.error("Failed to fetch layouts:", error);
    }
  };

  const fetchRooms = async (layoutId: string) => {
    try {
      const response = await fetch(`/api/graph/rooms?layoutId=${layoutId}`);
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  };

  const generateGraph = async () => {
    if (!selectedLayout) return;

    setLoading(true);
    try {
      const response = await fetch("/api/graph/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutId: selectedLayout }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`Graph generated: ${result.message}`);
        fetchRooms(selectedLayout);
      } else {
        alert("Graph generation failed");
      }
    } catch (error) {
      alert("Graph generation failed");
    } finally {
      setLoading(false);
    }
  };

  const findPath = async () => {
    if (!selectedLayout || !fromRoom || !toRoom) return;

    setLoading(true);
    try {
      const response = await fetch("/api/path/find-grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layoutId: selectedLayout,
          fromRoom,
          toRoom,
        }),
      });

      const result = await response.json();
      console.log("🔥 Pathfinding API Response:", result);

      if (
        result.success &&
        result.coordinates &&
        result.coordinates.length > 1
      ) {
        setPathResult(result);

        // ✅ Use absolute URL to ensure new tab opens correctly
        const pathParam = encodeURIComponent(JSON.stringify(result));
        const mapUrl = `${window.location.origin}/navigation/map/${selectedLayout}?path=${pathParam}`;

        console.log("🗺️ Opening map tab:", mapUrl);
        const newTab = window.open(mapUrl, "_blank");

        // ✅ Fallback if browser blocks popup
        if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
          alert(
            "Popup blocked! Please allow popups for this site to open the map view."
          );
          console.warn("⚠️ Popup blocked — couldn't open map.");
        }
      } else {
        alert(
          "Path finding failed: " + (result.error || "No valid path found.")
        );
        console.warn("❌ Invalid path response:", result);
      }
    } catch (error) {
      console.error("💥 FindPath Error:", error);
      alert("Path finding failed (check console for details)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Indoor Navigation
        </h1>

        {/* Layout Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">1. Select Floor Plan</h2>
          <select
            value={selectedLayout}
            onChange={(e) => {
              setSelectedLayout(e.target.value);
              if (e.target.value) fetchRooms(e.target.value);
            }}
            className="w-full p-3 border border-gray-300 rounded-md"
          >
            <option value="">Select a floor plan</option>
            {layouts.map((layout) => (
              <option key={layout._id} value={layout._id}>
                Hospital {layout.hospitalId} - Floor {layout.floorNumber}
              </option>
            ))}
          </select>

          {selectedLayout && (
            <button
              onClick={generateGraph}
              disabled={loading}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "Generating..." : "Generate Navigation Graph"}
            </button>
          )}

          {selectedLayout && (
            <button
              onClick={async () => {
                const res = await fetch("/api/path/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ layoutId: selectedLayout }),
                });
                const data = await res.json();
                if (data.success) {
                  alert(`Paths generated: ${data.pathsStored}`);
                  window.location.href = `/navigation/paths/${selectedLayout}`;
                } else {
                  alert("Failed to generate paths");
                }
              }}
              className="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
            >
              Generate & View Walkable Paths
            </button>
          )}
        </div>

        {/* Room Selection */}
        {rooms.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">2. Select Route</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">From:</label>
                <select
                  value={fromRoom}
                  onChange={(e) => setFromRoom(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                >
                  <option value="">Select starting room</option>
                  {rooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">To:</label>
                <select
                  value={toRoom}
                  onChange={(e) => setToRoom(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                >
                  <option value="">Select destination room</option>
                  {rooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={findPath}
              disabled={loading || !fromRoom || !toRoom}
              className="w-full bg-green-600 text-white py-3 rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? "Finding Path..." : "Find Route"}
            </button>
          </div>
        )}

        {/* Results */}
        {pathResult && (
          <div className="bg-green-50 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-2">Route Found!</h2>
            <p>
              <strong>From:</strong> {pathResult.from}
            </p>
            <p>
              <strong>To:</strong> {pathResult.to}
            </p>
            <p>
              <strong>Distance:</strong>{" "}
              {(pathResult.distance / 1000).toFixed(1)} units
            </p>
            <p>
              <strong>Steps:</strong> {pathResult.steps}
            </p>
            <p className="mt-2 text-sm text-green-600">
              Map opened in new window with the route highlighted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
