"use client";

import { useState, useEffect } from "react";

interface StoredMap {
  _id: string;
  parsedJson: any;
  uploadedAt?: Date;
}

interface ProcessingResult {
  success: boolean;
  layoutId: string;
  stats: {
    originalEntities: number;
    filteredEntities: number;
    reductionPercent: string;
  };
  geojson: any;
}

export default function ProcessStoredPage() {
  const [analysis, setAnalysis] = useState<AnalysisResult[]>([]);
  const [storedMaps, setStoredMaps] = useState<StoredMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<{ [key: string]: boolean }>({});
  const [results, setResults] = useState<{ [key: string]: ProcessingResult }>(
    {}
  );

  // Fetch stored DXF JSONs from MongoDB
  useEffect(() => {
    fetchStoredMaps();
    fetchAnalysis();
  }, []);

  const fetchStoredMaps = async () => {
    try {
      const response = await fetch("/api/get-stored-maps");
      const data = await response.json();
      setStoredMaps(data.maps || []);
    } catch (error) {
      console.error("Failed to fetch stored maps:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    try {
      const response = await fetch("/api/debug/dxf-analysis");
      const data = await response.json();

      if (data.success) {
        setAnalysis(data.analysis);
      }
    } catch (error) {
      console.error("Failed to fetch analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  // Process a stored DXF JSON using our upload2 route
  const processStoredMap = async (
    map: StoredMap,
    hospitalId: number = 1,
    floorNumber: number = 0
  ) => {
    setProcessing((prev) => ({ ...prev, [map._id]: true }));

    try {
      const response = await fetch("/api/upload2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hospitalId,
          floorNumber,
          dxfData: map.parsedJson,
        }),
      });

      const result: ProcessingResult = await response.json();

      if (result.success) {
        setResults((prev) => ({ ...prev, [map._id]: result }));
        alert(
          `Successfully processed! Reduced from ${result.stats.originalEntities} to ${result.stats.filteredEntities} entities`
        );
      } else {
        alert("Processing failed");
      }
    } catch (error) {
      console.error("Processing error:", error);
      alert("Processing failed");
    } finally {
      setProcessing((prev) => ({ ...prev, [map._id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading stored maps...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Process Stored DXF Files
        </h1>

        {storedMaps.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-600">
              No stored DXF files found in database.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {storedMaps.map((map) => (
              <div key={map._id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Map {map._id.slice(-6)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Entities: {map.parsedJson.entities?.length || "Unknown"}
                    </p>
                    {map.uploadedAt && (
                      <p className="text-xs text-gray-500">
                        Uploaded:{" "}
                        {new Date(map.uploadedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => processStoredMap(map)}
                    disabled={processing[map._id]}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {processing[map._id] ? "Processing..." : "Process & Filter"}
                  </button>
                </div>

                {results[map._id] && (
                  <div className="mt-4 p-4 bg-green-50 rounded-md">
                    <h4 className="font-semibold text-green-800 mb-2">
                      Processing Results:
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Original:</span>{" "}
                        {results[map._id].stats.originalEntities}
                      </div>
                      <div>
                        <span className="font-medium">Filtered:</span>{" "}
                        {results[map._id].stats.filteredEntities}
                      </div>
                      <div>
                        <span className="font-medium">Reduction:</span>{" "}
                        {results[map._id].stats.reductionPercent}%
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        console.log("GeoJSON:", results[map._id].geojson)
                      }
                      className="mt-2 text-blue-600 text-sm hover:underline"
                    >
                      View GeoJSON in Console
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
