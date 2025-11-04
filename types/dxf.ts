export interface DXFVertex {
  x: number;
  y: number;
  z: number;
}

export interface DXFEntity {
  type: string;
  layer: string;
  handle?: string;
  ownerHandle?: string;
  lineType?: string;
  vertices?: DXFVertex[];
  center?: DXFVertex;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  angleLength?: number;
  closed?: boolean;
  position?: DXFVertex;
  name?: string;
  rotation?: number;
  text?: string;
  textHeight?: number;
  corners?: DXFVertex[]; 
  default?: string;     
  string?: string;       
  value?: string;        
  first?: DXFVertex;      
  second?: DXFVertex;     
  third?: DXFVertex;     
  fourth?: DXFVertex;    
}

export interface DXFData {
  entities: DXFEntity[];
}

export interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, any>;
  geometry: {
    type: "Point" | "LineString" | "Polygon";
    coordinates: number[] | number[][] | number[][][];
  };
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface LayoutMetadata {
  processedAt: string;
  originalEntities: number;
  convertedEntities: number;  
  conversionRate: string;      
}

export interface LayoutDocument {
  _id?: string;
  hospitalId: number;
  floorNumber: number;
  geojson: GeoJSONFeatureCollection;
  metadata: LayoutMetadata;
  createdAt: Date;
  updatedAt?: Date;  
}