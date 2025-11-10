"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import "leaflet/dist/leaflet.css";

export default function LayoutViewerPage() {
  const { layoutId } = useParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<any>(null);

  useEffect(() => {
    async function fetchLayout() {
      const res = await fetch(`/api/layouts2/${layoutId}`);
      const data = await res.json();
      setLayout(data.layout);
    }
    fetchLayout();
  }, [layoutId]);

  useEffect(() => {
    if (!layout || !mapContainer.current) return;

    import("leaflet").then((L) => {
      const map = L.map(mapContainer.current, {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 4,
        zoomSnap: 0.25,
      });

      const features = layout.geojson.features || [];
      const coordsAll: [number, number][] = [];

      features.forEach((f: any) => {
        const coords = f.geometry?.coordinates;
        if (!coords) return;

        const scaled = Array.isArray(coords[0])
          ? coords.map((c: any) => [c[0] / 100, c[1] / 100])
          : [coords[0] / 100, coords[1] / 100];

        const layerName = f.properties?.layer || "";
        let color = "#999";
        if (layerName.includes("WALL")) color = "#000";
        else if (layerName.includes("DOOR")) color = "#b38e59";
        else if (layerName.includes("FURN")) color = "#777";

        if (f.geometry.type === "LineString") {
          L.polyline(scaled, { color, weight: 1 }).addTo(map);
          coordsAll.push(...scaled);
        } else if (f.geometry.type === "Polygon") {
          L.polygon(scaled, { color, weight: 1, fillOpacity: 0 }).addTo(map);
          coordsAll.push(...scaled);
        } else if (f.geometry.type === "Point") {
          L.circleMarker(scaled as any, { radius: 2, color: "#f00" }).addTo(map);
          coordsAll.push(scaled as any);
        }
      });

      const bounds = L.latLngBounds(coordsAll);
      map.fitBounds(bounds.pad(0.1));
    });
  }, [layout]);

  return (
    <div className="h-screen w-screen">
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}
