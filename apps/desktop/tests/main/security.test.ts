import { describe, expect, it } from 'vitest';

import { secureWebPreferences } from '@/main/window-options';

describe('secureWebPreferences', () => {
  it('isolates the renderer from Node.js', () => {
    expect(secureWebPreferences).toMatchObject({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    });
  });
});
