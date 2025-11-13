import { LOG_PREFIX } from '../constants';
import JSZip from 'jszip';

/**
 * Scene Exporter Service
 *
 * Exports a Foundry scene with all its assets into a ZIP package
 * ready for upload to Dorman Lakely Cartography admin.
 */
export class SceneExporter {
  /**
   * Export a scene as a ZIP package
   * @param scene The scene to export
   */
  static async exportScene(scene: Scene): Promise<void> {
    try {
      ui.notifications?.info(`Starting export of "${scene.name}"...`);
      console.log(`${LOG_PREFIX} | Exporting scene: ${scene.name}`);

      // Create JSZip instance
      const zip = new JSZip();

      // Get scene data (will update paths later)
      const sceneData = scene.toJSON();

      // Collect all asset URLs from scene
      const assets = new Set<string>();
      const pathMapping = new Map<string, string>(); // original -> new path with underscores

      // Background
      if (scene.background?.src) {
        assets.add(scene.background.src);
        console.log(`${LOG_PREFIX} | Found background: ${scene.background.src}`);
      }

      // Tiles
      scene.tiles.forEach((tile: any) => {
        if (tile.texture?.src) {
          assets.add(tile.texture.src);
        }
      });
      console.log(`${LOG_PREFIX} | Found ${scene.tiles.size} tiles`);

      // Tokens
      scene.tokens.forEach((token: any) => {
        if (token.texture?.src) {
          assets.add(token.texture.src);
        }
      });
      console.log(`${LOG_PREFIX} | Found ${scene.tokens.size} tokens`);

      // Sounds
      scene.sounds.forEach((sound: any) => {
        if (sound.path) {
          assets.add(sound.path);
        }
      });
      console.log(`${LOG_PREFIX} | Found ${scene.sounds.size} sounds`);

      console.log(`${LOG_PREFIX} | Total assets to download: ${assets.size}`);

      // Download each asset and add to ZIP
      let count = 0;
      let failed = 0;

      for (const assetPath of assets) {
        try {
          // Fetch the file
          const response = await fetch(assetPath);
          if (!response.ok) {
            console.warn(`${LOG_PREFIX} | Failed to fetch ${assetPath}: ${response.status}`);
            failed++;
            continue;
          }

          const blob = await response.blob();
          const filename = assetPath.split('/').pop() || 'unknown';

          // Replace spaces with underscores in filename
          const cleanFilename = filename.replace(/\s+/g, '_');

          // Determine folder based on path or file type
          let folder = '';
          if (assetPath.includes('/tiles/')) {
            folder = 'tiles/';
          } else if (assetPath.includes('/tokens/')) {
            folder = 'tokens/';
          } else if (assetPath.match(/\.(mp3|ogg|wav|webm|m4a|flac)$/i)) {
            folder = 'audio/';
          }

          // Store path mapping for scene.json updates
          pathMapping.set(assetPath, folder + cleanFilename);

          // Add to ZIP
          zip.file(folder + cleanFilename, blob);
          count++;

          // Show progress notification every 5 files
          if (count % 5 === 0) {
            ui.notifications?.info(`Packed ${count}/${assets.size} assets...`);
          }

          console.log(`${LOG_PREFIX} | ✓ [${count}/${assets.size}] ${folder}${filename}`);
        } catch (err) {
          console.error(`${LOG_PREFIX} | Failed to pack ${assetPath}:`, err);
          failed++;
        }
      }

      // Summary
      console.log(`${LOG_PREFIX} | Packaging complete:`);
      console.log(`${LOG_PREFIX} |   ✓ Packed: ${count} assets`);
      if (failed > 0) {
        console.log(`${LOG_PREFIX} |   ✗ Failed: ${failed} assets`);
        ui.notifications?.warn(
          `Packed ${count} assets, but ${failed} failed. Check console for details.`
        );
      }

      // Update scene data paths to use clean filenames
      console.log(`${LOG_PREFIX} | Updating scene.json paths...`);
      this.updateSceneDataPaths(sceneData, pathMapping);

      // Add updated scene.json to ZIP
      zip.file('scene.json', JSON.stringify(sceneData, null, 2));
      console.log(`${LOG_PREFIX} | ✓ Added scene.json with updated paths`);

      // Generate ZIP file
      ui.notifications?.info('Generating ZIP file...');
      console.log(`${LOG_PREFIX} | Generating ZIP archive...`);

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Calculate size
      const sizeMB = (zipBlob.size / 1024 / 1024).toFixed(2);
      console.log(`${LOG_PREFIX} | ZIP size: ${sizeMB} MB`);

      // Download the ZIP
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${scene.name.slugify()}-package.zip`;
      link.click();

      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      ui.notifications?.success(`Scene package exported! (${sizeMB} MB)`);
      console.log(`${LOG_PREFIX} | ✓ Download started: ${scene.name.slugify()}-package.zip`);
      console.log(`${LOG_PREFIX} | Next steps:`);
      console.log(`${LOG_PREFIX} | 1. Locate the downloaded ZIP file`);
      console.log(`${LOG_PREFIX} | 2. Open admin: http://localhost:3000/v1/maps-admin`);
      console.log(`${LOG_PREFIX} | 3. Create/edit a map and upload the ZIP`);
    } catch (error) {
      console.error(`${LOG_PREFIX} | Export failed:`, error);
      ui.notifications?.error(
        `Failed to export scene: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update all asset paths in scene data to use clean filenames
   */
  private static updateSceneDataPaths(sceneData: any, pathMapping: Map<string, string>): void {
    // Update background
    if (sceneData.background?.src && pathMapping.has(sceneData.background.src)) {
      sceneData.background.src = pathMapping.get(sceneData.background.src);
      console.log(`${LOG_PREFIX} | Updated background path`);
    }

    // Update tiles
    if (sceneData.tiles && Array.isArray(sceneData.tiles)) {
      for (const tile of sceneData.tiles) {
        if (tile.texture?.src && pathMapping.has(tile.texture.src)) {
          tile.texture.src = pathMapping.get(tile.texture.src);
        }
      }
      console.log(`${LOG_PREFIX} | Updated ${sceneData.tiles.length} tile paths`);
    }

    // Update tokens
    if (sceneData.tokens && Array.isArray(sceneData.tokens)) {
      for (const token of sceneData.tokens) {
        if (token.texture?.src && pathMapping.has(token.texture.src)) {
          token.texture.src = pathMapping.get(token.texture.src);
        }
      }
      console.log(`${LOG_PREFIX} | Updated ${sceneData.tokens.length} token paths`);
    }

    // Update sounds
    if (sceneData.sounds && Array.isArray(sceneData.sounds)) {
      for (const sound of sceneData.sounds) {
        if (sound.path && pathMapping.has(sound.path)) {
          sound.path = pathMapping.get(sound.path);
        }
      }
      console.log(`${LOG_PREFIX} | Updated ${sceneData.sounds.length} sound paths`);
    }
  }

  /**
   * Check if JSZip is available
   */
  static isAvailable(): boolean {
    // JSZip is now bundled with the module
    return true;
  }
}
