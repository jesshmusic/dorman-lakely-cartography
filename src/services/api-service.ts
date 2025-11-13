/**
 * API Service for HTTP communication with the backend
 * Handles all API requests for maps, tags, files, and authentication
 */

import { DLCMap, DLCTag, DLCFileManifest, DLCUser, DLCAPIConfig } from '../types/module';

export class APIService {
  private baseUrl: string;
  private userId: string | null;

  constructor(config: DLCAPIConfig, userId: string | null = null) {
    this.baseUrl = config.baseUrl;
    this.userId = userId;
  }

  /**
   * Set the user ID for authenticated requests
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  /**
   * Fetch tags from API with caching
   */
  async fetchTags(): Promise<DLCTag[]> {
    const cacheKey = 'dlc-tags';
    const cached = this.getFromCache<DLCTag[]>(cacheKey);

    if (cached) {
      console.log('Dorman Lakely Cartography | Using cached tags');
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/maps/tags`);

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.statusText}`);
      }

      const tags: DLCTag[] = await response.json();
      this.setCache(cacheKey, tags);

      return tags;
    } catch (error) {
      console.error('Dorman Lakely Cartography | Error fetching tags:', error);
      ui.notifications.error('Failed to fetch map tags. Using cached data if available.');

      // Return cached data even if expired, or empty array
      return this.getFromCache<DLCTag[]>(cacheKey, true) || [];
    }
  }

  /**
   * Fetch map catalog from API with caching
   */
  async fetchMaps(): Promise<DLCMap[]> {
    const cacheKey = 'dlc-maps';
    const cached = this.getFromCache<DLCMap[]>(cacheKey);

    if (cached) {
      console.log('Dorman Lakely Cartography | Using cached maps');
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/maps/list`);

      if (!response.ok) {
        throw new Error(`Failed to fetch maps: ${response.statusText}`);
      }

      const maps: DLCMap[] = await response.json();
      this.setCache(cacheKey, maps);

      return maps;
    } catch (error) {
      console.error('Dorman Lakely Cartography | Error fetching maps:', error);
      ui.notifications.error('Failed to fetch map catalog. Using cached data if available.');

      // Return cached data even if expired, or empty array
      return this.getFromCache<DLCMap[]>(cacheKey, true) || [];
    }
  }

  /**
   * Fetch file manifest for a specific map
   */
  async fetchFileManifest(mapId: string): Promise<DLCFileManifest> {
    if (!this.userId) {
      throw new Error('User ID is required for fetching file manifest');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/maps/files/${mapId}`, {
        headers: {
          Authorization: this.userId
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in with Patreon.');
        }
        if (response.status === 403) {
          throw new Error('You do not have access to this map. Premium tier required.');
        }
        throw new Error(`Failed to fetch file manifest: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Dorman Lakely Cartography | Error fetching file manifest:', error);
      throw error;
    }
  }

  /**
   * Download a specific file
   */
  async downloadFile(mapId: string, filePath: string): Promise<Blob> {
    if (!this.userId) {
      throw new Error('User ID is required for downloading files');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/maps/file/${mapId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.userId
        },
        body: JSON.stringify({ path: filePath })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in with Patreon.');
        }
        if (response.status === 403) {
          throw new Error('You do not have access to this file.');
        }
        if (response.status === 404) {
          throw new Error('File not found.');
        }
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Dorman Lakely Cartography | Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Check user authentication status
   */
  async checkUserStatus(): Promise<DLCUser | null> {
    if (!this.userId) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/users/${this.userId}/ready`);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // User not found or not authenticated
        }
        throw new Error(`Failed to check user status: ${response.statusText}`);
      }

      const userData: DLCUser = await response.json();
      return userData;
    } catch (error) {
      console.error('Dorman Lakely Cartography | Error checking user status:', error);
      return null;
    }
  }

  /**
   * Get data from localStorage cache
   */
  private getFromCache<T>(key: string, ignoreExpiry: boolean = false): T | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const cacheExpiry = game.dlcMaps?.settings.cacheExpiry || 24 * 60 * 60 * 1000;

      if (!ignoreExpiry && Date.now() - timestamp > cacheExpiry) {
        localStorage.removeItem(key);
        return null;
      }

      return data as T;
    } catch (error) {
      console.error('Dorman Lakely Cartography | Error reading from cache:', error);
      return null;
    }
  }

  /**
   * Save data to localStorage cache
   */
  private setCache<T>(key: string, data: T): void {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Dorman Lakely Cartography | Error writing to cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    try {
      localStorage.removeItem('dlc-tags');
      localStorage.removeItem('dlc-maps');
      console.log('Dorman Lakely Cartography | Cache cleared');
    } catch (error) {
      console.error('Dorman Lakely Cartography | Error clearing cache:', error);
    }
  }
}
