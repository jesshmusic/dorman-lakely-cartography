/**
 * Download Dialog
 * Manages the download process for a single map with progress tracking
 * Uses ApplicationV2 (Foundry v12+ modern application API)
 */

import { DLCMap, DLCFile, DownloadStatus } from '../types/module';
import { APIService } from '../services/api-service';
import { FileUploadService } from '../services/file-upload-service';
import { ConcurrentDownloadManager } from '../services/concurrent-download-manager';
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
      progress: this.progress,
      files: this.files,
      downloadPath,
      hasFiles: this.files.length > 0
    };
  }

  override async _onRender(_context: any, _options: any): Promise<void> {
    // Auto-load file manifest and start download when dialog opens
    if (this.files.length === 0 && !this.downloading && !this.completed) {
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
          },
          onComplete: results => {
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
      ui.notifications.error(
        error instanceof Error ? error.message : 'Download failed. Please try again.'
      );
      this.downloading = false;
      this.render(false);
    }
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
        ui.notifications.error(
          'Files downloaded but scene import failed. Check console for details.'
        );
      }
    } else {
      ui.notifications.error(
        `Download failed: ${successCount} succeeded, ${failCount} failed. Check console for details.`
      );
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
   * Import scene.json to create the scene in Foundry
   */
  private async importScene(results: any[]): Promise<void> {
    try {
      console.log(`${MODULE_TITLE} | Starting scene import, checking ${results.length} files`);
      console.log(
        `${MODULE_TITLE} | Results:`,
        results.map(r => ({ path: r.file.path, status: r.status }))
      );

      // Check if we have the scene.json blob
      if (!this.sceneJsonBlob) {
        console.warn(`${MODULE_TITLE} | No scene.json blob found in memory`);
        ui.notifications.warn('No scene.json found in package. Scene not imported.');
        return;
      }

      console.log(
        `${MODULE_TITLE} | Using scene.json blob from memory (${this.sceneJsonBlob.size} bytes)`
      );

      // Parse the scene.json blob
      const sceneText = await this.sceneJsonBlob.text();
      const sceneData = JSON.parse(sceneText);
      console.log(`${MODULE_TITLE} | Parsed scene data:`, {
        name: sceneData.name,
        width: sceneData.width,
        height: sceneData.height
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

      // Update all asset paths in the scene data to match new folder structure
      console.log(`${MODULE_TITLE} | Updating asset paths in scene data...`);
      this.updateScenePaths(sceneData);

      // Log final scene data for debugging
      console.log(`${MODULE_TITLE} | Final scene data before creation:`, {
        name: sceneData.name,
        background: sceneData.background?.src,
        tiles: sceneData.tiles?.length || 0,
        tokens: sceneData.tokens?.length || 0,
        sounds: sceneData.sounds?.length || 0
      });

      // Create the scene
      console.log(`${MODULE_TITLE} | Creating scene: ${sceneData.name}`);
      const scene = await Scene.create(sceneData);

      if (scene) {
        ui.notifications.info(`Scene "${sceneData.name}" imported successfully!`);
        console.log(`${MODULE_TITLE} | Scene created successfully:`, scene.id, scene.name);

        // Log the actual paths Foundry is using
        console.log(`${MODULE_TITLE} | Scene background path:`, scene.background?.src);
      }
    } catch (error) {
      console.error(`${MODULE_TITLE} | Error importing scene:`, error);
      if (error instanceof Error) {
        console.error(`${MODULE_TITLE} | Error stack:`, error.stack);
      }
      ui.notifications.error(
        `Failed to import scene: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Helper to find remapped path with encoding fallbacks
   */
  private findRemappedPath(originalPath: string): string | null {
    // Try exact match first
    if (this.remappedPaths.has(originalPath)) {
      return this.remappedPaths.get(originalPath) || null;
    }

    // Try URL-decoded version
    try {
      const decoded = decodeURIComponent(originalPath);
      if (this.remappedPaths.has(decoded)) {
        return this.remappedPaths.get(decoded) || null;
      }
    } catch {
      // Ignore decode errors
    }

    // Try URL-encoded version
    try {
      const encoded = encodeURIComponent(originalPath);
      if (this.remappedPaths.has(encoded)) {
        return this.remappedPaths.get(encoded) || null;
      }
    } catch {
      // Ignore encode errors
    }

    return null;
  }

  /**
   * Update all asset paths in scene data to match new folder structure
   */
  private updateScenePaths(sceneData: any): void {
    try {
      console.log(`${MODULE_TITLE} | Updating paths in scene data...`);
      console.log(
        `${MODULE_TITLE} | Available remapped paths:`,
        Array.from(this.remappedPaths.entries())
      );

      // Update background image
      try {
        if (sceneData.background?.src) {
          const originalPath = sceneData.background.src;
          console.log(`${MODULE_TITLE} | Looking up background path: "${originalPath}"`);

          const newPath = this.findRemappedPath(originalPath);
          if (newPath) {
            console.log(`${MODULE_TITLE} | ✓ Background updated: ${originalPath} -> ${newPath}`);
            sceneData.background.src = newPath;
          } else {
            console.warn(`${MODULE_TITLE} | ✗ No mapping found for background: "${originalPath}"`);
            console.warn(
              `${MODULE_TITLE} | Available keys:`,
              Array.from(this.remappedPaths.keys())
            );
          }
        }
      } catch (error) {
        console.warn(`${MODULE_TITLE} | Failed to update background path:`, error);
      }

      // Update tiles
      try {
        if (sceneData.tiles && Array.isArray(sceneData.tiles)) {
          for (const tile of sceneData.tiles) {
            try {
              if (tile.texture?.src) {
                const newPath = this.findRemappedPath(tile.texture.src);
                if (newPath) {
                  console.log(`${MODULE_TITLE} | Tile: ${tile.texture.src} -> ${newPath}`);
                  tile.texture.src = newPath;
                }
              }
            } catch (error) {
              console.warn(`${MODULE_TITLE} | Failed to update tile path:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`${MODULE_TITLE} | Failed to process tiles:`, error);
      }

      // Update tokens
      try {
        if (sceneData.tokens && Array.isArray(sceneData.tokens)) {
          for (const token of sceneData.tokens) {
            try {
              if (token.texture?.src) {
                const newPath = this.findRemappedPath(token.texture.src);
                if (newPath) {
                  console.log(`${MODULE_TITLE} | Token: ${token.texture.src} -> ${newPath}`);
                  token.texture.src = newPath;
                }
              }
            } catch (error) {
              console.warn(`${MODULE_TITLE} | Failed to update token path:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`${MODULE_TITLE} | Failed to process tokens:`, error);
      }

      // Update sounds/audio
      try {
        if (sceneData.sounds && Array.isArray(sceneData.sounds)) {
          for (const sound of sceneData.sounds) {
            try {
              if (sound.path) {
                const newPath = this.findRemappedPath(sound.path);
                if (newPath) {
                  console.log(`${MODULE_TITLE} | Sound: ${sound.path} -> ${newPath}`);
                  sound.path = newPath;
                }
              }
            } catch (error) {
              console.warn(`${MODULE_TITLE} | Failed to update sound path:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`${MODULE_TITLE} | Failed to process sounds:`, error);
      }

      console.log(`${MODULE_TITLE} | ✓ Path updates complete`);
    } catch (error) {
      console.error(`${MODULE_TITLE} | Error updating scene paths:`, error);
      throw error;
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
