#!/usr/bin/env node

/**
 * Pack Utilities for LevelDB Compendium Management
 * Converts between JSON source files and LevelDB format
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClassicLevel } from 'classic-level';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const PACKS_DIR = path.join(rootDir, 'packs');
const MAPS_DB = path.join(PACKS_DIR, 'maps');
const SOURCE_DIR = path.join(PACKS_DIR, '_source');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

/**
 * Clean pack entry by removing metadata
 */
function cleanPackEntry(entry) {
  const cleaned = { ...entry };

  // Remove permissions
  delete cleaned.permission;
  delete cleaned.permissions;
  cleaned.ownership = { default: 0 };

  // Remove flags
  delete cleaned.flags;

  // Remove source IDs
  if (cleaned._stats) {
    delete cleaned._stats.compendiumSource;
    delete cleaned._stats.sourceId;
  }

  // Remove default images
  if (cleaned.img === 'icons/svg/mystery-man.svg') {
    delete cleaned.img;
  }

  // Recursively clean nested items
  if (cleaned.items && Array.isArray(cleaned.items)) {
    cleaned.items = cleaned.items.map(cleanPackEntry);
  }

  // Clean effects
  if (cleaned.effects && Array.isArray(cleaned.effects)) {
    cleaned.effects = cleaned.effects.map(cleanPackEntry);
  }

  // Remove empty objects
  Object.keys(cleaned).forEach(key => {
    if (
      typeof cleaned[key] === 'object' &&
      cleaned[key] !== null &&
      !Array.isArray(cleaned[key]) &&
      Object.keys(cleaned[key]).length === 0
    ) {
      delete cleaned[key];
    }
  });

  return cleaned;
}

/**
 * Slugify a string for file names
 */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Unpack: Convert LevelDB to JSON files
 */
async function unpackDB() {
  console.log('Unpacking LevelDB to JSON...');

  // Check if DB exists
  if (!fs.existsSync(MAPS_DB)) {
    console.error(`Error: Database not found at ${MAPS_DB}`);
    process.exit(1);
  }

  // Create source directory
  if (!fs.existsSync(SOURCE_DIR)) {
    fs.mkdirSync(SOURCE_DIR, { recursive: true });
  }

  // Open LevelDB
  const db = new ClassicLevel(MAPS_DB, { valueEncoding: 'json' });
  await db.open();

  let count = 0;

  try {
    // Iterate through all entries
    for await (const [key, value] of db.iterator()) {
      // Clean the entry
      const cleaned = cleanPackEntry(value);

      // Generate filename
      const filename = `${slugify(cleaned.name || key)}_${key}.json`;
      const filepath = path.join(SOURCE_DIR, filename);

      // Write JSON file
      fs.writeFileSync(filepath, JSON.stringify(cleaned, null, 2) + '\n');

      count++;
    }

    console.log(`✓ Unpacked ${count} entries to ${SOURCE_DIR}`);
  } finally {
    await db.close();
  }
}

/**
 * Pack: Convert JSON files to LevelDB
 */
async function packDB() {
  console.log('Packing JSON files to LevelDB...');

  // Check if source directory exists
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Error: Source directory not found at ${SOURCE_DIR}`);
    process.exit(1);
  }

  // Clear existing DB
  if (fs.existsSync(MAPS_DB)) {
    fs.rmSync(MAPS_DB, { recursive: true, force: true });
  }

  // Create packs directory
  if (!fs.existsSync(PACKS_DIR)) {
    fs.mkdirSync(PACKS_DIR, { recursive: true });
  }

  // Open LevelDB
  const db = new ClassicLevel(MAPS_DB, { valueEncoding: 'json' });
  await db.open();

  let count = 0;

  try {
    // Read all JSON files
    const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filepath = path.join(SOURCE_DIR, file);
      const content = fs.readFileSync(filepath, 'utf8');
      const entry = JSON.parse(content);

      // Clean the entry
      const cleaned = cleanPackEntry(entry);

      // Extract ID from filename or use entry._id
      const id = entry._id || file.replace(/.*_([^_]+)\.json$/, '$1');

      // Write to DB
      await db.put(id, cleaned);

      count++;
    }

    console.log(`✓ Packed ${count} entries to ${MAPS_DB}`);
  } finally {
    await db.close();
  }
}

/**
 * Clean: Clean JSON files in place
 */
async function cleanJSON() {
  console.log('Cleaning JSON files...');

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Error: Source directory not found at ${SOURCE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.json'));
  let count = 0;

  for (const file of files) {
    const filepath = path.join(SOURCE_DIR, file);
    const content = fs.readFileSync(filepath, 'utf8');
    const entry = JSON.parse(content);

    // Clean the entry
    const cleaned = cleanPackEntry(entry);

    // Write back
    fs.writeFileSync(filepath, JSON.stringify(cleaned, null, 2) + '\n');

    count++;
  }

  console.log(`✓ Cleaned ${count} JSON files`);
}

/**
 * Main execution
 */
async function main() {
  try {
    switch (command) {
      case '--unpack':
      case '-u':
        await unpackDB();
        break;

      case '--pack':
      case '-p':
        await packDB();
        break;

      case '--clean':
      case '-c':
        await cleanJSON();
        break;

      default:
        console.log(`
Pack Utilities for Dorman Lakely Cartography

Usage:
  node utils/packs.mjs [command]

Commands:
  --unpack, -u    Extract LevelDB to JSON files
  --pack, -p      Convert JSON files to LevelDB
  --clean, -c     Clean JSON files (remove metadata)

Examples:
  npm run build:json    # Unpack DB to JSON
  npm run build:db      # Pack JSON to DB
  npm run build:clean   # Clean JSON files
        `);
        process.exit(0);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
