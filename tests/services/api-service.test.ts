/**
 * API Service Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { APIService } from '../../src/services/api-service';
import { DLCAPIConfig } from '../../src/types/module';

describe('APIService', () => {
  let apiService: APIService;
  let mockConfig: DLCAPIConfig;

  beforeEach(() => {
    // Reset localStorage
    localStorage.clear();

    // Setup mock config
    mockConfig = {
      baseUrl: 'https://api.test.com',
      patreonClientId: 'test-client-id',
      patreonRedirectUri: 'https://api.test.com/callback'
    };

    apiService = new APIService(mockConfig, 'test-user-id');

    // Reset fetch mock
    (global.fetch as any).mockClear();
  });

  describe('fetchTags', () => {
    it('should fetch tags from API', async () => {
      const mockTags = [
        { value: 'dungeon', label: 'Dungeon', count: 5 },
        { value: 'forest', label: 'Forest', count: 3 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTags
      });

      const tags = await apiService.fetchTags();

      expect(tags).toEqual(mockTags);
      expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/v1/maps/tags');
    });

    it('should use cached tags if available', async () => {
      const mockTags = [{ value: 'dungeon', label: 'Dungeon' }];

      // Set cache
      localStorage.setItem(
        'dlc-tags',
        JSON.stringify({
          data: mockTags,
          timestamp: Date.now()
        })
      );

      const tags = await apiService.fetchTags();

      expect(tags).toEqual(mockTags);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const tags = await apiService.fetchTags();

      expect(tags).toEqual([]);
      expect(ui.notifications.error).toHaveBeenCalled();
    });
  });

  describe('fetchMaps', () => {
    it('should fetch maps from API', async () => {
      const mockMaps = [
        {
          id: 'map-1',
          name: 'Test Map',
          thumbnail: 'https://example.com/thumb.jpg',
          tags: ['dungeon'],
          access: 'Free' as const
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMaps
      });

      const maps = await apiService.fetchMaps();

      expect(maps).toEqual(mockMaps);
      expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/v1/maps/list');
    });
  });

  describe('fetchFileManifest', () => {
    it('should fetch file manifest with authentication', async () => {
      const mockManifest = {
        mapId: 'map-1',
        files: [
          {
            path: 'scenes/map-1/scene.json',
            size: 1024,
            type: 'scene' as const
          }
        ],
        totalSize: 1024
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest
      });

      const manifest = await apiService.fetchFileManifest('map-1');

      expect(manifest).toEqual(mockManifest);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/maps/files/map-1',
        expect.objectContaining({
          headers: {
            Authorization: 'test-user-id'
          }
        })
      );
    });

    it('should throw error if not authenticated', async () => {
      const unauthenticatedService = new APIService(mockConfig, null);

      await expect(unauthenticatedService.fetchFileManifest('map-1')).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should throw error for 403 response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403
      });

      await expect(apiService.fetchFileManifest('map-1')).rejects.toThrow('You do not have access');
    });
  });

  describe('clearCache', () => {
    it('should clear cached data', () => {
      localStorage.setItem('dlc-tags', 'test-data');
      localStorage.setItem('dlc-maps', 'test-data');

      apiService.clearCache();

      expect(localStorage.getItem('dlc-tags')).toBeNull();
      expect(localStorage.getItem('dlc-maps')).toBeNull();
    });
  });

  describe('setUserId', () => {
    it('should update user ID', () => {
      apiService.setUserId('new-user-id');

      // Test by checking if fetchFileManifest uses the new ID
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ mapId: 'test', files: [], totalSize: 0 })
      });

      apiService.fetchFileManifest('map-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: 'new-user-id'
          }
        })
      );
    });
  });
});
