/**
 * Legacy Scene Data Migration (v13 -> v14)
 *
 * Map packages exported from Foundry v13 carry v13-shaped scene.json data.
 * Foundry v14 only migrates such data on the server: during world migration,
 * or when a client calls `Scene.fromImport()` (which round-trips the data
 * through the server's `migrateDocumentData` socket handler). Plain
 * `Scene.create()` skips those migrations entirely.
 *
 * The importer uses `Scene.fromImport()` first. The functions here are a
 * fallback for when that fails. Each one is a port of the matching migration
 * in Foundry 14's server (`dist/database/documents/*.mjs`) and is applied
 * under the same core-version threshold, so results match a native world
 * migration.
 */

import { isPlainObject } from './scene-data-paths';

/** `foundry.documents.BaseScene.metadata.defaultLevelId` in v14. */
export const DEFAULT_LEVEL_ID = 'defaultLevel0000';

/** Core version thresholds from the v14 server migration registries. */
export const MIGRATION_VERSIONS = Object.freeze({
  sceneLevels: '14.353', // Scene.migrateLevels
  sceneFogExploration: '14.353', // Scene.migrateFogExploration
  tilePosition: '14.349', // Tile.migratePosition
  tileOcclusionModes: '14.355', // Tile.migrateOcclusionMode
  regionRotatedRectangles: '14.349' // Region.migrateRotatedRectangles
});

/** `CONST.FOG_EXPLORATION_MODES` in v14. */
const FOG_EXPLORATION_MODES = Object.freeze({ DISABLED: 0, INDIVIDUAL: 1 });

/**
 * Equivalent of `foundry.utils.isNewerVersion(v1, v0)`: true if v1 is newer
 * than v0, comparing dot-separated numeric parts.
 */
export function isNewerVersion(v1: string | number, v0: string | number): boolean {
  const a = String(v1).split('.').map(Number);
  const b = String(v0).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = Number.isFinite(a[i]) ? a[i] : 0;
    const y = Number.isFinite(b[i]) ? b[i] : 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * The core version scene data was exported from.
 *
 * Falls back to a heuristic when `_stats.coreVersion` is missing: data with
 * `levels` is treated as current (`null`), data without is treated as legacy.
 */
export function getSceneCoreVersion(sceneData: any): string | null {
  const coreVersion = sceneData?._stats?.coreVersion;
  if (typeof coreVersion === 'string' && coreVersion) return coreVersion;
  const hasLevels = Array.isArray(sceneData?.levels) && sceneData.levels.length > 0;
  return hasLevels ? null : '0';
}

/** Whether data from `coreVersion` predates the migration introduced at `threshold`. */
export function needsMigration(threshold: string, coreVersion: string | null): boolean {
  return coreVersion !== null && isNewerVersion(threshold, coreVersion);
}

/** True if scene data predates Foundry v14 levels. */
export function isPreV14SceneData(sceneData: any): boolean {
  return needsMigration(MIGRATION_VERSIONS.sceneLevels, getSceneCoreVersion(sceneData));
}

/**
 * Port of Scene.migrateLevels: move the legacy top-level background,
 * foreground, foreground elevation and fog overlay onto a default Level and
 * make it the initial level. If levels already exist, only missing textures
 * on the initial level are back-filled. Legacy keys are removed either way.
 *
 * @returns true if the data changed
 */
export function migrateSceneLevels(sceneData: any): boolean {
  if (!isPlainObject(sceneData)) return false;

  const { background, backgroundColor, foreground, foregroundElevation, fog, name } = sceneData;
  const legacyBackgroundSrc =
    (isPlainObject(background) && background.src) ||
    (typeof sceneData.img === 'string' && sceneData.img) || // pre-v10 scenes
    null;
  const hadLegacyKeys =
    ['background', 'backgroundColor', 'foreground', 'foregroundElevation', 'img'].some(
      key => key in sceneData
    ) ||
    (isPlainObject(fog) && 'overlay' in fog);
  const levels: any[] = Array.isArray(sceneData.levels) ? sceneData.levels : [];
  let changed = false;

  if (levels.length === 0) {
    const level: Record<string, any> = { _id: DEFAULT_LEVEL_ID, name: name || 'Level' };
    if (legacyBackgroundSrc || backgroundColor) level.background = {};
    if (backgroundColor) level.background.color = backgroundColor;
    if (legacyBackgroundSrc) level.background.src = legacyBackgroundSrc;
    if (isPlainObject(background)) {
      if (typeof background.offsetX === 'number') sceneData.shiftX = background.offsetX;
      if (typeof background.offsetY === 'number') sceneData.shiftY = background.offsetY;
    }
    if (foreground) level.foreground = { src: foreground };
    if (foregroundElevation) level.elevation = { top: foregroundElevation };
    if (isPlainObject(fog) && fog.overlay) level.fog = { src: fog.overlay };
    sceneData.levels = [level];
    sceneData.initialLevel = DEFAULT_LEVEL_ID;
    changed = true;
  } else {
    // Hybrid data: levels exist but the map image only survives on legacy keys
    const target =
      levels.find(l => isPlainObject(l) && l._id && l._id === sceneData.initialLevel) ??
      levels.find(isPlainObject);
    if (target) {
      const backfill: Array<[string, unknown]> = [
        ['background', legacyBackgroundSrc],
        ['foreground', foreground],
        ['fog', isPlainObject(fog) ? fog.overlay : null]
      ];
      for (const [key, src] of backfill) {
        if (!src || target[key]?.src) continue;
        target[key] = { ...(isPlainObject(target[key]) ? target[key] : {}), src };
        changed = true;
      }
    }
  }

  delete sceneData.background;
  delete sceneData.backgroundColor;
  delete sceneData.foreground;
  delete sceneData.foregroundElevation;
  delete sceneData.img;
  if (isPlainObject(sceneData.fog)) delete sceneData.fog.overlay;

  return changed || hadLegacyKeys;
}

/** Port of Scene.migrateFogExploration: boolean `fog.exploration` -> `fog.mode`. */
export function migrateSceneFogExploration(sceneData: any): boolean {
  const fog = sceneData?.fog;
  if (!isPlainObject(fog) || fog.exploration === undefined) return false;
  const mode = fog.exploration ? FOG_EXPLORATION_MODES.INDIVIDUAL : FOG_EXPLORATION_MODES.DISABLED;
  delete fog.exploration;
  fog.mode = mode;
  return true;
}

/**
 * Port of Tile.migratePosition.
 *
 * v13 tiles were positioned by their top-left corner and rotated about their
 * centre; the texture anchor only placed the texture inside the frame. v14
 * positions the tile mesh at (x, y) using the texture anchor as the origin.
 * Unrotated tiles keep x/y and shift the anchor by -0.5 (0.5 -> 0); rotated
 * tiles keep the anchor and move x/y to the centre so they still rotate
 * about it.
 */
export function migrateTilePosition(tile: any): boolean {
  if (!isPlainObject(tile)) return false;
  if (!isPlainObject(tile.texture)) tile.texture = {};
  tile.texture.anchorX ??= 0.5;
  tile.texture.anchorY ??= 0.5;
  if (tile.rotation === 0) {
    tile.texture.anchorX -= 0.5;
    tile.texture.anchorY -= 0.5;
  } else {
    tile.x = Math.round((tile.x ?? 0) + (tile.width ?? 0) / 2);
    tile.y = Math.round((tile.y ?? 0) + (tile.height ?? 0) / 2);
  }
  return true;
}

/** Port of Tile.migrateOcclusionMode: single `occlusion.mode` -> `occlusion.modes` bitmask list. */
export function migrateTileOcclusionMode(tile: any): boolean {
  const occlusion = tile?.occlusion;
  if (!isPlainObject(occlusion)) return false;
  occlusion.modes = occlusion.mode > 0 ? [1 << (occlusion.mode - 1)] : [];
  delete occlusion.mode;
  return true;
}

/** Port of Region.migrateRotatedRectangles: rotated rectangles become centre-anchored. */
export function migrateRegionRotatedRectangles(region: any): boolean {
  if (!isPlainObject(region) || !Array.isArray(region.shapes)) return false;
  let changed = false;
  for (const shape of region.shapes) {
    if (!isPlainObject(shape) || shape.type !== 'rectangle' || shape.rotation === 0) continue;
    shape.x += shape.width / 2;
    shape.y += shape.height / 2;
    shape.anchorX = shape.anchorY = 0.5;
    changed = true;
  }
  return changed;
}

/** Version of an embedded record: its own `_stats`, else the parent scene's. */
function embeddedCoreVersion(record: any, sceneVersion: string | null): string | null {
  const own = record?._stats?.coreVersion;
  return typeof own === 'string' && own ? own : sceneVersion;
}

export interface LegacyMigrationReport {
  coreVersion: string | null;
  levels: boolean;
  fogExploration: boolean;
  tilesRepositioned: number;
  tileOcclusion: number;
  regionsReshaped: number;
}

/**
 * Apply the local v13 -> v14 migrations to scene data in place. Each step only
 * runs when the data predates the core migration it mirrors, so v14 data is
 * left untouched.
 */
export function migrateLegacySceneData(sceneData: any): LegacyMigrationReport {
  const coreVersion = getSceneCoreVersion(sceneData);
  const report: LegacyMigrationReport = {
    coreVersion,
    levels: false,
    fogExploration: false,
    tilesRepositioned: 0,
    tileOcclusion: 0,
    regionsReshaped: 0
  };
  if (!isPlainObject(sceneData)) return report;

  if (needsMigration(MIGRATION_VERSIONS.sceneLevels, coreVersion)) {
    report.levels = migrateSceneLevels(sceneData);
  }
  if (needsMigration(MIGRATION_VERSIONS.sceneFogExploration, coreVersion)) {
    report.fogExploration = migrateSceneFogExploration(sceneData);
  }

  for (const tile of Array.isArray(sceneData.tiles) ? sceneData.tiles : []) {
    const version = embeddedCoreVersion(tile, coreVersion);
    if (needsMigration(MIGRATION_VERSIONS.tilePosition, version) && migrateTilePosition(tile)) {
      report.tilesRepositioned++;
    }
    if (
      needsMigration(MIGRATION_VERSIONS.tileOcclusionModes, version) &&
      migrateTileOcclusionMode(tile)
    ) {
      report.tileOcclusion++;
    }
  }

  for (const region of Array.isArray(sceneData.regions) ? sceneData.regions : []) {
    const version = embeddedCoreVersion(region, coreVersion);
    if (
      needsMigration(MIGRATION_VERSIONS.regionRotatedRectangles, version) &&
      migrateRegionRotatedRectangles(region)
    ) {
      report.regionsReshaped++;
    }
  }

  return report;
}
