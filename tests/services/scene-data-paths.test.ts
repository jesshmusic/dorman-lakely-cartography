/**
 * Scene data path helper tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  getInitialLevelBackgroundSrc,
  isSceneTextureLocation,
  resolveRemappedPath,
  visitScenePaths
} from '../../src/services/scene-data-paths';

function v13Scene(): any {
  return {
    name: 'White Dragon Lair',
    background: { src: 'White Dragon Lair.webp', offsetX: 0, offsetY: 0 },
    foreground: 'White Dragon Lair Roof.webp',
    fog: { overlay: 'fog.webp', exploration: true },
    tiles: [{ texture: { src: 'tiles/Ice Pillar.webp' } }],
    tokens: [{ texture: { src: 'tokens/dragon.webp' } }],
    sounds: [{ path: 'audio/wind.ogg' }]
  };
}

function v14Scene(): any {
  return {
    name: 'White Dragon Lair',
    initialLevel: 'upperLevel000000',
    levels: [
      {
        _id: 'lowerLevel000000',
        background: { src: 'Lower.webp' },
        foreground: { src: null },
        fog: { src: null }
      },
      {
        _id: 'upperLevel000000',
        background: { src: 'Upper.webp' },
        foreground: { src: 'Upper Roof.webp' },
        fog: { src: 'Upper Fog.webp' }
      }
    ],
    tiles: [],
    tokens: [],
    sounds: []
  };
}

describe('visitScenePaths', () => {
  it('visits legacy v13 scene textures and placeables', () => {
    const seen: string[] = [];
    visitScenePaths(v13Scene(), (path, location) => {
      seen.push(`${location}=${path}`);
    });
    expect(seen).toEqual([
      'background.src=White Dragon Lair.webp',
      'foreground=White Dragon Lair Roof.webp',
      'fog.overlay=fog.webp',
      'tiles[0].texture.src=tiles/Ice Pillar.webp',
      'tokens[0].texture.src=tokens/dragon.webp',
      'sounds[0].path=audio/wind.ogg'
    ]);
  });

  it('visits every v14 level background, foreground and fog texture', () => {
    const seen: string[] = [];
    visitScenePaths(v14Scene(), (path, location) => {
      seen.push(`${location}=${path}`);
    });
    expect(seen).toEqual([
      'levels[0].background.src=Lower.webp',
      'levels[1].background.src=Upper.webp',
      'levels[1].foreground.src=Upper Roof.webp',
      'levels[1].fog.src=Upper Fog.webp'
    ]);
  });

  it('replaces paths when the visitor returns a string and leaves others alone', () => {
    const scene = v14Scene();
    visitScenePaths(scene, path => (path === 'Upper.webp' ? 'new/Upper.webp' : undefined));
    expect(scene.levels[1].background.src).toBe('new/Upper.webp');
    expect(scene.levels[0].background.src).toBe('Lower.webp');
    expect(scene.levels[0].foreground.src).toBeNull();
  });

  it('tolerates missing or malformed collections', () => {
    expect(() =>
      visitScenePaths({ levels: [null, 'x'], tiles: 'nope', background: null }, () => 'x')
    ).not.toThrow();
    expect(() => visitScenePaths(null, () => 'x')).not.toThrow();
  });
});

describe('isSceneTextureLocation', () => {
  it('distinguishes scene textures from placeables', () => {
    expect(isSceneTextureLocation('background.src')).toBe(true);
    expect(isSceneTextureLocation('levels[2].foreground.src')).toBe(true);
    expect(isSceneTextureLocation('tiles[0].texture.src')).toBe(false);
    expect(isSceneTextureLocation('sounds[3].path')).toBe(false);
  });
});

describe('resolveRemappedPath', () => {
  const base = 'Dorman Lakely Cartography/Maps/dragon-lair-cave/Maps';
  const remapped = new Map<string, string>([
    ['White%20Dragon%20Lair.webp', `${base}/White Dragon Lair.webp`],
    ['White Dragon Lair.webp', `${base}/White Dragon Lair.webp`],
    ['maps/a/shared.webp', `${base}/shared-a.webp`],
    ['maps/b/shared.webp', `${base}/shared-b.webp`]
  ]);

  it('matches exact, decoded and encoded keys', () => {
    expect(resolveRemappedPath(remapped, 'White Dragon Lair.webp')).toBe(
      `${base}/White Dragon Lair.webp`
    );
    expect(resolveRemappedPath(new Map([['a b.webp', 'x']]), 'a%20b.webp')).toBe('x');
    expect(resolveRemappedPath(new Map([['a%20b.webp', 'x']]), 'a b.webp')).toBe('x');
  });

  it('falls back to an unambiguous filename match', () => {
    expect(resolveRemappedPath(remapped, 'worlds/dl/scenes/White Dragon Lair.webp')).toBe(
      `${base}/White Dragon Lair.webp`
    );
  });

  it('refuses ambiguous or unknown filenames', () => {
    expect(resolveRemappedPath(remapped, 'worlds/x/shared.webp')).toBeNull();
    expect(resolveRemappedPath(remapped, 'icons/svg/mystery-man.svg')).toBeNull();
  });
});

describe('getInitialLevelBackgroundSrc', () => {
  it('reads the initial level, falling back to the first level', () => {
    const scene = v14Scene();
    expect(getInitialLevelBackgroundSrc(scene)).toBe('Upper.webp');
    scene.initialLevel = 'missingLevel0000';
    expect(getInitialLevelBackgroundSrc(scene)).toBe('Lower.webp');
  });

  it('returns null without levels or a background', () => {
    expect(getInitialLevelBackgroundSrc(v13Scene())).toBeNull();
    expect(getInitialLevelBackgroundSrc({ levels: [{ background: { src: null } }] })).toBeNull();
  });
});
