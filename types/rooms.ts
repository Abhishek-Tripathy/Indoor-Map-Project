export interface Room {
  roomId: string;
  name: string;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  center: [number, number];
  area: number;
  wallCount: number;
  type: string;
  labeledAt?: Date;
  labeledBy?: string;
}

export interface RoomDetectionResponse {
  success: boolean;
  rooms: Room[];
  count: number;
}

export interface RoomLabelResponse {
  success: boolean;
  message: string;
}