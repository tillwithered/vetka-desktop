import { describe, expect, it, vi } from 'vitest';

import { acquireSingleInstanceLock } from '@/main/single-instance';

describe('acquireSingleInstanceLock', () => {
  it('quits a duplicate process instead of allowing a second main process', () => {
    const app = { requestSingleInstanceLock: vi.fn(() => false), quit: vi.fn(), on: vi.fn() };

    expect(acquireSingleInstanceLock(app, vi.fn())).toBe(false);
    expect(app.quit).toHaveBeenCalledOnce();
    expect(app.on).not.toHaveBeenCalled();
  });

  it('keeps the primary process and focuses it when another launch is requested', () => {
    let secondInstance: (() => void) | undefined;
    const focus = vi.fn();
    const app = {
      requestSingleInstanceLock: vi.fn(() => true),
      quit: vi.fn(),
      on: vi.fn((_event: string, listener: () => void) => { secondInstance = listener; }),
    };

    expect(acquireSingleInstanceLock(app, focus)).toBe(true);
    secondInstance?.();
    expect(focus).toHaveBeenCalledOnce();
    expect(app.quit).not.toHaveBeenCalled();
  });
});
