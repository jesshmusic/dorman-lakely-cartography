/**
 * Scene Directory context menu integration
 */

import { LOG_PREFIX } from '../constants';
import { SceneExporter } from '../services/scene-exporter';

/**
 * v14 ContextMenuEntry. `visible` receives the directory entry element and
 * `onClick` receives `(event, target)`. The legacy `name`/`condition`/
 * `callback` keys are deprecated since v14 (removed in v16).
 */
export interface SceneContextMenuEntry {
  label: string;
  icon: string;
  visible: (li: HTMLElement) => boolean;
  onClick: (event: Event, li: HTMLElement) => Promise<void>;
}

function getEntryId(li: HTMLElement): string | undefined {
  return li?.dataset?.entryId || li?.getAttribute?.('data-entry-id') || undefined;
}

/** Build the "Export for Dorman Lakely Cartography" scene directory entry. */
export function buildSceneExportEntry(): SceneContextMenuEntry {
  return {
    label: 'Export for Dorman Lakely Cartography',
    icon: 'fa-solid fa-file-zipper',
    // Only scene entries carry data-entry-id (folders don't)
    visible: li => !!getEntryId(li),
    onClick: async (_event, li) => {
      const scene = game.scenes.get(getEntryId(li));
      if (!scene) {
        ui.notifications?.error('Scene not found');
        return;
      }

      console.log(`${LOG_PREFIX} | Starting export for scene: ${scene.name}`);
      await SceneExporter.exportScene(scene);
    }
  };
}

/**
 * Wrap SceneDirectory#_getEntryContextOptions to append the export entry for GMs.
 * Call from the `init` hook with `CONFIG.ui.scenes`.
 */
export function registerSceneExportContextMenu(SceneDirectory: any): void {
  const original = SceneDirectory.prototype._getEntryContextOptions;

  SceneDirectory.prototype._getEntryContextOptions = function (this: any, ...args: any[]) {
    const options = original.apply(this, args);
    if (!game.user?.isGM || !SceneExporter.isAvailable()) return options;
    options.push(buildSceneExportEntry());
    return options;
  };
}
