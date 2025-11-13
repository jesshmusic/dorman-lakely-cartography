/**
 * Download Dialog
 * Manages the download process for a single map with progress tracking
 * Uses ApplicationV2 (Foundry v12+ modern application API)
 */

import { DLCMap, DLCFile, DownloadStatus } from '../types/module';
import { APIService } from '../services/api-service';
import { FileUploadService } from '../services/file-upload-service';
import { ConcurrentDownloadManager } from '../services/concurrent-download-manager';
import { MODULE_ID, MODULE_TITLE } from '../main';

export class DownloadDialog extends foundry.applications.api.ApplicationV2 {
  private map: DLCMap;
  private apiService: APIService;
  private fileService: FileUploadService;
  private downloadManager: ConcurrentDownloadManager | null = null;
  private files: DLCFile[] = [];
  private downloading: boolean = false;
  private completed: boolean = false;
  private progress: {
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    currentFile: string | null;
  } = {
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    currentFile: null
  };

  static override DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-download`,
    classes: ['dlc-download'],
    tag: 'div',
    window: {
      title: 'Download Map',
      icon: 'fas fa-download',
      minimizable: false,
      resizable: false
    },
    position: {
      width: 600,
      height: 400
    },
    actions: {
      startDownload: this.prototype._onStartDownload,
      cancelDownload: this.prototype._onCancelDownload,
      close: this.prototype._onClose
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/download.hbs`
    }
  };

  constructor(map: DLCMap, apiService: APIService, options = {}) {
    super(options);
    this.map = map;
    this.apiService = apiService;
    this.fileService = new FileUploadService();

    // Update window title
    this.options.window.title = `Download: ${map.name}`;
  }

  override async _prepareContext(_options: any): Promise<any> {
    // Get download path from settings
    const downloadPath = game.dlcMaps?.settings.downloadPath || `modules/${MODULE_ID}/assets/scenes/`;

    return {
      map: this.map,
      downloading: this.downloading,
      completed: this.completed,
      progress: this.progress,
      files: this.files,
      downloadPath,
      hasFiles: this.files.length > 0
    };
  }

  override async _onRender(_context: any, _options: any): Promise<void> {
    // Auto-load file manifest when dialog opens
    if (this.files.length === 0 && !this.downloading) {
      await this.loadFileManifest();
    }
  }

  /**
   * Load file manifest from API
   */
  private async loadFileManifest(): Promise<void> {
    try {
      ui.notifications.info('Loading file list...');

      const manifest = await this.apiService.fetchFileManifest(this.map.id);
      this.files = manifest.files;

      console.log(
        `${MODULE_TITLE} | Loaded ${this.files.length} files for map: ${this.map.name}`
      );

      this.render(false);
    } catch (error) {
      console.error(`${MODULE_TITLE} | Error loading file manifest:`, error);
      ui.notifications.error(
        error instanceof Error ? error.message : 'Failed to load file list.'
      );
      this.close();
    }
  }

  /**
   * Start download process
   */
  private async _onStartDownload(_event: Event, _target: HTMLElement): Promise<void> {
    if (this.downloading || this.completed) return;

    try {
      this.downloading = true;
      this.render(false);

      ui.notifications.info(`Starting download: ${this.map.name}`);

      // Get concurrency setting
      const concurrency = game.dlcMaps?.settings.concurrentDownloads || 5;

      // Build path remapping if custom download path
      const downloadPath = game.dlcMaps?.settings.downloadPath;
      const remappedPaths = new Map<string, string>();

      if (downloadPath && downloadPath !== `modules/${MODULE_ID}/assets/scenes/`) {
        for (const file of this.files) {
          // Remap module path to custom path
          const remapped = file.path.replace(
            `modules/${MODULE_ID}/assets/scenes/`,
            downloadPath
          );
          remappedPaths.set(file.path, remapped);
        }
      }

      // Create download manager
      this.downloadManager = new ConcurrentDownloadManager(
        concurrency,
        this.apiService,
        this.fileService,
        {
          onProgress: progress => {
            this.progress = {
              totalFiles: progress.totalFiles,
              completedFiles: progress.completedFiles,
              failedFiles: progress.failedFiles,
              currentFile: progress.currentFile
            };
            this.render(false);
          },
          onFileComplete: (file, status) => {
            console.log(
              `${MODULE_TITLE} | File ${status}: ${file.path}`
            );
          },
          onComplete: results => {
            this.onDownloadComplete(results);
          }
        }
      );

      // Start download
      await this.downloadManager.process(this.map.id, this.files, remappedPaths);
    } catch (error) {
      console.error(`${MODULE_TITLE} | Download error:`, error);
      ui.notifications.error(
        error instanceof Error ? error.message : 'Download failed. Please try again.'
      );
      this.downloading = false;
      this.render(false);
    }
  }

  /**
   * Handle download completion
   */
  private onDownloadComplete(results: any[]): void {
    this.downloading = false;
    this.completed = true;

    const successCount = results.filter(r => r.status === DownloadStatus.Completed).length;
    const failCount = results.filter(r => r.status === DownloadStatus.Error).length;

    if (failCount === 0) {
      ui.notifications.info(
        `Successfully downloaded ${successCount} files for ${this.map.name}!`
      );
    } else {
      ui.notifications.warn(
        `Downloaded ${successCount} files with ${failCount} errors for ${this.map.name}.`
      );
    }

    this.render(false);

    // Auto-close after 3 seconds if successful
    if (failCount === 0) {
      setTimeout(() => this.close(), 3000);
    }
  }

  /**
   * Cancel download
   */
  private _onCancelDownload(_event: Event, _target: HTMLElement): void {
    if (this.downloadManager) {
      this.downloadManager.abort();
      ui.notifications.info('Download cancelled.');
    }

    this.downloading = false;
    this.render(false);
  }

  /**
   * Close dialog
   */
  private _onClose(_event: Event, _target: HTMLElement): void {
    this.close();
  }

  override async close(options?: any): Promise<void> {
    // Abort any active downloads
    if (this.downloading && this.downloadManager) {
      this.downloadManager.abort();
    }

    return super.close(options);
  }
}
