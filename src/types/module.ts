/**
 * Module-specific type definitions
 */

export interface DLCMap {
  id: string;
  name: string;
  thumbnail: string;
  description?: string;
  tags: string[];
  keywords?: string[];
  access: 'Free' | 'Premium';
  gridSize?: number;
  gridUnits?: string;
  resolution?: {
    width: number;
    height: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface DLCTag {
  value: string;
  label: string;
  count?: number;
}

export interface DLCUser {
  userId: string;
  has_free: boolean;
  has_premium: boolean;
  expires_in?: number;
}

export type DLCFileType =
  | 'scene'           // Scene JSON file
  | 'background'      // Background/map image
  | 'tile'            // Tile images
  | 'token'           // Token images
  | 'audio'           // Sound effects/music
  | 'thumbnail'       // Preview thumbnail
  | 'other';          // Other assets

export interface DLCFile {
  path: string;
  name?: string;          // Optional: clean filename from backend
  file_name?: string;     // Optional: backend compatibility
  size: number;
  type: DLCFileType;
  checksum?: string;
}

export interface DLCFileManifest {
  mapId: string;
  files: DLCFile[];
  totalSize: number;
}

export interface DLCDownloadProgress {
  mapId: string;
  totalFiles: number;
  downloadedFiles: number;
  totalBytes: number;
  downloadedBytes: number;
  currentFile?: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
}

export interface DLCAPIConfig {
  baseUrl: string;
  patreonClientId: string;
  patreonRedirectUri: string;
}

export interface DLCSettings {
  userId: string | null;
  user: DLCUser | null;
  apiConfig: DLCAPIConfig;
  downloadPath: string;
  concurrentDownloads: number;
  cacheExpiry: number;
}

export enum DownloadStatus {
  Pending = 'pending',
  Downloading = 'downloading',
  Processing = 'processing',
  Completed = 'completed',
  Error = 'error'
}

export interface DownloadQueueItem {
  file: DLCFile;
  remappedPath: string;
  status: DownloadStatus;
  progress: number;
  error?: string;
}

// Global module data stored on game object
declare global {
  interface Game {
    dlcMaps?: {
      maps: DLCMap[];
      tags: DLCTag[];
      user: DLCUser | null;
      settings: DLCSettings;
    };
  }
}

export {};
