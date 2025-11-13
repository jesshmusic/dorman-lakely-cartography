/**
 * Foundry Scene Package Exporter
 *
 * This script exports a scene with all its assets (images, tiles, tokens, audio)
 * into a single ZIP file ready for upload to Dorman Lakely Cartography.
 *
 * USAGE:
 * 1. Open Foundry VTT
 * 2. Press F12 to open browser console
 * 3. Copy and paste this entire script into the console
 * 4. Call: exportScenePackage("Your Scene Name")
 *
 * EXAMPLE:
 *   exportScenePackage("Dungeon Depths")
 *
 * The script will download a ZIP file containing:
 * - scene.json (scene configuration)
 * - background.webp (main map image)
 * - tiles/*.webp (all tile images)
 * - tokens/*.png (all token images)
 * - audio/*.mp3 (all sound files)
 */

async function exportScenePackage(sceneName) {
  // Find the scene
  const scene = game.scenes.getName(sceneName);
  if (!scene) {
    ui.notifications.error(`Scene "${sceneName}" not found. Check the spelling and try again.`);
    console.error(`Available scenes: ${game.scenes.map(s => s.name).join(', ')}`);
    return;
  }

  ui.notifications.info(`Starting export of "${scene.name}"...`);

  // Create JSZip instance
  const zip = new JSZip();

  // Add scene JSON
  const sceneData = scene.toJSON();
  zip.file('scene.json', JSON.stringify(sceneData, null, 2));
  console.log('✓ Added scene.json');

  // Collect all asset URLs from scene
  const assets = new Set();

  // Background
  if (scene.background?.src) {
    assets.add(scene.background.src);
    console.log(`Found background: ${scene.background.src}`);
  }

  // Tiles
  scene.tiles.forEach(tile => {
    if (tile.texture?.src) {
      assets.add(tile.texture.src);
    }
  });
  console.log(`Found ${scene.tiles.size} tiles`);

  // Tokens
  scene.tokens.forEach(token => {
    if (token.texture?.src) {
      assets.add(token.texture.src);
    }
  });
  console.log(`Found ${scene.tokens.size} tokens`);

  // Sounds
  scene.sounds.forEach(sound => {
    if (sound.path) {
      assets.add(sound.path);
    }
  });
  console.log(`Found ${scene.sounds.size} sounds`);

  console.log(`\nTotal assets to download: ${assets.size}`);

  // Download each asset and add to ZIP
  let count = 0;
  let failed = 0;

  for (const assetPath of assets) {
    try {
      // Fetch the file
      const response = await fetch(assetPath);
      if (!response.ok) {
        console.warn(`Failed to fetch ${assetPath}: ${response.status}`);
        failed++;
        continue;
      }

      const blob = await response.blob();
      const filename = assetPath.split('/').pop();

      // Determine folder based on path or file type
      let folder = '';
      if (assetPath.includes('/tiles/')) {
        folder = 'tiles/';
      } else if (assetPath.includes('/tokens/')) {
        folder = 'tokens/';
      } else if (assetPath.match(/\.(mp3|ogg|wav|webm|m4a|flac)$/i)) {
        folder = 'audio/';
      }

      // Add to ZIP
      zip.file(folder + filename, blob);
      count++;

      // Show progress notification every 5 files
      if (count % 5 === 0) {
        ui.notifications.info(`Packed ${count}/${assets.size} assets...`);
      }

      console.log(`✓ [${count}/${assets.size}] ${folder}${filename}`);
    } catch (err) {
      console.error(`Failed to pack ${assetPath}:`, err);
      failed++;
    }
  }

  // Summary
  console.log(`\nPackaging complete:`);
  console.log(`  ✓ Packed: ${count} assets`);
  if (failed > 0) {
    console.log(`  ✗ Failed: ${failed} assets`);
    ui.notifications.warn(`Packed ${count} assets, but ${failed} failed. Check console for details.`);
  }

  // Generate ZIP file
  ui.notifications.info('Generating ZIP file...');
  console.log('Generating ZIP archive...');

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  // Calculate size
  const sizeMB = (zipBlob.size / 1024 / 1024).toFixed(2);
  console.log(`ZIP size: ${sizeMB} MB`);

  // Download the ZIP
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${scene.name.slugify()}-package.zip`;
  link.click();

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  ui.notifications.success(`Scene package exported! (${sizeMB} MB)`);
  console.log(`✓ Download started: ${scene.name.slugify()}-package.zip`);
  console.log('\nNext steps:');
  console.log('1. Locate the downloaded ZIP file');
  console.log('2. Open Dorman Lakely Cartography admin: http://localhost:3000/v1/maps-admin');
  console.log('3. Create a new map or edit existing');
  console.log('4. Upload the ZIP file');
  console.log('5. Add description, tags, and publish!');
}

// List available scenes for convenience
function listScenes() {
  console.log('Available scenes:');
  game.scenes.forEach((scene, index) => {
    console.log(`  ${index + 1}. "${scene.name}"`);
  });
  console.log('\nUsage: exportScenePackage("Scene Name")');
}

// Show usage info
console.log('%c⚔️ Scene Package Exporter Loaded', 'color: #d32f2f; font-weight: bold; font-size: 16px;');
console.log('%cUsage:', 'font-weight: bold;');
console.log('  exportScenePackage("Scene Name") - Export a scene as ZIP package');
console.log('  listScenes()                     - List all available scenes');
console.log('\n%cExample:', 'font-weight: bold;');
console.log('  exportScenePackage("Dungeon Depths")');
