'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet only on client side
const LeafletComponent = dynamic(() => import('../components/LeafletComponent'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center">Loading map...</div>
});

interface LeafletMapProps {
  geojsonData: any;
}

export default function LeafletMap({ geojsonData }: LeafletMapProps) {
  return <LeafletComponent geojsonData={geojsonData} />;
}