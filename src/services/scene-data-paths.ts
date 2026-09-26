/**
 * Scene Data Path Helpers
 *
 * Pure helpers for reading and rewriting asset paths inside serialized Scene
 * data (the object produced by `scene.toJSON()` and shipped as scene.json).
 *
 * Foundry v14 moved scene backgrounds, foregrounds and fog overlays off the
 * Scene and onto embedded Level documents (`levels[].background.src`,
 * `levels[].foreground.src`, `levels[].fog.src`, plus `initialLevel`). Map
 * packages may have been exported from either v13 or v14, so both shapes are
 * handled here.
 */

/**
 * Visitor invoked for every asset path found in scene data. Return a string to
 * replace the path in place; return anything else to leave it untouched.
 */
export type ScenePathVisitor = (path: string, location: string) => string | null | undefined | void;

export function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function forEachEntry(list: unknown, fn: (entry: any, index: number) => void): void {
  if (!Array.isArray(list)) return;
  list.forEach((entry, index) => {
    if (isPlainObject(entry)) fn(entry, index);
  });
}

/**
 * Walk every asset path in serialized scene data: legacy top-level textures,
 * v14 level textures, tiles, tokens and ambient sounds.
 */
export function visitScenePaths(sceneData: any, visit: ScenePathVisitor): void {
  if (!isPlainObject(sceneData)) return;

  const visitProp = (owner: any, key: string, location: string): void => {
    if (!isPlainObject(owner)) return;
    const value = owner[key];
    if (typeof value !== 'string' || !value) return;
    const next = visit(value, location);
    if (typeof next === 'string' && next !== value) owner[key] = next;
  };

  // Legacy (<= v13) top-level scene textures
  visitProp(sceneData.background, 'src', 'background.src');
  visitProp(sceneData, 'foreground', 'foreground');
  visitProp(sceneData.fog, 'overlay', 'fog.overlay');
  visitProp(sceneData, 'img', 'img');

  // v14 embedded levels
  forEachEntry(sceneData.levels, (level, i) => {
    visitProp(level.background, 'src', `levels[${i}].background.src`);
    visitProp(level.foreground, 'src', `levels[${i}].foreground.src`);
    visitProp(level.fog, 'src', `levels[${i}].fog.src`);
  });

  forEachEntry(sceneData.tiles, (tile, i) =>
    visitProp(tile.texture, 'src', `tiles[${i}].texture.src`)
  );
  forEachEntry(sceneData.tokens, (token, i) =>
    visitProp(token.texture, 'src', `tokens[${i}].texture.src`)
  );
  forEachEntry(sceneData.sounds, (sound, i) => visitProp(sound, 'path', `sounds[${i}].path`));
}

/** True for scene-level textures (map image, foreground, fog), as opposed to placeables. */
export function isSceneTextureLocation(location: string): boolean {
  return !/^(tiles|tokens|sounds)\[/.test(location);
}

function decodedBaseName(path: string): string {
  const name = path.split('/').pop() || path;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/**
 * Look up the remapped storage path for an original package path, trying the
 * exact key, its URL-decoded and URL-encoded forms, and finally an
 * unambiguous filename-only match (scene.json may carry absolute world paths
 * while manifest paths are package-relative).
 */
export function resolveRemappedPath(
  remappedPaths: Map<string, string>,
  originalPath: string
): string | null {
  if (remappedPaths.has(originalPath)) return remappedPaths.get(originalPath) || null;

  try {
    const decoded = decodeURIComponent(originalPath);
    if (remappedPaths.has(decoded)) return remappedPaths.get(decoded) || null;
  } catch {
    // Ignore malformed escape sequences
  }

  for (const encoded of [encodeURI(originalPath), encodeURIComponent(originalPath)]) {
    if (remappedPaths.has(encoded)) return remappedPaths.get(encoded) || null;
  }

  const baseName = decodedBaseName(originalPath);
  const candidates = new Set<string>();
  for (const [key, value] of remappedPaths) {
    if (decodedBaseName(key) === baseName) candidates.add(value);
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

/** The map image of the initial level in serialized scene data, if any. */
export function getInitialLevelBackgroundSrc(sceneData: any): string | null {
  if (!isPlainObject(sceneData) || !Array.isArray(sceneData.levels)) return null;
  const levels = sceneData.levels.filter(isPlainObject);
  const level = levels.find(l => l._id && l._id === sceneData.initialLevel) ?? levels[0];
  return level?.background?.src || null;
}
