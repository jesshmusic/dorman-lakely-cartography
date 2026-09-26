/**
 * Scene exporter path collection tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SceneExporter } from '../../src/services/scene-exporter';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

function v14SceneJson(): any {
  return {
    name: 'Cabin',
    levels: [
      {
        _id: 'basement00000000',
        background: { src: 'worlds/w/cabin/Basement Background.webp' },
        foreground: { src: 'worlds/w/cabin/Basement Foreground.webp' },
        fog: { src: null }
      },
      {
        _id: 'upstairs00000000',
        background: { src: 'worlds/w/cabin/Upstairs Background.webp' },
        foreground: { src: null },
        fog: { src: 'worlds/w/cabin/fog.webp' }
      }
    ],
    tiles: [{ texture: { src: 'worlds/w/tiles/table.webp' } }],
    tokens: [{ texture: { src: 'worlds/w/tokens/cat.webp' } }],
    sounds: [{ path: 'worlds/w/audio/rain.ogg' }]
  };
}

describe('SceneExporter.collectAssets', () => {
  it('includes v14 level backgrounds, foregrounds and fog overlays', () => {
    expect([...SceneExporter.collectAssets(v14SceneJson())]).toEqual([
      'worlds/w/cabin/Basement Background.webp',
      'worlds/w/cabin/Basement Foreground.webp',
      'worlds/w/cabin/Upstairs Background.webp',
      'worlds/w/cabin/fog.webp',
      'worlds/w/tiles/table.webp',
      'worlds/w/tokens/cat.webp',
      'worlds/w/audio/rain.ogg'
    ]);
  });

  it('still includes a legacy top-level background', () => {
    const assets = SceneExporter.collectAssets({ background: { src: 'old.webp' } });
    expect([...assets]).toEqual(['old.webp']);
  });
});

describe('SceneExporter.updateSceneDataPaths', () => {
  it('rewrites level texture paths to their packaged names', () => {
    const scene = v14SceneJson();
    SceneExporter.updateSceneDataPaths(
      scene,
      new Map([
        ['worlds/w/cabin/Basement Background.webp', 'Basement_Background.webp'],
        ['worlds/w/cabin/fog.webp', 'fog.webp'],
        ['worlds/w/tiles/table.webp', 'tiles/table.webp']
      ])
    );
    expect(scene.levels[0].background.src).toBe('Basement_Background.webp');
    expect(scene.levels[0].foreground.src).toBe('worlds/w/cabin/Basement Foreground.webp');
    expect(scene.levels[1].fog.src).toBe('fog.webp');
    expect(scene.tiles[0].texture.src).toBe('tiles/table.webp');
  });
});
