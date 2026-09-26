/**
 * Scene Directory context menu tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  buildSceneExportEntry,
  registerSceneExportContextMenu
} from '../../src/ui/scene-context-menu';
import { SceneExporter } from '../../src/services/scene-exporter';

/** Minimal HTMLElement stand-in for a directory entry */
function entryElement(entryId?: string): HTMLElement {
  return {
    dataset: entryId ? { entryId } : {},
    getAttribute: (name: string) => (name === 'data-entry-id' ? (entryId ?? null) : null)
  } as unknown as HTMLElement;
}

const scene: any = { id: 'scene00000000001', name: 'White Dragon Lair' };

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  (global as any).game.scenes = new Map([[scene.id, scene]]);
  (global as any).game.user.isGM = true;
  (global as any).ui.notifications.error = jest.fn();
});

describe('buildSceneExportEntry', () => {
  it('uses the v14 ContextMenuEntry keys, not the deprecated ones', () => {
    const entry = buildSceneExportEntry() as any;
    expect(entry.label).toBe('Export for Dorman Lakely Cartography');
    expect(typeof entry.icon).toBe('string');
    expect(typeof entry.visible).toBe('function');
    expect(typeof entry.onClick).toBe('function');
    expect(entry).not.toHaveProperty('name');
    expect(entry).not.toHaveProperty('condition');
    expect(entry).not.toHaveProperty('callback');
  });

  it('is visible only for scene entries', () => {
    const entry = buildSceneExportEntry();
    expect(entry.visible(entryElement(scene.id))).toBe(true);
    expect(entry.visible(entryElement())).toBe(false);
  });

  it('exports the scene from onClick(event, target)', async () => {
    const exportScene = jest.spyOn(SceneExporter, 'exportScene').mockResolvedValue(undefined);
    await buildSceneExportEntry().onClick({} as Event, entryElement(scene.id));
    expect(exportScene).toHaveBeenCalledWith(scene);
    exportScene.mockRestore();
  });

  it('reports a missing scene', async () => {
    const exportScene = jest.spyOn(SceneExporter, 'exportScene').mockResolvedValue(undefined);
    await buildSceneExportEntry().onClick({} as Event, entryElement('unknown000000000'));
    expect(exportScene).not.toHaveBeenCalled();
    expect((global as any).ui.notifications.error).toHaveBeenCalledWith('Scene not found');
    exportScene.mockRestore();
  });
});

describe('registerSceneExportContextMenu', () => {
  class FakeSceneDirectory {
    _getEntryContextOptions(): any[] {
      return [{ label: 'SCENE.View' }];
    }
  }

  it('appends the export entry for GMs only', () => {
    registerSceneExportContextMenu(FakeSceneDirectory);
    const directory = new FakeSceneDirectory();

    const labels = directory._getEntryContextOptions().map(o => o.label);
    expect(labels).toEqual(['SCENE.View', 'Export for Dorman Lakely Cartography']);

    (global as any).game.user.isGM = false;
    expect(directory._getEntryContextOptions().map(o => o.label)).toEqual(['SCENE.View']);
  });
});
