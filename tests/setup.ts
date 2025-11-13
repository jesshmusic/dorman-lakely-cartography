/**
 * Jest Test Setup
 * Runs before all tests to set up global mocks and utilities
 */

import { jest } from '@jest/globals';

// Mock global Foundry API
(global as any).game = {
  modules: new Map(),
  settings: {
    register: jest.fn(),
    get: jest.fn(),
    set: jest.fn()
  },
  user: {
    id: 'test-user',
    isGM: true
  },
  users: new Map(),
  scenes: new Map(),
  ready: true,
  dlcMaps: {
    maps: [],
    tags: [],
    user: null,
    settings: {
      userId: null,
      user: null,
      apiConfig: {
        baseUrl: 'https://api.test.com',
        patreonClientId: 'test-client-id',
        patreonRedirectUri: 'https://api.test.com/callback'
      },
      downloadPath: 'modules/dorman-lakely-cartography/assets/scenes/',
      concurrentDownloads: 5,
      cacheExpiry: 86400000 // 24 hours in ms
    }
  }
} as any;

(global as any).ui = {
  notifications: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    notify: jest.fn()
  }
} as any;

(global as any).Hooks = {
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  call: jest.fn(),
  callAll: jest.fn()
} as any;

(global as any).foundry = {
  utils: {
    randomID: jest.fn(() => 'mock-random-id-12345'),
    mergeObject: jest.fn((original: any, other: any) => ({ ...original, ...other }))
  },
  applications: {
    api: {
      ApplicationV2: class MockApplicationV2 {
        constructor(_options?: any) {}
        render = jest.fn();
        close = jest.fn();
        _prepareContext = jest.fn();
        _onRender = jest.fn();
      },
      HandlebarsApplicationMixin: {}
    }
  }
} as any;

(global as any).FilePicker = {
  browse: jest.fn<any>().mockResolvedValue({ files: [] }),
  upload: jest.fn<any>().mockResolvedValue({})
} as any;

(global as any).renderTemplate = jest.fn<any>().mockResolvedValue('<div>Mock Template</div>');

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

// Mock fetch
(global as any).fetch = jest.fn();

// Mock window
Object.defineProperty(global, 'window', {
  value: {
    open: jest.fn()
  }
});

// Suppress console logs in tests (optional)
// global.console.log = jest.fn();
// global.console.warn = jest.fn();
// global.console.error = jest.fn();
