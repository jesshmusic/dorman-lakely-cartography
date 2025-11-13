/**
 * API Service for HTTP communication with the backend
 * Handles all API requests for maps, tags, files, and authentication
 */

import { DLCMap, DLCTag, DLCFileManifest, DLCUser, DLCAPIConfig } from '../types/module';
import { LOG_PREFIX } from '../constants';

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
      console.log(`${LOG_PREFIX} | Using cached tags`);
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/maps/tags`);

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.statusText}`);
      }

      const tags: DLCTag[] = await response.json();
      this.setCache(cacheKey, tags);

      return tags;
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error fetching tags:`, error);
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
      console.log(`${LOG_PREFIX} | Using cached maps`);
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/maps/list`);

      if (!response.ok) {
        throw new Error(`Failed to fetch maps: ${response.statusText}`);
      }

      const maps: DLCMap[] = await response.json();
      this.setCache(cacheKey, maps);

      return maps;
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error fetching maps:`, error);
      ui.notifications.error('Failed to fetch map catalog. Using cached data if available.');

      // Return cached data even if expired, or empty array
      return this.getFromCache<DLCMap[]>(cacheKey, true) || [];
    }
  }

  /**
   * Fetch file manifest for a specific map
   */
  async fetchFileManifest(mapId: string, isFreeMap: boolean = false): Promise<DLCFileManifest> {
    // Only require userId for premium maps
    if (!isFreeMap && !this.userId) {
      const errorMsg = 'User ID is required for fetching Premium map file manifest';
      console.error(`${LOG_PREFIX} | ${errorMsg}`);
      throw new Error(errorMsg);
    }

    try {
      const headers: Record<string, string> = {};

      // Include authorization header if userId is available
      if (this.userId) {
        headers.Authorization = this.userId;
      }

      const response = await fetch(`${this.baseUrl}/v1/maps/files/${mapId}`, {
        headers
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

      const manifest = await response.json();
      return manifest;
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error fetching file manifest:`, error);
      throw error;
    }
  }

  /**
   * Download a specific file
   */
  async downloadFile(mapId: string, filePath: string, isFreeMap: boolean = false): Promise<Blob> {
    // Only require userId for premium maps
    if (!isFreeMap && !this.userId) {
      const errorMsg = 'User ID is required for downloading Premium map files';
      console.error(`${LOG_PREFIX} | ${errorMsg}`);
      throw new Error(errorMsg);
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Include authorization header if userId is available
      if (this.userId) {
        headers.Authorization = this.userId;
      }

      console.log(`${LOG_PREFIX} | Downloading file: ${filePath} from map ${mapId}`);

      const response = await fetch(`${this.baseUrl}/v1/maps/file/${mapId}`, {
        method: 'POST',
        headers,
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

      // The backend now returns a JSON with a signed URL
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.url) {
            // Fetch the actual file from the signed URL
            const fileResponse = await fetch(data.url);
            if (!fileResponse.ok) {
              throw new Error(`Failed to download file from storage: ${fileResponse.status} ${fileResponse.statusText}`);
            }
            return await fileResponse.blob();
          }
        }
      } catch (jsonError) {
        console.warn(`${LOG_PREFIX} | Failed to parse JSON response, treating as blob:`, jsonError);
      }

      return await response.blob();
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error downloading file:`, error);
      throw error;
    }
  }

  /**
   * Check user authentication status
   */
  async checkUserStatus(): Promise<DLCUser | null> {
    if (!this.userId) {
      console.warn(`${LOG_PREFIX} | No userId set for checkUserStatus`);
      return null;
    }

    try {
      const url = `${this.baseUrl}/v1/users/${this.userId}/ready`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // User not found or not authenticated
        }
        throw new Error(`Failed to check user status: ${response.statusText}`);
      }

      const userData: DLCUser = await response.json();
      return userData;
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error checking user status:`, error);
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
      console.error(`${LOG_PREFIX} | Error reading from cache:`, error);
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
      console.error(`${LOG_PREFIX} | Error writing to cache:`, error);
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    try {
      localStorage.removeItem('dlc-tags');
      localStorage.removeItem('dlc-maps');
      console.log(`${LOG_PREFIX} | Cache cleared`);
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error clearing cache:`, error);
    }
  }
}
