export interface UploadState {
  isProcessing: boolean;
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  message: string;
}

export interface ProcessingStats {
  originalEntities: number;
  filteredEntities: number;
  reductionPercent: string;
}

export interface UploadResponse {
  success: boolean;
  layoutId: string;
  stats: ProcessingStats;
  geojson: any;
}