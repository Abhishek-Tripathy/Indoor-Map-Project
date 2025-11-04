"use client";

import { useState, useEffect } from "react";

interface Layout {
  _id: string;
  hospitalId: number;
  floorNumber: number;
  geojson: any;
  metadata: {
    processedAt: string;
    originalEntities: number;
    filteredEntities: number;
    reductionPercent: string;
  };
  createdAt: string;
}

export default function LayoutsListPage() {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  };

  const viewOnMap = (layoutId: string) => {
    window.open(`/map-view/${layoutId}`, "_blank");
  };

  const viewAdminMap = (layoutId: string) => {
    window.open(`/admin/map-view/${layoutId}`, "_blank");
  };

  const previewGeoJSON = (layout: Layout) => {
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head><title>Layout ${layout.hospitalId}-${
        layout.floorNumber
      } GeoJSON</title></head>
          <body>
            <h2>Hospital ${layout.hospitalId} - Floor ${layout.floorNumber}</h2>
            <pre>${JSON.stringify(layout.geojson, null, 2)}</pre>
          </body>
        </html>
      `);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading layouts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            All Processed Layouts
          </h1>
          <button
            onClick={fetchLayouts}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {layouts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600">No processed layouts found.</p>
            <p className="text-sm text-gray-500 mt-2">
              Process some DXF files first to see them here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {layouts.map((layout) => (
              <div
                key={layout._id}
                className="bg-white rounded-lg shadow-md p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Hospital {layout.hospitalId} - Floor {layout.floorNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Processed:{" "}
                      {new Date(layout.metadata.processedAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(layout.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={() => previewGeoJSON(layout)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    Preview GeoJSON
                  </button>
                  <button
                    onClick={() => viewOnMap(layout._id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    View on Map
                  </button>
                  <button
                    onClick={() => viewAdminMap(layout._id)}
                    className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                  >
                    Admin Labeling
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-900">
                      {layout.metadata.originalEntities}
                    </div>
                    <div className="text-gray-600">Original</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {layout.metadata.filteredEntities}
                    </div>
                    <div className="text-gray-600">Filtered</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {layout.metadata.reductionPercent}%
                    </div>
                    <div className="text-gray-600">Reduction</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-purple-600">
                      {layout.geojson.features?.length || 0}
                    </div>
                    <div className="text-gray-600">Features</div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  Layout ID: {layout._id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
