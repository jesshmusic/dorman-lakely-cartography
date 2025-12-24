/**
 * Dorman Lakely Cartography - Main Entry Point
 * A FoundryVTT module for downloading and managing custom battlemaps
 */

import { DLCAPIConfig } from './types/module';
import { MapGalleryDialog } from './ui/map-gallery-dialog';
import { MODULE_ID, MODULE_TITLE, LOG_PREFIX } from './constants';
import { SceneExporter } from './services/scene-exporter';

/**
 * Register Handlebars helpers
 */
function registerHandlebarsHelpers(): void {
  // Helper: Check if array includes a value
  Handlebars.registerHelper('includes', function (array: any[], value: any) {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  });

  // Helper: Check equality
  Handlebars.registerHelper('eq', function (a: any, b: any) {
    return a === b;
  });

  // Helper: Logical AND
  Handlebars.registerHelper('and', function (...args: any[]) {
    // Remove the last argument which is the Handlebars options object
    const values = args.slice(0, -1);
    return values.every(v => !!v);
  });

  // Helper: Logical OR
  Handlebars.registerHelper('or', function (...args: any[]) {
    // Remove the last argument which is the Handlebars options object
    const values = args.slice(0, -1);
    return values.some(v => !!v);
  });

  // Helper: Logical NOT
  Handlebars.registerHelper('not', function (value: any) {
    return !value;
  });

  // Helper: Format bytes to human-readable size
  Handlebars.registerHelper('formatBytes', function (bytes: number) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  });

  // Helper: Multiply two numbers
  Handlebars.registerHelper('multiply', function (a: number, b: number) {
    return a * b;
  });

  // Helper: Divide two numbers
  Handlebars.registerHelper('divide', function (a: number, b: number) {
    return b !== 0 ? a / b : 0;
  });

  // Helper: Greater than comparison
  Handlebars.registerHelper('gt', function (a: number, b: number) {
    return a > b;
  });

  // Helper: Convert string to lowercase
  Handlebars.registerHelper('lowercase', function (str: string) {
    return typeof str === 'string' ? str.toLowerCase() : str;
  });
}

/**
 * Register module settings
 */
function registerSettings(): void {
  // User ID for Patreon authentication
  game.settings.register(MODULE_ID, 'userId', {
    name: 'User ID',
    hint: 'Unique identifier for Patreon authentication',
    scope: 'client',
    config: false,
    type: String,
    default: null
  });

  // User authentication data
  game.settings.register(MODULE_ID, 'user', {
    name: 'User Data',
    hint: 'Cached user authentication data',
    scope: 'client',
    config: false,
    type: Object,
    default: null
  });

  // API Configuration
  game.settings.register(MODULE_ID, 'apiConfig', {
    name: 'API Configuration',
    hint: 'API base URL and authentication settings',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
      patreonClientId: import.meta.env.VITE_PATREON_CLIENT_ID || 'YOUR_PATREON_CLIENT_ID',
      patreonRedirectUri:
        import.meta.env.VITE_PATREON_REDIRECT_URI || 'http://localhost:3000/v1/patreon/callback'
    } as DLCAPIConfig
  });

  // Download path
  game.settings.register(MODULE_ID, 'downloadPath', {
    name: 'Download Path',
    hint: 'Custom path for downloaded map files (leave empty for default)',
    scope: 'world',
    config: true,
    type: String,
    default: 'Dorman Lakely Cartography'
  });

  // Concurrent downloads
  game.settings.register(MODULE_ID, 'concurrentDownloads', {
    name: 'Concurrent Downloads',
    hint: 'Number of files to download in parallel',
    scope: 'world',
    config: true,
    type: Number,
    default: 5,
    range: {
      min: 1,
      max: 10,
      step: 1
    }
  });

  // Cache expiry (in milliseconds)
  game.settings.register(MODULE_ID, 'cacheExpiry', {
    name: 'Cache Expiry',
    hint: 'How long to cache map data (in hours)',
    scope: 'world',
    config: true,
    type: Number,
    default: 24,
    range: {
      min: 1,
      max: 168,
      step: 1
    },
    onChange: _value => {
      // Convert hours to milliseconds - value is converted but not used
      // The conversion happens automatically when the setting is read
    }
  });
}

/**
 * Initialize module on Foundry init hook
 */
Hooks.once('init', async () => {
  const moduleData = game.modules.get(MODULE_ID);
  const version = moduleData?.version || '0.1.0';

  // Load build info
  let buildNumber = 'unknown';
  try {
    const response = await fetch(`modules/${MODULE_ID}/build-info.json`);
    if (response.ok) {
      const buildInfo = await response.json();
      buildNumber = buildInfo.buildNumber;
    }
  } catch {
    // Ignore build info errors
  }

  // Module initialization banner with colored output
  console.log(
    '%c⚔️ Dorman Lakely Cartography %cv' + version + ' %c(build ' + buildNumber + ')',
    'color: #d32f2f; font-weight: bold; font-size: 16px;',
    'color: #ff9800; font-weight: bold; font-size: 14px;',
    'color: #ffeb3b; font-weight: normal; font-size: 12px;'
  );

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  // Register settings
  registerSettings();

  // Initialize global module data
  const apiConfig = game.settings.get(MODULE_ID, 'apiConfig');
  const savedUser = game.settings.get(MODULE_ID, 'user');

  game.dlcMaps = {
    maps: [],
    tags: [],
    user: savedUser, // Load saved user from settings
    settings: {
      userId: game.settings.get(MODULE_ID, 'userId'),
      user: savedUser,
      apiConfig: apiConfig,
      downloadPath: game.settings.get(MODULE_ID, 'downloadPath'),
      concurrentDownloads: game.settings.get(MODULE_ID, 'concurrentDownloads'),
      cacheExpiry: game.settings.get(MODULE_ID, 'cacheExpiry') * 60 * 60 * 1000
    }
  };
});

/**
 * Setup module on Foundry ready hook
 */
Hooks.once('ready', async () => {
  console.log(
    '%c⚔️ Dorman Lakely Cartography %c✓ Ready!',
    'color: #d32f2f; font-weight: bold; font-size: 16px;',
    'color: #4caf50; font-weight: bold; font-size: 14px;'
  );

  // Check for required modules
  const requiredModules = ['tagger', 'monks-active-tiles', 'enhanced-region-behavior'];
  const missingModules = requiredModules.filter(moduleId => !game.modules.get(moduleId)?.active);

  if (missingModules.length > 0) {
    ui.notifications.warn(
      `${MODULE_TITLE}: The following required modules are not active: ${missingModules.join(', ')}`
    );
  }

  // Log user authentication status and check expiry
  const user = game.dlcMaps?.user;
  if (user) {
    // Check if authentication has expired
    if (user.expires_in && Date.now() > user.expires_in) {
      console.log(`${LOG_PREFIX} | User authentication expired, clearing session`);
      game.dlcMaps.user = null;
      game.settings.set(MODULE_ID, 'user', null);
    } else {
      console.log(`${LOG_PREFIX} | User authenticated with ${user.tier_name} access`);
    }
  }
});

/**
 * Add button to Scenes Directory to open map gallery
 */
Hooks.on('renderSceneDirectory', (_app: any, html: HTMLElement | JQuery) => {
  // Only show for GMs
  if (!game.user?.isGM) return;

  // Ensure we're working with HTMLElement for v13
  const element = html instanceof HTMLElement ? html : html[0];

  // Create button using native DOM (matching FA Battlemaps pattern)
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('dlc-open-gallery');
  button.innerHTML = `<i class="fas fa-map-marked-alt" aria-hidden="true"></i> ${MODULE_TITLE}`;
  button.addEventListener('click', () => {
    new MapGalleryDialog().render(true);
  });

  // Add to header actions (same as FA Battlemaps)
  const headerActions = element.querySelector('.header-actions');
  if (headerActions) {
    headerActions.append(button);
  }
});

/**
 * Add context menu option to scenes for exporting
 * Foundry v13 uses _getEntryContextOptions method instead of hooks
 */
Hooks.once('init', () => {
  // Wrap the SceneDirectory prototype method
  const SceneDirectory = CONFIG.ui.scenes;
  const originalGetEntryContextOptions = SceneDirectory.prototype._getEntryContextOptions;

  SceneDirectory.prototype._getEntryContextOptions = function () {
    const options = originalGetEntryContextOptions.call(this);

    // Only add for GMs
    if (!game.user?.isGM) {
      return options;
    }

    // Check if JSZip is available
    if (!SceneExporter.isAvailable()) {
      return options;
    }

    // Add our export option
    options.push({
      name: 'Export for Dorman Lakely Cartography',
      icon: '<i class="fas fa-file-archive"></i>',
      condition: (li: any) => {
        // Only show for scenes (not folders)
        // In v13, li has data-entry-id attribute
        const sceneId = li.dataset?.entryId || li.getAttribute?.('data-entry-id');
        return !!sceneId;
      },
      callback: async (li: any) => {
        // Get the scene ID from data-entry-id
        const sceneId = li.dataset?.entryId || li.getAttribute?.('data-entry-id');
        const scene = game.scenes.get(sceneId);

        if (!scene) {
          ui.notifications?.error('Scene not found');
          return;
        }

        console.log(`${LOG_PREFIX} | Starting export for scene: ${scene.name}`);
        await SceneExporter.exportScene(scene);
      }
    });

    return options;
  };
});
