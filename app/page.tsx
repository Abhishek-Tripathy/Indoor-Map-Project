"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

 

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      console.log("Parsed JSON:", json);
      alert("File parsed successfully! Check console for details.");
    } catch (err) {
      console.error(err);
      alert("Error uploading or parsing file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center mt-20 space-y-4">
      <input
        type="file"
        accept=".dxf,.dwg"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        {loading ? "Parsing..." : "Upload & Parse"}
      </button>
    </div>
  );
}
