/**
 * Patreon Auth Service Tests
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { PatreonAuthService } from '../../src/services/patreon-auth-service';
import { APIService } from '../../src/services/api-service';
import { DLCAPIConfig } from '../../src/types/module';

describe('PatreonAuthService', () => {
  let authService: PatreonAuthService;
  let apiService: APIService;
  let mockConfig: DLCAPIConfig;

  beforeEach(() => {
    jest.useFakeTimers();

    mockConfig = {
      baseUrl: 'https://api.test.com',
      patreonClientId: 'test-client-id',
      patreonRedirectUri: 'https://api.test.com/callback'
    };

    apiService = new APIService(mockConfig, 'test-user-id');

    authService = new PatreonAuthService(apiService, mockConfig);

    // Reset mocks
    (ui.notifications.info as any).mockClear();
    (ui.notifications.warn as any).mockClear();
    (ui.notifications.error as any).mockClear();
    (game.settings.set as any).mockClear();
    (window.open as any).mockClear();
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('login - client ID validation', () => {
    it('should return null and show error when patreonClientId is missing', async () => {
      const badConfig: DLCAPIConfig = {
        baseUrl: 'https://api.test.com',
        patreonClientId: '',
        patreonRedirectUri: 'https://api.test.com/callback'
      };
      const service = new PatreonAuthService(apiService, badConfig);

      const result = await service.login();

      expect(result).toBeNull();
      expect(ui.notifications.error).toHaveBeenCalledWith(
        expect.stringContaining('not yet configured')
      );
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should return null and show error when patreonClientId is the placeholder value', async () => {
      const badConfig: DLCAPIConfig = {
        baseUrl: 'https://api.test.com',
        patreonClientId: 'YOUR_PATREON_CLIENT_ID',
        patreonRedirectUri: 'https://api.test.com/callback'
      };
      const service = new PatreonAuthService(apiService, badConfig);

      const result = await service.login();

      expect(result).toBeNull();
      expect(ui.notifications.error).toHaveBeenCalledWith(
        expect.stringContaining('not yet configured')
      );
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should proceed with login when patreonClientId is valid', async () => {
      (window.open as any).mockReturnValue({ closed: false });
      // Mock checkUserStatus to return null (no auth yet) so polling starts
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404
      });

      // Start login but don't await - we just want to verify it opens the popup
      const loginPromise = authService.login();

      // Advance past first poll interval
      await jest.advanceTimersByTimeAsync(2000);

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('patreon.com/oauth2/authorize'),
        '_blank'
      );
      expect(ui.notifications.error).not.toHaveBeenCalled();

      // Clean up: advance timers to let polling finish
      // Close the mock window to trigger early exit
      const mockWindow = (window.open as any).mock.results[0].value as any;
      mockWindow.closed = true;
      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(2000);
      }
      await loginPromise;
    });
  });

  describe('login - null authWindow fallback', () => {
    it('should show fallback message when window.open returns null', async () => {
      (window.open as any).mockReturnValue(null);
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404
      });

      const loginPromise = authService.login();

      // Advance enough for timeout
      for (let i = 0; i < 62; i++) {
        await jest.advanceTimersByTimeAsync(2000);
      }
      await loginPromise;

      expect(ui.notifications.info).toHaveBeenCalledWith(
        expect.stringContaining('If nothing happens after a couple minutes')
      );
    });
  });

  describe('pollForAuthentication - closed window detection', () => {
    it('should stop polling early when auth window is closed', async () => {
      const mockWindow = { closed: false };
      (window.open as any).mockReturnValue(mockWindow);
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404
      });

      const loginPromise = authService.login();

      // Advance 2 polls with window open
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(2000);

      // Close the window
      mockWindow.closed = true;

      // Should still poll a few more times (3 cycles of closed detection)
      await jest.advanceTimersByTimeAsync(2000); // windowClosedCount = 1
      await jest.advanceTimersByTimeAsync(2000); // windowClosedCount = 2
      await jest.advanceTimersByTimeAsync(2000); // windowClosedCount = 3 -> returns null

      const result = await loginPromise;

      expect(result).toBeNull();
      expect(ui.notifications.warn).toHaveBeenCalledWith(
        expect.stringContaining('not completed')
      );
    });

    it('should still check user status during grace period after window close', async () => {
      const mockWindow = { closed: false };
      (window.open as any).mockReturnValue(mockWindow);

      const mockUserData = {
        has_premium: true,
        has_free: false,
        tier_name: 'Premium',
        expires_in: Date.now() + 86400000
      };

      // Return 404 for first 2 ready checks, then return user data
      let readyCallCount = 0;
      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('/ready')) {
          readyCallCount++;
          if (readyCallCount >= 3) {
            return { ok: true, json: async () => mockUserData };
          }
        }
        return { ok: false, status: 404 };
      });

      const loginPromise = authService.login();

      // Poll once with window open
      await jest.advanceTimersByTimeAsync(2000);

      // Poll again with window open
      await jest.advanceTimersByTimeAsync(2000);

      // Close the window (redirect just completed)
      mockWindow.closed = true;

      // Grace period: windowClosedCount=1, readyCallCount reaches 3 -> returns user data
      await jest.advanceTimersByTimeAsync(2000);

      const result = await loginPromise;

      expect(result).toEqual(mockUserData);
      expect(ui.notifications.info).toHaveBeenCalledWith(
        expect.stringContaining('Premium access')
      );
    }, 15000);

    it('should run full timeout when authWindow is null', async () => {
      (window.open as any).mockReturnValue(null);

      let pollCount = 0;
      (global.fetch as any).mockImplementation(async () => {
        pollCount++;
        return { ok: false, status: 404 };
      });

      const loginPromise = authService.login();

      // Advance through all 60 poll cycles
      for (let i = 0; i < 62; i++) {
        await jest.advanceTimersByTimeAsync(2000);
      }

      await loginPromise;

      // Should have polled many times (no early exit since authWindow is null)
      expect(pollCount).toBeGreaterThan(50);
    });
  });
});
