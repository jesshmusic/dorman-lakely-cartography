# Compendium Packs

This directory contains the LevelDB compendium packs for Dorman Lakely Cartography.

## Structure

- `maps/` - LevelDB database containing scene data
- `_source/` - JSON source files for version control

## Workflow

### 1. Extracting to JSON (for editing/version control)
```bash
npm run build:json
```

This extracts the LevelDB database to human-readable JSON files in `_source/`.

### 2. Converting back to LevelDB (for distribution)
```bash
npm run build:db
```

This converts the JSON files back into the LevelDB format that Foundry uses.

### 3. Cleaning JSON files
```bash
npm run build:clean
```

This removes metadata like permissions, flags, and source IDs from JSON files.

## Development Notes

- Always commit the `_source/` JSON files to git
- The `maps/` LevelDB directory should be in `.gitignore` (it's generated)
- Run `build:db` before releases to ensure the compendium is up-to-date
