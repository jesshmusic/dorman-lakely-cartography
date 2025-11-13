/**
 * Concurrent Download Manager
 * Manages parallel file downloads with progress tracking and error handling
 */

import { DLCFile, DownloadStatus, DownloadQueueItem } from '../types/module';
import { APIService } from './api-service';
import { FileUploadService } from './file-upload-service';

interface DownloadCallbacks {
  onProgress?: (progress: DownloadProgress) => void;
  onFileComplete?: (file: DLCFile, status: DownloadStatus) => void;
  onComplete?: (results: DownloadResult[]) => void;
  onError?: (error: Error) => void;
}

interface DownloadProgress {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  currentFile: string | null;
  bytesDownloaded: number;
  totalBytes: number;
}

interface DownloadResult {
  file: DLCFile;
  status: DownloadStatus;
  error?: string;
}

export class ConcurrentDownloadManager {
  private concurrency: number;
  private apiService: APIService;
  private fileService: FileUploadService;
  private callbacks: DownloadCallbacks;

  private queue: DownloadQueueItem[] = [];
  private activeDownloads: Set<Promise<void>> = new Set();
  private results: DownloadResult[] = [];
  private aborted: boolean = false;

  constructor(
    concurrency: number,
    apiService: APIService,
    fileService: FileUploadService,
    callbacks: DownloadCallbacks = {}
  ) {
    this.concurrency = concurrency;
    this.apiService = apiService;
    this.fileService = fileService;
    this.callbacks = callbacks;
  }

  /**
   * Process download queue for a specific map
   */
  async process(mapId: string, files: DLCFile[], remappedPaths?: Map<string, string>): Promise<DownloadResult[]> {
    this.queue = [];
    this.activeDownloads.clear();
    this.results = [];
    this.aborted = false;

    // Build download queue
    for (const file of files) {
      const remappedPath = remappedPaths?.get(file.path) || file.path;

      this.queue.push({
        file,
        remappedPath,
        status: DownloadStatus.Pending,
        progress: 0
      });
    }

    // Disable media optimizer before starting downloads
    await this.fileService.disableMediaOptimizer();

    try {
      // Start initial workers
      for (let i = 0; i < Math.min(this.concurrency, this.queue.length); i++) {
        this.startWorker(mapId);
      }

      // Wait for all downloads to complete
      await Promise.all(Array.from(this.activeDownloads));

      // Re-enable media optimizer
      await this.fileService.enableMediaOptimizer();

      // Report completion
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete(this.results);
      }

      return this.results;
    } catch (error) {
      await this.fileService.enableMediaOptimizer();
      throw error;
    }
  }

  /**
   * Start a download worker
   */
  private async startWorker(mapId: string): Promise<void> {
    const workerPromise = this.worker(mapId);
    this.activeDownloads.add(workerPromise);

    try {
      await workerPromise;
    } finally {
      this.activeDownloads.delete(workerPromise);
    }
  }

  /**
   * Worker function that processes queue items
   */
  private async worker(mapId: string): Promise<void> {
    while (!this.aborted && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        await this.downloadFile(mapId, item);
      } catch (error) {
        console.error('Dorman Lakely Cartography | Worker error:', error);
      }
    }
  }

  /**
   * Download a single file
   */
  private async downloadFile(mapId: string, item: DownloadQueueItem): Promise<void> {
    const { file, remappedPath } = item;

    try {
      // Update status
      item.status = DownloadStatus.Downloading;
      this.reportProgress(file.path);

      // Check if file already exists
      const exists = await this.fileService.fileExists(remappedPath);
      if (exists) {
        console.log(`Dorman Lakely Cartography | File already exists, skipping: ${remappedPath}`);
        item.status = DownloadStatus.Completed;
        this.recordResult(file, DownloadStatus.Completed);
        return;
      }

      // Download file from API
      const blob = await this.apiService.downloadFile(mapId, file.path);

      // Update status
      item.status = DownloadStatus.Processing;

      // Upload to Foundry storage
      await this.fileService.uploadFile(blob, remappedPath);

      // Mark as completed
      item.status = DownloadStatus.Completed;
      this.recordResult(file, DownloadStatus.Completed);

      if (this.callbacks.onFileComplete) {
        this.callbacks.onFileComplete(file, DownloadStatus.Completed);
      }
    } catch (error) {
      console.error(`Dorman Lakely Cartography | Error downloading ${file.path}:`, error);

      item.status = DownloadStatus.Error;
      item.error = error instanceof Error ? error.message : 'Unknown error';

      this.recordResult(file, DownloadStatus.Error, item.error);

      if (this.callbacks.onFileComplete) {
        this.callbacks.onFileComplete(file, DownloadStatus.Error);
      }
    }
  }

  /**
   * Record download result
   */
  private recordResult(file: DLCFile, status: DownloadStatus, error?: string): void {
    this.results.push({
      file,
      status,
      error
    });
  }

  /**
   * Report download progress
   */
  private reportProgress(currentFile: string | null): void {
    if (!this.callbacks.onProgress) return;

    const completedFiles = this.results.filter(r => r.status === DownloadStatus.Completed).length;
    const failedFiles = this.results.filter(r => r.status === DownloadStatus.Error).length;
    const totalFiles = this.queue.length + this.results.length;

    // Calculate bytes (if available from file metadata)
    const totalBytes = this.results.reduce((sum, r) => sum + (r.file.size || 0), 0);
    const bytesDownloaded = this.results
      .filter(r => r.status === DownloadStatus.Completed)
      .reduce((sum, r) => sum + (r.file.size || 0), 0);

    this.callbacks.onProgress({
      totalFiles,
      completedFiles,
      failedFiles,
      currentFile,
      bytesDownloaded,
      totalBytes
    });
  }

  /**
   * Abort all downloads
   */
  abort(): void {
    this.aborted = true;
    this.queue = [];
    console.log('Dorman Lakely Cartography | Downloads aborted');
  }

  /**
   * Get current download statistics
   */
  getStats(): DownloadProgress {
    const completedFiles = this.results.filter(r => r.status === DownloadStatus.Completed).length;
    const failedFiles = this.results.filter(r => r.status === DownloadStatus.Error).length;
    const totalFiles = this.queue.length + this.results.length;

    const totalBytes = this.results.reduce((sum, r) => sum + (r.file.size || 0), 0);
    const bytesDownloaded = this.results
      .filter(r => r.status === DownloadStatus.Completed)
      .reduce((sum, r) => sum + (r.file.size || 0), 0);

    return {
      totalFiles,
      completedFiles,
      failedFiles,
      currentFile: null,
      bytesDownloaded,
      totalBytes
    };
  }
}
