# Dorman Lakely Cartography - Export Scripts

This folder contains scripts to help content creators package their Foundry VTT scenes for distribution.

## Scene Package Exporter

**File:** `export-scene-package.js`

### Purpose

Exports a complete Foundry scene with all assets (background, tiles, tokens, audio) into a single ZIP file ready for upload to the Dorman Lakely Cartography admin panel.

### How to Use

#### Method 1: Right-Click Export (Built-in, Easiest!)

**The module includes a built-in export feature:**

1. **Open Foundry VTT** with the Dorman Lakely Cartography module enabled
2. **Go to Scenes Directory** (map icon in sidebar)
3. **Right-click the scene** you want to export
4. **Select "Export for Dorman Lakely Cartography"** from the context menu
5. **Wait for the export** (progress notifications will appear)
6. **ZIP file downloads automatically!**

**This is the recommended method** - no console commands needed!

---

#### Method 2: Console Script (Advanced/Fallback)

If you need to use the console script directly:

1. **Open Foundry VTT** in your browser
2. **Open the scene** you want to export (or just have Foundry running)
3. **Open Browser Console** (Press F12, then click "Console" tab)
4. **Copy the entire script** from `export-scene-package.js`
5. **Paste it into the console** and press Enter
6. **Run the export command:**
   ```javascript
   exportScenePackage("Your Scene Name")
   ```

### Example

```javascript
// List all available scenes
listScenes()

// Export a specific scene
exportScenePackage("Dungeon Depths")
```

### What Gets Packaged

The script creates a ZIP file containing:

```
dungeon-depths-package.zip
├── scene.json          # Scene configuration (walls, lights, etc.)
├── background.webp     # Main map image
├── tiles/              # All tile overlays
│   ├── torch-1.webp
│   └── door.png
├── tokens/             # All token images
│   └── goblin.png
└── audio/              # All sound files
    └── ambient.mp3
```

### Output

- **File name:** `{scene-name-slugified}-package.zip`
- **Location:** Your browser's default download folder
- **Size:** Varies (typically 1-50 MB depending on assets)

### Next Steps

After exporting:

1. Locate the downloaded ZIP file
2. Open [Foundry Maps Admin](http://localhost:3000/v1/maps-admin)
3. Click "New Map" or edit an existing map
4. Fill in the map details (name, description, tags)
5. Upload the ZIP file in the "Upload Scene Package" section
6. Click "Create Map" or "Update Map"

The system will automatically:
- Extract all files from the ZIP
- Update asset paths in scene.json
- Upload everything to S3/Cloudflare R2
- Create database records for each file
- Make the map available in the Foundry module gallery

## Troubleshooting

### "Scene not found" error

- Check the exact spelling of your scene name (case-sensitive)
- Use `listScenes()` to see all available scenes
- Make sure you're in the correct Foundry world

### Assets fail to download

- Check browser console for specific errors
- Verify all assets are accessible (not in private folders)
- Try exporting with fewer assets first to isolate the issue

### ZIP file is very large

- Optimize images before importing into Foundry
  - Use WebP format (50-70% smaller than PNG)
  - Resize to maximum 4096x4096 pixels
  - Use 80-85% quality setting
- Compress audio files
  - Use OGG or MP3 format
  - 96-128kbps bitrate for ambient sounds
  - Trim silence from start/end

### Script not working

- Make sure JSZip is available (it's bundled with Foundry)
- Check for browser console errors
- Try refreshing Foundry and running the script again
- Ensure you're using a modern browser (Chrome, Firefox, Edge)

## Advanced Usage

### Customizing the Export

You can modify the script to:

- Change folder structure
- Add custom metadata to scene.json
- Filter which assets to include
- Add additional files (notes, images, etc.)

### Batch Export

To export multiple scenes:

```javascript
const sceneNames = ["Dungeon Level 1", "Dungeon Level 2", "Dungeon Level 3"];

for (const sceneName of sceneNames) {
  await exportScenePackage(sceneName);
  // Wait 2 seconds between exports to avoid overwhelming the browser
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

## Support

For issues or questions:
- Check the main [MAP_PACKAGING_GUIDE.md](../../../../../../../Code/dungeon-master-guru/MAP_PACKAGING_GUIDE.md) documentation
- Review [FOUNDRY_SCENE_FORMAT.md](../../../../../../../Code/dungeon-master-guru/FOUNDRY_SCENE_FORMAT.md) for format details
- Open an issue on GitHub
