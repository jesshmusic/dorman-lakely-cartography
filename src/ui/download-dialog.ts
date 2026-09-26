/**
 * Download Dialog
 * Manages the download process for a single map with progress tracking
 * Uses ApplicationV2 (Foundry v12+ modern application API)
 */

import { DLCMap, DLCFile, DownloadStatus } from '../types/module';
import { APIService } from '../services/api-service';
import { FileUploadService } from '../services/file-upload-service';
import { ConcurrentDownloadManager } from '../services/concurrent-download-manager';
import { resolveRemappedPath } from '../services/scene-data-paths';
import { importScenePackageData } from '../services/scene-importer';
import { MODULE_ID, MODULE_TITLE } from '../constants';

export class DownloadDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  private map: DLCMap;
  private apiService: APIService;
  private fileService: FileUploadService;
  private downloadManager: ConcurrentDownloadManager | null = null;
  private files: DLCFile[] = [];
  private downloading: boolean = false;
  private completed: boolean = false;
  private cancelled: boolean = false;
  private errorMessage: string | null = null;
  private sceneJsonBlob: Blob | null = null;
  private remappedPaths: Map<string, string> = new Map();
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
      width: 500,
      height: 'auto'
    },
    actions: {
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
    const downloadPath =
      game.dlcMaps?.settings.downloadPath || `modules/${MODULE_ID}/assets/scenes/`;

    return {
      map: this.map,
      downloading: this.downloading,
      completed: this.completed,
      error: this.errorMessage,
      progress: this.progress,
      files: this.files,
      downloadPath,
      hasFiles: this.files.length > 0
    };
  }

  override async _onRender(_context: any, _options: any): Promise<void> {
    // Auto-load file manifest and start download when dialog opens
    if (this.files.length === 0 && !this.downloading && !this.completed && !this.errorMessage) {
      await this.loadFileManifest();

      // Auto-start download after loading files
      if (this.files.length > 0) {
        console.log(`${MODULE_TITLE} | Auto-starting download...`);
        // Use setTimeout to ensure render completes first
        setTimeout(() => this.startDownload(), 100);
      }
    }
  }

  /**
   * Extract filename from path for display
   * Handles URL decoding and special characters
   */
  private getFileName(path: string): string {
    try {
      // Extract filename from path
      const filename = path.split('/').pop() || path;

      // URL decode to handle special characters like %20
      return decodeURIComponent(filename);
    } catch {
      // If decoding fails, return the original
      return path.split('/').pop() || path;
    }
  }

  /**
   * Load file manifest from API
   */
  private async loadFileManifest(): Promise<void> {
    try {
      ui.notifications.info('Loading file list...');

      const isFreeMap = this.map.access === 'Free';
      console.log(
        `${MODULE_TITLE} | Loading files for ${isFreeMap ? 'FREE' : 'PREMIUM'} map: ${this.map.name}`
      );

      const manifest = await this.apiService.fetchFileManifest(this.map.id, isFreeMap);
      this.files = manifest.files;

      console.log(`${MODULE_TITLE} | Loaded ${this.files.length} files for map: ${this.map.name}`);
      console.log(
        `${MODULE_TITLE} | Files:`,
        this.files.map(f => ({ path: f.path, type: f.type, size: f.size }))
      );

      this.render(false);
    } catch (error) {
      console.error(`${MODULE_TITLE} | Error loading file manifest:`, error);
      ui.notifications.error(error instanceof Error ? error.message : 'Failed to load file list.');
      this.close();
    }
  }

  /**
   * Start download process (can be called from UI or automatically)
   */
  private async startDownload(): Promise<void> {
    if (this.downloading || this.completed) return;

    try {
      this.downloading = true;
      this.render(false);

      ui.notifications.info(`Starting download: ${this.map.name}`);

      // Get concurrency setting
      const concurrency = game.dlcMaps?.settings.concurrentDownloads || 5;

      // Get base download path
      const downloadPath = game.dlcMaps?.settings.downloadPath || 'Dorman Lakely Cartography';

      // Create map slug from name
      const mapSlug = this.createSlug(this.map.name);
      console.log(`${MODULE_TITLE} | Map slug: ${mapSlug}`);

      // Build path remapping with proper folder structure
      this.remappedPaths = new Map<string, string>();

      console.log(`${MODULE_TITLE} | Building path remapping for ${this.files.length} files...`);
      for (const file of this.files) {
        const remapped = this.remapFilePath(file.path, file.type, downloadPath, mapSlug);

        // Store the mapping with the original path as key
        this.remappedPaths.set(file.path, remapped);

        // Also store with decoded version as key (if different)
        try {
          const decodedPath = decodeURIComponent(file.path);
          if (decodedPath !== file.path) {
            this.remappedPaths.set(decodedPath, remapped);
          }
        } catch {
          // Ignore decode errors
        }

        console.log(`${MODULE_TITLE} | Path mapping [${file.type}]:`);
        console.log(`${MODULE_TITLE} |   Original: ${file.path}`);
        console.log(`${MODULE_TITLE} |   Remapped: ${remapped}`);
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
              currentFile: progress.currentFile ? this.getFileName(progress.currentFile) : null
            };
            this.render(false);
          },
          onFileComplete: (file, status, blob) => {
            console.log(`${MODULE_TITLE} | File ${status}: ${file.path}`);

            // Store scene.json blob for later use
            const fileName = file.path.split('/').pop();
            if (fileName === 'scene.json' && blob && status === 'completed') {
              this.sceneJsonBlob = blob;
              console.log(
                `${MODULE_TITLE} | ✓ Stored scene.json blob in memory (${blob.size} bytes)`
              );
            }

            // onProgress only fires when a file starts, so refresh counts on completion too
            this.syncProgress();
            this.render(false);
          },
          onComplete: results => {
            this.syncProgress(null);
            this.onDownloadComplete(results);
          }
        }
      );

      // Start download
      await this.downloadManager.process(
        this.map.id,
        this.files,
        this.remappedPaths,
        this.map.access === 'Free'
      );
    } catch (error) {
      console.error(`${MODULE_TITLE} | Download error:`, error);
      const message = error instanceof Error ? error.message : 'Download failed. Please try again.';
      ui.notifications.error(message);
      this.downloading = false;
      this.errorMessage = message;
      this.render(false);
    }
  }

  /**
   * Refresh displayed progress from the download manager's authoritative stats
   */
  private syncProgress(currentFile: string | null = this.progress.currentFile): void {
    if (!this.downloadManager) return;
    const stats = this.downloadManager.getStats();
    this.progress = {
      totalFiles: stats.totalFiles,
      completedFiles: stats.completedFiles,
      failedFiles: stats.failedFiles,
      currentFile
    };
  }

  /**
   * Create a URL-safe slug from a string
   */
  private createSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove non-word chars
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/--+/g, '-') // Replace multiple - with single -
      .trim();
  }

  /**
   * Remap file path to new folder structure
   */
  private remapFilePath(
    originalPath: string,
    fileType: string,
    basePath: string,
    mapSlug: string
  ): string {
    let fileName = originalPath.split('/').pop() || 'file';

    // URL decode the filename to handle special characters
    try {
      fileName = decodeURIComponent(fileName);
    } catch {
      console.warn(`${MODULE_TITLE} | Failed to decode filename: ${fileName}`);
    }

    // Don't save scene.json to storage
    if (fileName === 'scene.json') {
      return originalPath; // Keep original path for tracking, but won't be uploaded
    }

    // Determine subfolder based on file type
    let subfolder: string;

    switch (fileType) {
      case 'background':
      case 'scene':
        subfolder = `Maps/${mapSlug}/Maps`;
        break;
      case 'tile':
        subfolder = `Maps/${mapSlug}/Tiles`;
        break;
      case 'audio':
        subfolder = 'Audio';
        break;
      case 'token':
        subfolder = `Maps/${mapSlug}/Tiles`; // Tokens go in Tiles folder
        break;
      default:
        subfolder = `Maps/${mapSlug}/Maps`; // Default to Maps
    }

    return `${basePath}/${subfolder}/${fileName}`;
  }

  /**
   * Handle download completion
   */
  private async onDownloadComplete(results: any[]): Promise<void> {
    this.downloading = false;

    // A cancelled download still resolves with partial results; don't import those
    if (this.cancelled) {
      console.log(`${MODULE_TITLE} | Download cancelled, skipping scene import`);
      this.render(false);
      return;
    }

    const successCount = results.filter(r => r.status === DownloadStatus.Completed).length;
    const failCount = results.filter(r => r.status === DownloadStatus.Error).length;

    console.log(
      `${MODULE_TITLE} | Download complete: ${successCount} succeeded, ${failCount} failed`
    );

    if (failCount === 0) {
      ui.notifications.info(`Successfully downloaded ${successCount} files for ${this.map.name}!`);

      // Import the scene after successful download
      try {
        await this.importScene(results);
        this.completed = true;
      } catch (error) {
        console.error(`${MODULE_TITLE} | Scene import failed:`, error);
        if (error instanceof Error && error.stack) {
          console.error(`${MODULE_TITLE} | Error stack:`, error.stack);
        }
        const reason = error instanceof Error ? error.message : 'Unknown error';
        this.errorMessage = `Files downloaded but scene import failed: ${reason}`;
        ui.notifications.error(`${this.errorMessage}. Check console for details.`);
      }
    } else {
      this.errorMessage = `Download failed: ${successCount} succeeded, ${failCount} failed.`;
      ui.notifications.error(`${this.errorMessage} Check console for details.`);
      console.error(
        `${MODULE_TITLE} | Failed files:`,
        results.filter(r => r.status === DownloadStatus.Error)
      );
    }

    this.render(false);

    // Auto-close after 3 seconds only if fully successful
    if (failCount === 0 && this.completed) {
      setTimeout(() => this.close(), 3000);
    }
  }

  /**
   * Import scene.json to create the scene in Foundry.
   * Throws on failure so the dialog doesn't report a completed import.
   */
  private async importScene(results: any[]): Promise<void> {
    console.log(`${MODULE_TITLE} | Starting scene import, checking ${results.length} files`);
    console.log(
      `${MODULE_TITLE} | Results:`,
      results.map(r => ({ path: r.file.path, status: r.status }))
    );

    if (!this.sceneJsonBlob) {
      throw new Error('No scene.json found in package');
    }

    console.log(
      `${MODULE_TITLE} | Using scene.json blob from memory (${this.sceneJsonBlob.size} bytes)`
    );

    const sceneData = JSON.parse(await this.sceneJsonBlob.text());
    console.log(`${MODULE_TITLE} | Parsed scene data:`, {
      name: sceneData.name,
      width: sceneData.width,
      height: sceneData.height,
      coreVersion: sceneData._stats?.coreVersion ?? null
    });

    // Check if scene already exists and find unique name
    const originalName = sceneData.name;
    let uniqueName = originalName;
    let counter = 1;

    while (game.scenes.getName(uniqueName)) {
      uniqueName = `${originalName} (${counter})`;
      counter++;
    }

    if (uniqueName !== originalName) {
      console.log(
        `${MODULE_TITLE} | Scene "${originalName}" already exists, using name: "${uniqueName}"`
      );
      sceneData.name = uniqueName;
    }

    console.log(
      `${MODULE_TITLE} | Available remapped paths:`,
      Array.from(this.remappedPaths.entries())
    );

    // Resolve the Scene class through the document class lookup. The final
    // fallback uses `(globalThis as any).Scene`, NOT a bare `Scene` reference:
    // a bare identifier throws ReferenceError if the global has been removed.
    const SceneClass =
      (globalThis as any).getDocumentClass?.('Scene') ??
      (foundry as any).documents?.Scene ??
      (globalThis as any).Scene;

    // Remaps asset paths (legacy and v14 levels), migrates v13 data, creates the scene
    const { scene, backgroundSrc } = await importScenePackageData(sceneData, {
      SceneClass,
      resolvePath: path => resolveRemappedPath(this.remappedPaths, path)
    });

    ui.notifications.info(`Scene "${scene.name}" imported successfully!`);
    console.log(`${MODULE_TITLE} | Scene created successfully:`, scene.id, scene.name);

    const createdBackground = scene.initialLevel?.background?.src ?? null;
    console.log(`${MODULE_TITLE} | Scene background path:`, createdBackground);
    if (!createdBackground) {
      ui.notifications.warn(
        `Scene "${scene.name}" was imported without a map image${backgroundSrc ? '' : ' (none found in scene.json)'}. Check console for details.`
      );
    }

    // Generate thumbnail for the scene
    try {
      console.log(`${MODULE_TITLE} | Generating thumbnail for scene...`);
      const thumbData = await scene.createThumbnail();
      if (thumbData?.thumb) {
        await scene.update({ thumb: thumbData.thumb });
        console.log(`${MODULE_TITLE} | ✓ Thumbnail generated successfully`);
      }
    } catch (thumbError) {
      // Non-fatal, the scene was still created
      console.warn(`${MODULE_TITLE} | Failed to generate thumbnail:`, thumbError);
    }
  }

  /**
   * Cancel download
   */
  private _onCancelDownload(_event: Event, _target: HTMLElement): void {
    this.cancelled = true;
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
      this.cancelled = true;
      this.downloadManager.abort();
    }

    return super.close(options);
  }
}
