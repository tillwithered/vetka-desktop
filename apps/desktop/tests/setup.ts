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
  dolls: {
    list: async () => ({ ok: true, data: [] }),
    get: async () => ({ ok: true, data: null }),
    create: async () => ({ ok: false, error: { code: 'TEST', message: 'Not mocked' } }),
    update: async () => ({ ok: false, error: { code: 'TEST', message: 'Not mocked' } }),
    setFavorite: async () => ({ ok: false, error: { code: 'TEST', message: 'Not mocked' } }),
  },
  settings: { getAll: async () => ({ ok: true, data: {} }), set: async (_key: string, value: unknown) => ({ ok: true, data: value }) },
  amazon: {
    addListing: async () => ({ ok: true, data: {} }),
    refreshDoll: async () => ({ ok: true, data: { requestId: 'test', regions: {} } }),
    reviewCandidate: async () => ({ ok: true, data: {} }),
    onProgress: () => (): void => undefined,
  },
  prices: { current: async () => ({ ok: true, data: [] }), history: async () => ({ ok: true, data: [] }) },
};

Object.defineProperty(window, 'vetka', {
  configurable: true,
  writable: true,
  value: testApi,
});
