/**
 * Map Gallery Dialog
 * Main UI for browsing, filtering, and selecting maps for download
 * Uses ApplicationV2 (Foundry v12+ modern application API)
 */

import { DLCMap, DLCTag } from '../types/module';
import { APIService } from '../services/api-service';
import { PatreonAuthService } from '../services/patreon-auth-service';
import { DownloadDialog } from './download-dialog';
import { MODULE_ID, MODULE_TITLE } from '../constants';

export class MapGalleryDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  private apiService: APIService;
  private authService: PatreonAuthService;
  private maps: DLCMap[] = [];
  private tags: DLCTag[] = [];
  private selectedTags: Set<string> = new Set();
  private searchQuery: string = '';
  private selectedMap: DLCMap | null = null;

  static override DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-gallery`,
    classes: ['dlc-gallery'],
    tag: 'div',
    window: {
      title: MODULE_TITLE,
      icon: 'fas fa-map',
      minimizable: true,
      resizable: true
    },
    position: {
      width: 1000,
      height: 700
    },
    actions: {
      login: this.prototype._onLogin,
      logout: this.prototype._onLogout,
      selectTag: this.prototype._onSelectTag,
      clearTags: this.prototype._onClearTags,
      search: this.prototype._onSearch,
      selectMap: this.prototype._onSelectMap,
      downloadMap: this.prototype._onDownloadMap,
      closePreview: this.prototype._onClosePreview,
      refreshData: this.prototype._onRefreshData
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/gallery.hbs`
    }
  };

  constructor(options = {}) {
    super(options);

    // Initialize services - get config from settings directly if not in global
    const config = game.dlcMaps?.settings.apiConfig || game.settings.get(MODULE_ID, 'apiConfig');
    const userId = game.dlcMaps?.settings.userId || game.settings.get(MODULE_ID, 'userId');

    if (!config) {
      console.error(`${MODULE_TITLE} | API config not found!`);
      ui.notifications.error('Module configuration error. Please check settings.');
      throw new Error('API config not initialized');
    }

    console.log(`${MODULE_TITLE} | Initializing with API config:`, config);

    this.apiService = new APIService(config, userId);
    this.authService = new PatreonAuthService(this.apiService, config);
  }

  override async _prepareContext(_options: any): Promise<any> {
    // Load data if not already loaded
    if (this.maps.length === 0 || this.tags.length === 0) {
      await this.loadData();
    }

    // Filter maps based on selected tags and search query
    const filteredMaps = this.filterMaps();

    // Get user authentication status
    const user = this.authService.getCurrentUser();

    return {
      isAuthenticated: this.authService.isAuthenticated(),
      isPremium: this.authService.hasPremiumAccess(),
      user,
      tags: this.tags,
      selectedTags: Array.from(this.selectedTags),
      maps: filteredMaps,
      selectedMap: this.selectedMap,
      searchQuery: this.searchQuery,
      hasSelection: this.selectedMap !== null
    };
  }

  /**
   * Load maps and tags from API
   */
  private async loadData(): Promise<void> {
    try {
      ui.notifications.info('Loading map catalog...');

      // Load in parallel
      const [maps, tags] = await Promise.all([
        this.apiService.fetchMaps(),
        this.apiService.fetchTags()
      ]);

      this.maps = maps;
      this.tags = tags;

      // Update global state
      if (game.dlcMaps) {
        game.dlcMaps.maps = maps;
        game.dlcMaps.tags = tags;
      }

      console.log(`${MODULE_TITLE} | Loaded ${maps.length} maps and ${tags.length} tags`);
    } catch (error) {
      console.error(`${MODULE_TITLE} | Error loading data:`, error);
      ui.notifications.error('Failed to load map catalog. Please try again.');
    }
  }

  /**
   * Filter maps based on selected tags and search query
   */
  private filterMaps(): DLCMap[] {
    let filtered = [...this.maps];

    // Filter by tags
    if (this.selectedTags.size > 0) {
      filtered = filtered.filter(map => {
        return Array.from(this.selectedTags).every(tag => map.tags.includes(tag));
      });
    }

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(map => {
        return (
          map.name.toLowerCase().includes(query) ||
          map.description?.toLowerCase().includes(query) ||
          map.tags.some(tag => tag.toLowerCase().includes(query)) ||
          map.keywords?.some(keyword => keyword.toLowerCase().includes(query))
        );
      });
    }

    return filtered;
  }

  // Action handlers

  private async _onLogin(_event: Event, _target: HTMLElement): Promise<void> {
    await this.authService.login();
    this.render(false);
  }

  private async _onLogout(_event: Event, _target: HTMLElement): Promise<void> {
    await this.authService.logout();
    this.render(false);
  }

  private _onSelectTag(_event: Event, target: HTMLElement): void {
    const tagValue = target.dataset.tag;
    if (!tagValue) return;

    if (this.selectedTags.has(tagValue)) {
      this.selectedTags.delete(tagValue);
    } else {
      this.selectedTags.add(tagValue);
    }

    this.render(false);
  }

  private _onClearTags(_event: Event, _target: HTMLElement): void {
    this.selectedTags.clear();
    this.render(false);
  }

  private _onSearch(_event: Event, target: HTMLElement): void {
    if (target instanceof HTMLInputElement) {
      this.searchQuery = target.value;
      // Debounce search
      setTimeout(() => this.render(false), 300);
    }
  }

  private _onSelectMap(_event: Event, target: HTMLElement): void {
    const mapId = target.dataset.mapId;
    if (!mapId) return;

    this.selectedMap = this.maps.find(m => m.id === mapId) || null;
    this.render(false);
  }

  private async _onDownloadMap(_event: Event, target: HTMLElement): Promise<void> {
    const mapId = target.dataset.mapId;
    if (!mapId) return;

    const map = this.maps.find(m => m.id === mapId);
    if (!map) return;

    // Check access level for premium maps only
    if (map.access === 'Premium') {
      if (!this.authService.isAuthenticated()) {
        ui.notifications.warn('Please log in with Patreon to download Premium maps.');
        return;
      }

      if (!this.authService.hasPremiumAccess()) {
        ui.notifications.error(
          'This map requires Premium access. Please upgrade your Patreon tier.'
        );
        return;
      }
    }

    // Free maps don't require authentication
    // Open download dialog
    new DownloadDialog(map, this.apiService).render(true);
  }

  private _onClosePreview(_event: Event, _target: HTMLElement): void {
    this.selectedMap = null;
    this.render(false);
  }

  private async _onRefreshData(_event: Event, _target: HTMLElement): Promise<void> {
    this.apiService.clearCache();
    this.maps = [];
    this.tags = [];
    await this.loadData();
    this.render(false);
  }
}
