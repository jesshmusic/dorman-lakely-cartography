/**
 * Scene package importer tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  importScenePackageData,
  migrateSceneData,
  remapSceneDataPaths
} from '../../src/services/scene-importer';
import { resolveRemappedPath } from '../../src/services/scene-data-paths';

const BASE = 'Dorman Lakely Cartography/Maps/dragon-lair-cave';

const remapped = new Map<string, string>([
  ['White Dragon Lair.webp', `${BASE}/Maps/White Dragon Lair.webp`],
  ['tiles/Ice Pillar.webp', `${BASE}/Tiles/Ice Pillar.webp`]
]);
const resolvePath = (path: string) => resolveRemappedPath(remapped, path);

function v13SceneJson(): any {
  return {
    _id: 'sourceSceneId000',
    name: 'White Dragon Lair',
    _stats: { coreVersion: '13.351' },
    background: { src: 'White Dragon Lair.webp', offsetX: 0, offsetY: 0 },
    tiles: [
      {
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rotation: 0,
        texture: { src: 'tiles/Ice Pillar.webp', anchorX: 0.5, anchorY: 0.5 }
      }
    ],
    walls: new Array(3).fill({ c: [0, 0, 1, 1] })
  };
}

function v14SceneJson(): any {
  return {
    name: 'White Dragon Lair',
    _stats: { coreVersion: '14.368' },
    initialLevel: 'defaultLevel0000',
    levels: [
      { _id: 'defaultLevel0000', name: 'Level', background: { src: 'White Dragon Lair.webp' } }
    ],
    tiles: []
  };
}

/** Minimal stand-in for the v14 Scene document class */
function makeSceneClass({ fromImport }: { fromImport?: (source: any) => any } = {}) {
  const created: any[] = [];
  const SceneClass: any = {
    create: jest.fn(async (data: any) => {
      created.push(data);
      return { id: 'newSceneId000000', name: data.name, data };
    })
  };
  if (fromImport) SceneClass.fromImport = jest.fn(async (source: any) => fromImport(source));
  return { SceneClass, created };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('remapSceneDataPaths', () => {
  it('rewrites v14 level backgrounds to the uploaded path', () => {
    const scene = v14SceneJson();
    expect(remapSceneDataPaths(scene, resolvePath)).toEqual([]);
    expect(scene.levels[0].background.src).toBe(`${BASE}/Maps/White Dragon Lair.webp`);
  });

  it('rewrites legacy v13 backgrounds and tiles', () => {
    const scene = v13SceneJson();
    remapSceneDataPaths(scene, resolvePath);
    expect(scene.background.src).toBe(`${BASE}/Maps/White Dragon Lair.webp`);
    expect(scene.tiles[0].texture.src).toBe(`${BASE}/Tiles/Ice Pillar.webp`);
  });

  it('reports unresolved scene textures but not unresolved placeables', () => {
    const scene = {
      levels: [{ background: { src: 'missing.webp' } }],
      tiles: [{ texture: { src: 'modules/foo/tile.webp' } }]
    };
    expect(remapSceneDataPaths(scene, resolvePath)).toEqual([
      'levels[0].background.src: missing.webp'
    ]);
  });
});

describe('migrateSceneData', () => {
  it('uses core Scene.fromImport when it succeeds', async () => {
    const migrated = { name: 'migrated by core', levels: [] };
    const { SceneClass } = makeSceneClass({ fromImport: () => ({ toObject: () => migrated }) });
    const input = v13SceneJson();

    const result = await migrateSceneData(input, SceneClass);

    expect(result.migratedBy).toBe('core');
    expect(result.data).toBe(migrated);
    // fromImport gets a copy so a failure can't leave the fallback half-cleaned
    const passed = SceneClass.fromImport.mock.calls[0][0];
    expect(passed).toEqual(v13SceneJson());
    expect(passed).not.toBe(input);
  });

  it('falls back to the module migration when fromImport throws', async () => {
    const { SceneClass } = makeSceneClass({
      fromImport: () => {
        throw new Error('strict validation failed');
      }
    });
    const result = await migrateSceneData(v13SceneJson(), SceneClass);

    expect(result.migratedBy).toBe('module');
    expect(result.data.levels[0].background.src).toBe('White Dragon Lair.webp');
    expect(result.data.tiles[0].texture).toMatchObject({ anchorX: 0, anchorY: 0 });
    expect(result.data.tiles[0]).toMatchObject({ x: 100, y: 100 });
  });

  it('falls back when fromImport is unavailable', async () => {
    const { SceneClass } = makeSceneClass();
    const result = await migrateSceneData(v13SceneJson(), SceneClass);
    expect(result.migratedBy).toBe('module');
    expect(result.report?.tilesRepositioned).toBe(1);
  });
});

describe('importScenePackageData', () => {
  it('creates a v13 scene with the map image on its initial level (fallback path)', async () => {
    const { SceneClass, created } = makeSceneClass();

    const result = await importScenePackageData(v13SceneJson(), { SceneClass, resolvePath });

    expect(SceneClass.create).toHaveBeenCalledTimes(1);
    const data = created[0];
    expect(data.background).toBeUndefined();
    expect(data.initialLevel).toBe('defaultLevel0000');
    expect(data.levels[0].background.src).toBe(`${BASE}/Maps/White Dragon Lair.webp`);
    expect(data.tiles[0].texture).toMatchObject({
      src: `${BASE}/Tiles/Ice Pillar.webp`,
      anchorX: 0,
      anchorY: 0
    });
    expect(data.walls).toHaveLength(3);
    expect(result.backgroundSrc).toBe(`${BASE}/Maps/White Dragon Lair.webp`);
    expect(result.migratedBy).toBe('module');
  });

  it('passes remapped data through core fromImport and creates from its output', async () => {
    const { SceneClass, created } = makeSceneClass({
      fromImport: source => ({ toObject: () => ({ ...source, migrated: true }) })
    });

    const result = await importScenePackageData(v14SceneJson(), { SceneClass, resolvePath });

    const passed = SceneClass.fromImport.mock.calls[0][0];
    expect(passed.levels[0].background.src).toBe(`${BASE}/Maps/White Dragon Lair.webp`);
    expect(created[0].migrated).toBe(true);
    expect(result.migratedBy).toBe('core');
  });

  it('throws when scene creation is prevented', async () => {
    const { SceneClass } = makeSceneClass();
    SceneClass.create.mockResolvedValueOnce(undefined);
    await expect(
      importScenePackageData(v14SceneJson(), { SceneClass, resolvePath })
    ).rejects.toThrow('was prevented');
  });

  it('propagates scene creation errors', async () => {
    const { SceneClass } = makeSceneClass();
    SceneClass.create.mockRejectedValueOnce(new Error('validation failed'));
    await expect(
      importScenePackageData(v14SceneJson(), { SceneClass, resolvePath })
    ).rejects.toThrow('validation failed');
  });
});
