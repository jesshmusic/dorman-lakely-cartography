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
      // Validate that the Patreon client ID is configured
      if (
        !this.config.patreonClientId ||
        this.config.patreonClientId === 'YOUR_PATREON_CLIENT_ID'
      ) {
        ui.notifications.error(
          'Patreon integration is not yet configured. The module author needs to set up a Patreon OAuth application.'
        );
        return null;
      }

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
      const authWindow = window.open(authUrl, '_blank');

      if (authWindow) {
        ui.notifications.info('Waiting for Patreon authentication... Complete the login in the opened tab.');
      } else {
        // In Electron, window.open may return null even on success.
        // Popup close detection won't work, so polling runs the full timeout.
        ui.notifications.info(
          'Patreon login opened. Complete the login, then return here. ' +
          'If nothing happens after a couple minutes, try again.'
        );
      }

      // Poll for authentication completion, watching for closed popup
      const userData = await this.pollForAuthentication(userId, authWindow);

      if (userData) {
        console.log(`${LOG_PREFIX} | Authentication completed successfully`, userData);

        // Save user data to settings
        await game.settings.set(MODULE_ID, 'user', userData);

        // Update global state
        if (game.dlcMaps) {
          game.dlcMaps.user = userData;
        }

        // Provide clear feedback based on access level
        if (userData.has_premium) {
          ui.notifications.info(`Welcome! You have Premium access (${userData.tier_name}). All maps are available.`);
        } else if (userData.has_free) {
          ui.notifications.info(`Welcome! You have Free tier access (${userData.tier_name}). Upgrade on Patreon for premium maps.`);
        } else {
          ui.notifications.warn(
            `Authenticated with Patreon, but your account does not have an active pledge. ` +
            `Free maps are still available. Visit our Patreon page to subscribe for premium maps.`
          );
        }

        return userData;
      } else {
        console.warn(`${LOG_PREFIX} | Authentication timed out or was cancelled`);
        ui.notifications.warn(
          'Patreon authentication was not completed. If you saw an error on Patreon\'s page, ' +
          'please try again. Free maps are available without logging in.'
        );
        return null;
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} | Error during Patreon login:`, error);
      ui.notifications.error(
        'Failed to authenticate with Patreon. Please try again. ' +
        'If the problem persists, free maps are still available without logging in.'
      );
      return null;
    }
  }

  /**
   * Poll API for authentication completion
   * Checks every 2 seconds for up to 2 minutes.
   * Stops early if the auth popup is closed without completing.
   */
  private async pollForAuthentication(_userId: string, authWindow: Window | null): Promise<DLCUser | null> {
    const maxAttempts = 60; // 2 minutes (60 * 2 seconds)
    const pollInterval = 2000; // 2 seconds
    let windowClosedCount = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      // Check if the auth popup was closed without completing
      // Give a few poll cycles after close in case the redirect completed just before
      if (authWindow && authWindow.closed) {
        windowClosedCount++;
        if (windowClosedCount >= 3) {
          console.warn(`${LOG_PREFIX} | Auth window was closed without completing authentication`);
          return null;
        }
      }

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
