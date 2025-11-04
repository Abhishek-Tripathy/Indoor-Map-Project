'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Room } from '@/types/rooms';

// Dynamically import Leaflet component
const LeafletComponent = dynamic(() => import('./AdminLeafletComponent'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center">Loading admin map...</div>
});

interface AdminLeafletMapProps {
  geojsonData: any;
  rooms: Room[];
  layoutId: string;
  onRoomLabel: (roomId: string, name: string) => void;
  onRoomCreate: (center: [number, number]) => void; 
}

export default function AdminLeafletMap({ 
  geojsonData, 
  rooms, 
  layoutId, 
  onRoomLabel ,
  onRoomCreate 
}: AdminLeafletMapProps) {
  return (
    <LeafletComponent
      geojsonData={geojsonData}
      rooms={rooms}
      layoutId={layoutId}
      onRoomLabel={onRoomLabel}
      onRoomCreate={onRoomCreate} 
    />
  );
}