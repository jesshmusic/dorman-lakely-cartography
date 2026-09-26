/**
 * Legacy (v13 -> v14) scene data migration tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_LEVEL_ID,
  getSceneCoreVersion,
  isNewerVersion,
  isPreV14SceneData,
  migrateLegacySceneData,
  migrateRegionRotatedRectangles,
  migrateSceneFogExploration,
  migrateSceneLevels,
  migrateTileOcclusionMode,
  migrateTilePosition
} from '../../src/services/scene-migration';

/** Shape of a v13.351 scene.json, e.g. Premium map 430 "Forest - Jungle Clearing" */
function v13Scene(): any {
  return {
    name: 'Forest-Jungle Clearing',
    _stats: { coreVersion: '13.351' },
    background: { src: 'maps/Jungle Clearing.webp', offsetX: 12, offsetY: -8, anchorX: 0 },
    backgroundColor: '#112233',
    foreground: 'maps/Jungle Canopy.webp',
    foregroundElevation: 20,
    fog: { overlay: 'maps/fog.webp', exploration: false, colors: {} },
    tiles: [
      {
        _id: 'tileUnrotated000',
        x: 1000,
        y: 500,
        width: 200,
        height: 100,
        rotation: 0,
        elevation: 5,
        texture: { src: 'tiles/log.webp', anchorX: 0.5, anchorY: 0.5 },
        occlusion: { mode: 1, alpha: 0 }
      },
      {
        _id: 'tileRotated00000',
        x: 300,
        y: 301,
        width: 101,
        height: 50,
        rotation: 45,
        texture: { src: 'tiles/rock.webp', anchorX: 0.5, anchorY: 0.5 },
        occlusion: { mode: 0, alpha: 0 }
      }
    ],
    regions: [
      {
        _id: 'region0000000000',
        shapes: [
          { type: 'rectangle', x: 0, y: 0, width: 100, height: 50, rotation: 30 },
          { type: 'rectangle', x: 10, y: 10, width: 10, height: 10, rotation: 0 },
          { type: 'ellipse', x: 0, y: 0, radiusX: 5, radiusY: 5, rotation: 30 }
        ]
      }
    ]
  };
}

/** Shape of a v14 scene.json (levels already present) */
function v14Scene(): any {
  return {
    name: 'White Dragon Lair',
    _stats: { coreVersion: '14.368' },
    initialLevel: DEFAULT_LEVEL_ID,
    levels: [{ _id: DEFAULT_LEVEL_ID, name: 'Level', background: { src: 'lair.webp' } }],
    fog: { mode: 1 },
    tiles: [
      {
        x: 1000,
        y: 500,
        width: 200,
        height: 100,
        rotation: 0,
        texture: { src: 'tiles/log.webp', anchorX: 0, anchorY: 0 },
        occlusion: { modes: [1] }
      }
    ],
    regions: [
      {
        shapes: [
          {
            type: 'rectangle',
            x: 50,
            y: 25,
            width: 100,
            height: 50,
            rotation: 30,
            anchorX: 0.5,
            anchorY: 0.5
          }
        ]
      }
    ]
  };
}

describe('version helpers', () => {
  it('compares dotted core versions like foundry.utils.isNewerVersion', () => {
    expect(isNewerVersion('14.349', '13.351')).toBe(true);
    expect(isNewerVersion('14.349', '14.348')).toBe(true);
    expect(isNewerVersion('14.349', '14.349')).toBe(false);
    expect(isNewerVersion('14.349', '14.368')).toBe(false);
    expect(isNewerVersion('14', '13.351')).toBe(true);
  });

  it('reads _stats.coreVersion, else infers from the presence of levels', () => {
    expect(getSceneCoreVersion(v13Scene())).toBe('13.351');
    expect(getSceneCoreVersion({ levels: [] })).toBe('0');
    expect(getSceneCoreVersion({})).toBe('0');
    expect(getSceneCoreVersion({ levels: [{ _id: 'x' }] })).toBeNull();
  });

  it('detects pre-v14 scene data', () => {
    expect(isPreV14SceneData(v13Scene())).toBe(true);
    expect(isPreV14SceneData(v14Scene())).toBe(false);
    expect(isPreV14SceneData({ name: 'no stats, no levels' })).toBe(true);
  });
});

describe('migrateTilePosition (port of Tile.migratePosition)', () => {
  it('keeps x/y and shifts the anchor to the top-left for unrotated tiles', () => {
    const tile = { x: 1000, y: 500, width: 200, height: 100, rotation: 0, texture: {} as any };
    expect(migrateTilePosition(tile)).toBe(true);
    expect(tile).toMatchObject({ x: 1000, y: 500, width: 200, height: 100 });
    expect(tile.texture).toMatchObject({ anchorX: 0, anchorY: 0 });
  });

  it('preserves a custom v13 anchor offset for unrotated tiles', () => {
    const tile = { x: 0, y: 0, width: 10, height: 10, rotation: 0, texture: { anchorX: 1 } };
    migrateTilePosition(tile);
    expect(tile.texture).toMatchObject({ anchorX: 0.5, anchorY: 0 });
  });

  it('moves rotated tiles to their centre and keeps the centre anchor', () => {
    const tile = {
      x: 300,
      y: 301,
      width: 101,
      height: 50,
      rotation: 45,
      texture: { anchorX: 0.5, anchorY: 0.5 }
    };
    migrateTilePosition(tile);
    expect(tile).toMatchObject({ x: 351, y: 326, rotation: 45 });
    expect(tile.texture).toMatchObject({ anchorX: 0.5, anchorY: 0.5 });
  });

  it('creates texture data when missing', () => {
    const tile: any = { x: 0, y: 0, width: 10, height: 10, rotation: 0 };
    migrateTilePosition(tile);
    expect(tile.texture).toEqual({ anchorX: 0, anchorY: 0 });
  });
});

describe('migrateTileOcclusionMode (port of Tile.migrateOcclusionMode)', () => {
  it('converts occlusion.mode to a modes bitmask list', () => {
    const fade = { occlusion: { mode: 1, alpha: 0 } } as any;
    const vision = { occlusion: { mode: 4 } } as any;
    const none = { occlusion: { mode: 0 } } as any;
    migrateTileOcclusionMode(fade);
    migrateTileOcclusionMode(vision);
    migrateTileOcclusionMode(none);
    expect(fade.occlusion).toEqual({ modes: [1], alpha: 0 });
    expect(vision.occlusion).toEqual({ modes: [8] });
    expect(none.occlusion).toEqual({ modes: [] });
  });
});

describe('migrateRegionRotatedRectangles (port of Region.migrateRotatedRectangles)', () => {
  it('centre-anchors rotated rectangles only', () => {
    const region = v13Scene().regions[0];
    expect(migrateRegionRotatedRectangles(region)).toBe(true);
    expect(region.shapes[0]).toMatchObject({ x: 50, y: 25, anchorX: 0.5, anchorY: 0.5 });
    expect(region.shapes[1]).toEqual({
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      rotation: 0
    });
    expect(region.shapes[2]).not.toHaveProperty('anchorX');
  });
});

describe('migrateSceneLevels (port of Scene.migrateLevels)', () => {
  it('moves legacy background, foreground and fog onto a default initial level', () => {
    const scene = v13Scene();
    expect(migrateSceneLevels(scene)).toBe(true);
    expect(scene.levels).toEqual([
      {
        _id: DEFAULT_LEVEL_ID,
        name: 'Forest-Jungle Clearing',
        background: { color: '#112233', src: 'maps/Jungle Clearing.webp' },
        foreground: { src: 'maps/Jungle Canopy.webp' },
        elevation: { top: 20 },
        fog: { src: 'maps/fog.webp' }
      }
    ]);
    expect(scene.initialLevel).toBe(DEFAULT_LEVEL_ID);
    expect(scene.shiftX).toBe(12);
    expect(scene.shiftY).toBe(-8);
    for (const key of ['background', 'backgroundColor', 'foreground', 'foregroundElevation']) {
      expect(scene).not.toHaveProperty(key);
    }
    expect(scene.fog).not.toHaveProperty('overlay');
  });

  it('uses pre-v10 img when there is no background', () => {
    const scene: any = { name: 'Old', img: 'old.webp' };
    migrateSceneLevels(scene);
    expect(scene.levels[0].background).toEqual({ src: 'old.webp' });
    expect(scene).not.toHaveProperty('img');
  });

  it('back-fills the initial level of hybrid data without touching set textures', () => {
    const scene: any = {
      initialLevel: 'b000000000000000',
      background: { src: 'legacy.webp' },
      foreground: 'legacy-roof.webp',
      levels: [
        { _id: 'a000000000000000', background: { src: null } },
        {
          _id: 'b000000000000000',
          background: { src: null, tint: '#ffffff' },
          foreground: { src: 'kept.webp' }
        }
      ]
    };
    expect(migrateSceneLevels(scene)).toBe(true);
    expect(scene.levels[1].background).toEqual({ src: 'legacy.webp', tint: '#ffffff' });
    expect(scene.levels[1].foreground).toEqual({ src: 'kept.webp' });
    expect(scene.levels[0].background.src).toBeNull();
  });
});

describe('migrateSceneFogExploration (port of Scene.migrateFogExploration)', () => {
  it('maps fog.exploration to fog.mode', () => {
    const off: any = { fog: { exploration: false } };
    const on: any = { fog: { exploration: true } };
    migrateSceneFogExploration(off);
    migrateSceneFogExploration(on);
    expect(off.fog).toEqual({ mode: 0 });
    expect(on.fog).toEqual({ mode: 1 });
    expect(migrateSceneFogExploration({ fog: { mode: 1 } })).toBe(false);
  });
});

describe('migrateLegacySceneData', () => {
  it('converts v13 tiles so they render where they did in v13', () => {
    const scene = v13Scene();
    const report = migrateLegacySceneData(scene);

    expect(report).toMatchObject({
      coreVersion: '13.351',
      levels: true,
      fogExploration: true,
      tilesRepositioned: 2,
      tileOcclusion: 2,
      regionsReshaped: 1
    });
    const [unrotated, rotated] = scene.tiles;
    expect(unrotated).toMatchObject({ x: 1000, y: 500, width: 200, height: 100, elevation: 5 });
    expect(unrotated.texture).toMatchObject({ anchorX: 0, anchorY: 0 });
    expect(unrotated.occlusion).toEqual({ modes: [1], alpha: 0 });
    expect(rotated).toMatchObject({ x: 351, y: 326 });
    expect(rotated.texture).toMatchObject({ anchorX: 0.5, anchorY: 0.5 });
    expect(scene.levels[0].background.src).toBe('maps/Jungle Clearing.webp');
    expect(scene.fog.mode).toBe(0);
  });

  it('leaves v14 data untouched', () => {
    const scene = v14Scene();
    const before = structuredClone(scene);
    const report = migrateLegacySceneData(scene);
    expect(scene).toEqual(before);
    expect(report).toMatchObject({
      levels: false,
      fogExploration: false,
      tilesRepositioned: 0,
      tileOcclusion: 0,
      regionsReshaped: 0
    });
  });

  it('respects per-migration thresholds for early v14 builds', () => {
    // 14.350 is after Tile.migratePosition (14.349) but before Tile.migrateOcclusionMode (14.355)
    const scene: any = {
      _stats: { coreVersion: '14.350' },
      tiles: [
        {
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          rotation: 0,
          texture: { anchorX: 0.5 },
          occlusion: { mode: 1 }
        }
      ]
    };
    migrateLegacySceneData(scene);
    expect(scene.tiles[0].texture.anchorX).toBe(0.5);
    expect(scene.tiles[0].occlusion).toEqual({ modes: [1] });
  });

  it("prefers an embedded record's own _stats over the scene version", () => {
    const scene: any = {
      _stats: { coreVersion: '13.351' },
      tiles: [
        {
          _stats: { coreVersion: '14.368' },
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          rotation: 0,
          texture: { anchorX: 0, anchorY: 0 }
        }
      ]
    };
    migrateLegacySceneData(scene);
    expect(scene.tiles[0].texture).toEqual({ anchorX: 0, anchorY: 0 });
  });
});
