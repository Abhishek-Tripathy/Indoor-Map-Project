"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import LeafletMap from "@/components/LeafletMap";

interface Layout {
  _id: string;
  hospitalId: number;
  floorNumber: number;
  geojson: any;
  metadata: any;
}

export default function MapViewPage() {
  const params = useParams();
  const layoutId = params.id as string;

  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (layoutId) {
      fetchLayout();
    }
  }, [layoutId]);

  const fetchLayout = async () => {
    try {
      const response = await fetch(`/api/layouts2/${layoutId}`);
      const data = await response.json();

      if (data.layout) {
        console.log("Fetched layout:", data.layout);
        console.log(
          "GeoJSON features count:",
          data.layout.geojson.features.length
        );
        console.log("First feature:", data.layout.geojson.features[0]);
        setLayout(data.layout);
      } else {
        setError("Layout not found");
      }
    } catch (error) {
      setError("Failed to load layout");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading map...</div>
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
    <div className="h-screen w-screen">
      <div className="absolute top-4 left-4 z-10 bg-white p-4 rounded-lg shadow-lg">
        <h1 className="text-lg font-bold">
          Hospital {layout?.hospitalId} - Floor {layout?.floorNumber}
        </h1>
        <p className="text-sm text-gray-600">
          {layout?.metadata.filteredEntities} features
        </p>
      </div>

      <LeafletMap geojsonData={layout?.geojson} />
    </div>
  );
}
