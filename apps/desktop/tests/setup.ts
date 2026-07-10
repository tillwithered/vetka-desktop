import '@testing-library/jest-dom/vitest';
import type { VetkaDesktopApi } from '@/shared/contracts';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: (): void => undefined,
    removeListener: (): void => undefined,
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
    dispatchEvent: (): boolean => false,
  }),
});

const testApi: VetkaDesktopApi = {
  health: async () => ({ ok: true, data: { version: 'test' } }),
  updates: {
    getState: async () => ({ ok: true, data: { status: 'idle' } }),
    check: async () => ({ ok: true, data: { status: 'idle' } }),
    restartAndInstall: async () => ({ ok: false, error: { code: 'UPDATE_NOT_READY', message: 'Not ready' } }),
    onStateChanged: () => (): void => undefined,
  },
  dolls: {
    list: async () => ({ ok: true, data: [] }),
    get: async () => ({ ok: true, data: null }),
    create: async () => ({ ok: false, error: { code: 'TEST', message: 'Not mocked' } }),
    update: async () => ({ ok: false, error: { code: 'TEST', message: 'Not mocked' } }),
    setFavorite: async () => ({ ok: false, error: { code: 'TEST', message: 'Not mocked' } }),
  },
  settings: { getAll: async () => ({ ok: true, data: {} }), set: async (_key: string, value: unknown) => ({ ok: true, data: value }) },
  catalog: {
    getScanState: async () => ({ ok: true, data: { status: 'idle', startedAt: null, completedAt: null, nextRunAt: null, processed: 0, total: 0 } }),
    refreshNow: async () => ({ ok: true, data: { status: 'idle', startedAt: null, completedAt: null, nextRunAt: null, processed: 0, total: 0 } }),
    onScanStateChanged: () => (): void => undefined,
  },
  amazon: {
    addListing: async () => ({ ok: true, data: {} }),
    refreshDoll: async () => ({ ok: true, data: { requestId: 'test', regions: {} } }),
    reviewCandidate: async () => ({ ok: true, data: {} }),
    resumeRegion: async () => ({ ok: true, data: null }),
    onProgress: () => (): void => undefined,
  },
  prices: { current: async () => ({ ok: true, data: [] }), history: async () => ({ ok: true, data: [] }) },
  orders: {
    list: async () => ({ ok: true, data: [] }),
    get: async () => ({ ok: true, data: null }),
    create: async () => ({ ok: false, error: { code: 'TEST', message: 'Not mocked' } }),
    transition: async () => ({ ok: false, error: { code: 'TEST', message: 'Not mocked' } }),
    updateTracking: async () => ({ ok: false, error: { code: 'TEST', message: 'Not mocked' } }),
  },
};

Object.defineProperty(window, 'vetka', {
  configurable: true,
  writable: true,
  value: testApi,
});
