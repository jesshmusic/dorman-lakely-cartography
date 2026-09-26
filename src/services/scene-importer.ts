/**
 * Scene Package Importer
 *
 * Turns a downloaded scene.json into a Scene document: rewrites asset paths
 * to their uploaded locations, migrates older (v13) data to the v14 schema,
 * then creates the scene.
 */

import { LOG_PREFIX } from '../constants';
import {
  getInitialLevelBackgroundSrc,
  isSceneTextureLocation,
  visitScenePaths
} from './scene-data-paths';
import { LegacyMigrationReport, migrateLegacySceneData } from './scene-migration';

export interface ScenePackageImportOptions {
  /** The Scene document class, e.g. `getDocumentClass('Scene')`. */
  SceneClass: any;
  /** Maps an original package path to its uploaded storage path, or null if unknown. */
  resolvePath: (path: string) => string | null;
}

export interface ScenePackageImportResult {
  scene: any;
  /** `core` if Foundry's own import migration ran, `module` if the local fallback did. */
  migratedBy: 'core' | 'module';
  fallbackReport: LegacyMigrationReport | null;
  /** Scene-level textures (map image, foreground, fog) with no uploaded file. */
  missingPaths: string[];
  /** Map image on the initial level of the created data. */
  backgroundSrc: string | null;
}

/**
 * Rewrite every asset path in scene data to its uploaded location.
 * @returns scene-level texture paths that could not be resolved
 */
export function remapSceneDataPaths(
  sceneData: any,
  resolvePath: (path: string) => string | null
): string[] {
  const missing: string[] = [];
  visitScenePaths(sceneData, (path, location) => {
    const newPath = resolvePath(path);
    if (newPath) {
      console.log(`${LOG_PREFIX} | ✓ ${location}: ${path} -> ${newPath}`);
      return newPath;
    }
    // Tiles/tokens/sounds may legitimately point at core or module assets
    if (isSceneTextureLocation(location)) missing.push(`${location}: ${path}`);
    return undefined;
  });
  return missing;
}

/**
 * Migrate scene data to the running core version.
 *
 * Prefers `Scene.fromImport()`, which is how core imports old JSON: it runs
 * the server's full migration registry (levels, tile anchors, occlusion
 * modes, regions, templates, fog, tokens). Falls back to the module's ports
 * of the most important migrations if that fails.
 */
export async function migrateSceneData(
  sceneData: any,
  SceneClass: any
): Promise<{ data: any; migratedBy: 'core' | 'module'; report: LegacyMigrationReport | null }> {
  try {
    if (typeof SceneClass?.fromImport !== 'function') {
      throw new Error('Scene.fromImport is not available');
    }
    // fromImport may clean its input in place; keep the original for the fallback
    const doc = await SceneClass.fromImport(structuredClone(sceneData));
    return { data: doc.toObject(), migratedBy: 'core', report: null };
  } catch (error) {
    console.warn(
      `${LOG_PREFIX} | Core scene migration failed, applying module fallback migration:`,
      error
    );
    const report = migrateLegacySceneData(sceneData);
    console.log(`${LOG_PREFIX} | Fallback migration report:`, report);
    return { data: sceneData, migratedBy: 'module', report };
  }
}

/**
 * Import parsed scene.json data as a new Scene. Throws if the scene cannot be
 * created so callers can report failure.
 */
export async function importScenePackageData(
  sceneData: any,
  { SceneClass, resolvePath }: ScenePackageImportOptions
): Promise<ScenePackageImportResult> {
  const missingPaths = remapSceneDataPaths(sceneData, resolvePath);
  for (const missing of missingPaths) {
    console.warn(`${LOG_PREFIX} | ✗ No uploaded file for ${missing}`);
  }

  const { data, migratedBy, report } = await migrateSceneData(sceneData, SceneClass);

  const backgroundSrc = getInitialLevelBackgroundSrc(data);
  console.log(`${LOG_PREFIX} | Final scene data before creation:`, {
    name: data.name,
    migratedBy,
    levels: data.levels?.length || 0,
    background: backgroundSrc,
    tiles: data.tiles?.length || 0,
    tokens: data.tokens?.length || 0,
    sounds: data.sounds?.length || 0
  });
  if (!backgroundSrc) {
    console.warn(`${LOG_PREFIX} | Scene "${data.name}" has no map image on its initial level`);
  }

  const scene = await SceneClass.create(data);
  if (!scene) throw new Error(`Creation of scene "${data.name}" was prevented`);

  return { scene, migratedBy, fallbackReport: report, missingPaths, backgroundSrc };
}
