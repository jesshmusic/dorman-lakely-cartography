/**
 * Patreon Authentication Service
 * Handles OAuth2 authentication flow with Patreon
 */

import { DLCUser, DLCAPIConfig } from '../types/module';
import { APIService } from './api-service';
import { MODULE_ID, LOG_PREFIX } from '../constants';

export class PatreonAuthService {
  private apiService: APIService;
  private config: DLCAPIConfig;

  constructor(apiService: APIService, config: DLCAPIConfig) {
    this.apiService = apiService;
    this.config = config;
  }

  /**
   * Generate a new user ID using Foundry's randomID utility
   */
  private generateUserId(): string {
    return foundry.utils.randomID(16);
  }

  /**
   * Initiate Patreon login flow
   * Opens OAuth popup and polls for authentication completion
   */
  async login(): Promise<DLCUser | null> {
    try {
      // Generate new user ID
      const userId = this.generateUserId();

      // Save user ID to settings
      await game.settings.set(MODULE_ID, 'userId', userId);

      // Update API service with new user ID
      this.apiService.setUserId(userId);

      // Build OAuth URL
      const authUrl =
        `https://www.patreon.com/oauth2/authorize?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(this.config.patreonClientId)}&` +
        `redirect_uri=${encodeURIComponent(this.config.patreonRedirectUri)}&` +
        `state=${encodeURIComponent(userId)}&` +
        `scope=identity identity.memberships`;

      // Open OAuth in new tab
      // Note: In FoundryVTT's Electron environment, window.open may return null
      // even when the window successfully opens, so we don't block on this check
      window.open(authUrl, '_blank');

      ui.notifications.info('Waiting for Patreon authentication...');

      // Poll for authentication completion
      const userData = await this.pollForAuthentication(userId);

      if (userData) {
        console.log(`${LOG_PREFIX} | Authentication completed successfully`, userData);

        // Save user data to settings
        await game.settings.set(MODULE_ID, 'user', userData);

        // Update global state
        if (game.dlcMaps) {
          game.dlcMaps.user = userData;
        }

        ui.notifications.info(`Successfully authenticated! Access level: ${userData.tier_name}`);

        return userData;
      } else {
        console.warn(`${LOG_PREFIX} | Authentication timed out or was cancelled`);
        ui.notifications.warn('Patreon authentication timed out or was cancelled.');
        return null;
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error during Patreon login:`, error);
      ui.notifications.error('Failed to authenticate with Patreon. Please try again.');
      return null;
    }
  }

  /**
   * Poll API for authentication completion
   * Checks every 2 seconds for up to 2 minutes
   */
  private async pollForAuthentication(_userId: string): Promise<DLCUser | null> {
    const maxAttempts = 60; // 2 minutes (60 * 2 seconds)
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        const userData = await this.apiService.checkUserStatus();

        if (userData) {
          console.log(`${LOG_PREFIX} | Authentication successful!`, userData);
          return userData;
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} | Error polling for authentication:`, error);
        // Continue polling on error
      }
    }

    console.warn(`${LOG_PREFIX} | Authentication polling timed out`);
    return null;
  }

  /**
   * Logout user by rotating user ID
   */
  async logout(): Promise<void> {
    try {
      console.log(`${LOG_PREFIX} | Logging out user`);

      // Generate new user ID to invalidate the old one
      const newUserId = this.generateUserId();

      // Clear user data
      await game.settings.set(MODULE_ID, 'userId', newUserId);
      await game.settings.set(MODULE_ID, 'user', null);

      // Update API service
      this.apiService.setUserId(newUserId);

      // Update global state
      if (game.dlcMaps) {
        game.dlcMaps.user = null;
        game.dlcMaps.settings.userId = newUserId;
        game.dlcMaps.settings.user = null;
      }

      console.log(`${LOG_PREFIX} | Logout successful`);
      ui.notifications.info('Successfully logged out.');
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error during logout:`, error);
      ui.notifications.error('Failed to logout. Please try again.');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return game.dlcMaps?.user !== null;
  }

  /**
   * Check if user has premium access
   */
  hasPremiumAccess(): boolean {
    return game.dlcMaps?.user?.has_premium === true;
  }

  /**
   * Check if user has free access
   */
  hasFreeAccess(): boolean {
    return game.dlcMaps?.user?.has_free === true;
  }

  /**
   * Get current user data
   */
  getCurrentUser(): DLCUser | null {
    return game.dlcMaps?.user || null;
  }

  /**
   * Check if authentication has expired
   */
  isAuthenticationExpired(): boolean {
    const user = this.getCurrentUser();

    if (!user || !user.expires_in) {
      return false;
    }

    return Date.now() > user.expires_in;
  }

  /**
   * Refresh authentication if expired
   */
  async refreshIfNeeded(): Promise<void> {
    try {
      if (this.isAuthenticationExpired()) {
        console.log(`${LOG_PREFIX} | Authentication expired, refreshing...`);
        await this.login();
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error refreshing authentication:`, error);
    }
  }
}
