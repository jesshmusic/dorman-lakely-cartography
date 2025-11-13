/**
 * Dorman Lakely Cartography - Main Entry Point
 * A FoundryVTT module for downloading and managing custom battlemaps
 */

import { DLCSettings, DLCAPIConfig } from './types/module';
import { MapGalleryDialog } from './ui/map-gallery-dialog';

// Module constants
const MODULE_ID = 'dorman-lakely-cartography';
const MODULE_TITLE = 'Dorman Lakely Cartography';

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
      baseUrl: 'https://api.your-domain.com',
      patreonClientId: 'YOUR_PATREON_CLIENT_ID',
      patreonRedirectUri: 'https://api.your-domain.com/api/v1/patreon/callback'
    } as DLCAPIConfig
  });

  // Download path
  game.settings.register(MODULE_ID, 'downloadPath', {
    name: 'Download Path',
    hint: 'Custom path for downloaded map files (leave empty for default)',
    scope: 'world',
    config: true,
    type: String,
    default: `modules/${MODULE_ID}/assets/scenes/`
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
    onChange: value => {
      // Convert hours to milliseconds
      const ms = value * 60 * 60 * 1000;
      console.log(`${MODULE_TITLE} | Cache expiry set to ${value} hours (${ms}ms)`);
    }
  });
}

/**
 * Initialize module on Foundry init hook
 */
Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing module`);

  // Register settings
  registerSettings();

  // Initialize global module data
  game.dlcMaps = {
    maps: [],
    tags: [],
    user: null,
    settings: {
      userId: game.settings.get(MODULE_ID, 'userId'),
      user: game.settings.get(MODULE_ID, 'user'),
      apiConfig: game.settings.get(MODULE_ID, 'apiConfig'),
      downloadPath: game.settings.get(MODULE_ID, 'downloadPath'),
      concurrentDownloads: game.settings.get(MODULE_ID, 'concurrentDownloads'),
      cacheExpiry: game.settings.get(MODULE_ID, 'cacheExpiry') * 60 * 60 * 1000
    }
  };

  console.log(`${MODULE_TITLE} | Initialization complete`);
});

/**
 * Setup module on Foundry ready hook
 */
Hooks.once('ready', async () => {
  console.log(`${MODULE_TITLE} | Module ready`);

  // Check for required modules
  const requiredModules = ['tagger', 'monks-active-tiles'];
  const missingModules = requiredModules.filter(
    moduleId => !game.modules.get(moduleId)?.active
  );

  if (missingModules.length > 0) {
    ui.notifications.warn(
      `${MODULE_TITLE}: The following required modules are not active: ${missingModules.join(', ')}`
    );
  }

  // Log user authentication status
  const user = game.dlcMaps?.user;
  if (user) {
    console.log(`${MODULE_TITLE} | User authenticated with ${user.has_premium ? 'Premium' : 'Free'} access`);
  } else {
    console.log(`${MODULE_TITLE} | No user authentication found`);
  }
});

/**
 * Add compendium button to open map gallery
 */
Hooks.on('renderCompendiumDirectory', (_app: any, html: JQuery) => {
  // Only show for GMs
  if (!game.user?.isGM) return;

  // Add button to compendium sidebar
  const button = $(
    `<button class="dlc-open-gallery">
      <i class="fas fa-map"></i> ${MODULE_TITLE}
    </button>`
  );

  button.on('click', () => {
    new MapGalleryDialog().render(true);
  });

  html.find('.directory-header').append(button);
});

/**
 * Export module ID for use in other files
 */
export { MODULE_ID, MODULE_TITLE };
