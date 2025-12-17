
export interface DriveFile {
  id: string;
  name: string;
  size?: string;
  mimeType: string;
  modifiedTime: string;
  md5Checksum?: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

export interface CleanupCandidate {
  id: string;
  reason: string;
  category: 'duplicate' | 'old' | 'large';
  confidence: number;
}

export interface AnalysisResult {
  candidates: CleanupCandidate[];
  summary: string;
}

export enum AppState {
  LANDING,
  AUTHENTICATING,
  SCANNING,
  ANALYZING,
  REVIEWING,
  TRASHING,
  COMPLETED
}
