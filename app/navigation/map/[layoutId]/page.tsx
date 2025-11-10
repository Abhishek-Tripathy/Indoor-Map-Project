"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PathData {
  path: string[];
  coordinates: number[][];
  from: string;
  to: string;
  distance: number;
  steps: number;
}

export default function NavigationMapPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const layoutId = params.layoutId as string;
  const pathDataJson = searchParams.get("path");

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [layout, setLayout] = useState<any>(null);
  const [pathData, setPathData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!layoutId) return;

    const loadData = async () => {
      try {
        // Load layout data
        const layoutResponse = await fetch(`/api/layouts2/${layoutId}`);
        const layoutData = await layoutResponse.json();
        setLayout(layoutData.layout);

        // Parse path data from URL
        if (pathDataJson) {
          const parsedPath = JSON.parse(decodeURIComponent(pathDataJson));
          setPathData(parsedPath);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [layoutId, pathDataJson]);

  useEffect(() => {
    if (!mapContainer.current || !layout || !pathData) return;

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

    // Add floor plan
    const allScaledCoords: [number, number][] = [];

    layout.geojson.features.forEach((feature: any) => {
      if (!feature.geometry?.coordinates) return;

      const scaledCoords = scaleCoordinates(feature.geometry.coordinates);
      const layer = feature.properties?.layer;

      let color = "#999";
      let weight = 1;
      let opacity = 0.5; // Make base map lighter

      switch (layer) {
        case "WALL":
          color = "#333";
          weight = 3;
          break;
        case "DOOR":
          color = "#b38e59";
          weight = 2;
          break;
        case "STAIR":
          color = "#ff9999";
          weight = 2;
          break;
        case "FUR":
          color = "#ccc";
          weight = 1;
          opacity = 0.3;
          break;
      }

      if (feature.geometry.type === "LineString") {
        scaledCoords.forEach((coord: [number, number]) =>
          allScaledCoords.push(coord)
        );
        L.polyline(scaledCoords, { color, weight, opacity }).addTo(
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
          fillOpacity: layer === "STAIR" ? 0.2 : 0,
        }).addTo(map.current!);
      }
    });

    const pathCoords = pathData.pathCoords || pathData.coordinates;
    if (pathCoords && pathCoords.length > 1) {
      const scaledPath = pathCoords.map((coord) => scaleCoordinates(coord));

      // Draw the path
      const pathLine = L.polyline(scaledPath, {
        color: "#2563eb",
        weight: 6,
        opacity: 0.8,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map.current!);

      // Add start and end markers
      const startCoords = scaledPath[0];
      const endCoords = scaledPath[scaledPath.length - 1];

      // Start marker (green)
      L.marker(startCoords, {
        icon: L.divIcon({
          html: `<div style="
            background: #10b981; 
            color: white; 
            padding: 6px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">START: ${pathData.from}</div>`,
          className: "path-label",
          iconSize: [150, 40],
          iconAnchor: [75, 20],
        }),
      }).addTo(map.current!);

      // End marker (red)
      L.marker(endCoords, {
        icon: L.divIcon({
          html: `<div style="
            background: #ef4444; 
            color: white; 
            padding: 6px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">END: ${pathData.to}</div>`,
          className: "path-label",
          iconSize: [150, 40],
          iconAnchor: [75, 20],
        }),
      }).addTo(map.current!);

      // Fit map to show the entire path
      const pathBounds = L.latLngBounds(scaledPath);
      map.current.fitBounds(pathBounds, { padding: [50, 50] });
    }

    // Set bounds if no path data
    if (allScaledCoords.length > 0 && (!pathData || !pathData.coordinates)) {
      const bounds = L.latLngBounds(allScaledCoords);
      map.current.fitBounds(bounds, { padding: [20, 20] });
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [layout, pathData]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="text-xl">Loading navigation map...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Navigation Route</h1>
          {pathData && (
            <p className="text-sm text-gray-600">
              {pathData.from} → {pathData.to} • {pathData.steps} steps •{" "}
              {(pathData.distance / 1000).toFixed(1)} units
            </p>
          )}
        </div>
        <button
          onClick={() => window.close()}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Close
        </button>
      </div>

      {/* Map */}
      <div className="flex-1">
        <div ref={mapContainer} className="h-full w-full bg-gray-100" />
      </div>

      {/* Instructions */}
      {pathData && (
        <div className="bg-blue-50 border-t px-4 py-3">
          <div className="text-sm">
            <strong>Route Instructions:</strong>
            <div className="mt-1">
              Follow the{" "}
              <span className="text-blue-600 font-bold">blue path</span> from{" "}
              <span className="text-green-600 font-bold">{pathData.from}</span>{" "}
              to <span className="text-red-600 font-bold">{pathData.to}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
