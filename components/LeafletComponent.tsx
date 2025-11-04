"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LeafletComponentProps {
  geojsonData: any;
}

export default function LeafletComponent({
  geojsonData,
}: LeafletComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !geojsonData) return;

    console.log("GeoJSON data received:", geojsonData);

    // Use simple coordinate system
    map.current = L.map(mapContainer.current, {
      crs: L.CRS.Simple,
      zoomControl: true,
      attributionControl: false,
    });

    // Function to scale down large CAD coordinates to manageable numbers
    const scaleCoordinates = (coords: any): any => {
      if (Array.isArray(coords[0])) {
        return coords.map((coord: any) => scaleCoordinates(coord));
      } else if (coords.length >= 2 && typeof coords[0] === "number") {
        // SWAP X and Y: [x, y] becomes [y, x] for Leaflet
        return [coords[1] / 1000, coords[0] / 1000]; // Swap here
      }
      return coords;
    };

    // Process all features and collect bounds
    const allScaledCoords: [number, number][] = [];

    geojsonData.features.forEach((feature: any, index: number) => {
      if (!feature.geometry || !feature.geometry.coordinates) return;

      const scaledCoords = scaleCoordinates(feature.geometry.coordinates);
      const layer = feature.properties?.layer;

      let color = "#999";
      let weight = 1;
      let fillColor = "transparent";
      let fillOpacity = 0;

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
          fillColor = "#ff9999";
          fillOpacity = 0.6;
          break;
        case "FUR":
          color = "#ccc";
          weight = 1;
          break;
      }

      try {
        if (feature.geometry.type === "LineString") {
          // Collect coordinates for bounds calculation
          scaledCoords.forEach((coord: [number, number]) =>
            allScaledCoords.push(coord)
          );

          const leafletLine = L.polyline(scaledCoords, {
            color,
            weight,
            opacity: 1,
          }).addTo(map.current!);

          leafletLine.bindPopup(`
            <div class="text-sm">
              <strong>Layer:</strong> ${layer}<br/>
              <strong>Type:</strong> ${feature.geometry.type}<br/>
              <strong>ID:</strong> ${feature.properties?.id}
            </div>
          `);
        } else if (feature.geometry.type === "Polygon") {
          // For Polygon - use first ring (outer boundary)
          const polygonCoords = scaledCoords[0];
          polygonCoords.forEach((coord: [number, number]) =>
            allScaledCoords.push(coord)
          );

          const leafletPolygon = L.polygon(polygonCoords, {
            color,
            weight,
            fillColor,
            fillOpacity,
          }).addTo(map.current!);

          leafletPolygon.bindPopup(`
            <div class="text-sm">
              <strong>Layer:</strong> ${layer}<br/>
              <strong>Type:</strong> ${feature.geometry.type}<br/>
              <strong>ID:</strong> ${feature.properties?.id}
            </div>
          `);
        } else if (feature.geometry.type === "Point") {
          // Handle Point features (MTEXT labels)
          const pointCoords = scaledCoords;
          allScaledCoords.push(pointCoords);

          // Get the actual text from MTEXT
          const labelText = feature.properties?.text || "";

          // Only show labels that look like room names (room_001, room_002, etc.)
          const isRoomLabel =
            labelText &&
            (labelText.toLowerCase().includes("room_") ||
              labelText.toLowerCase().includes("room") ||
              labelText.match(/^room[\s_]*\d+$/i) ||
              labelText.match(/^[a-z]+\d+$/i)); // matches "pharmacy1", "lab2", etc.

          // Skip labels that are empty, "no label", or don't look like room names
          if (
            !labelText ||
            labelText.toLowerCase().includes("no label") ||
            !isRoomLabel
          ) {
            console.log(`Skipping label: "${labelText}"`);
            return; // Skip this feature
          }

          // Create a custom div icon to show the text
          const textIcon = L.divIcon({
            html: `<div style="
      background: #2563eb; 
      color: white; 
      padding: 4px 8px; 
      border-radius: 4px; 
      font-size: 12px; 
      font-weight: bold;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      white-space: nowrap;
    ">${labelText}</div>`,
            className: "text-label",
            iconSize: [labelText.length * 8 + 20, 30], // Dynamic width based on text length
            iconAnchor: [labelText.length * 4 + 10, 15], // Center the icon
          });

          const marker = L.marker(pointCoords, { icon: textIcon }).addTo(
            map.current!
          );

          marker.bindPopup(`
    <div class="text-sm">
      <strong>Room:</strong> ${labelText}<br/>
      <strong>Layer:</strong> ${layer}<br/>
      <strong>Coordinates:</strong> [${pointCoords[0].toFixed(
        2
      )}, ${pointCoords[1].toFixed(2)}]
    </div>
  `);

          console.log(`Added room label: "${labelText}" at`, pointCoords);
        }

        console.log(
          `Added feature ${index}: ${feature.geometry.type} from layer ${layer}`
        );
      } catch (error) {
        console.error(`Error adding feature ${index}:`, error);
      }
    });

    // Calculate bounds from scaled coordinates
    if (allScaledCoords.length > 0) {
      const bounds = L.latLngBounds(allScaledCoords);
      map.current.fitBounds(bounds, { padding: [20, 20] });
      console.log("Map bounds set to:", bounds);
    } else {
      // Fallback view if no coordinates
      map.current.setView([0, 0], 1);
    }

    console.log(
      `Successfully processed ${geojsonData.features.length} features`
    );

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [geojsonData]);

  return <div ref={mapContainer} className="h-full w-full bg-gray-100" />;
}
