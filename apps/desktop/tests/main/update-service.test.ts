import { describe, expect, it, vi } from 'vitest';

import {
  UpdateNotReadyError,
  UpdateService,
  type UpdateEvent,
  type UpdaterAdapter,
} from '@/main/updates/service';
import type { UpdateState } from '@/shared/contracts';

function createHarness(options: { packaged?: boolean; firstRun?: boolean } = {}) {
  const listeners = new Map<UpdateEvent, (metadata?: { version?: string | null }) => void>();
  const updater: UpdaterAdapter = {
    on: vi.fn((event, listener) => listeners.set(event, listener)),
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(),
  };
  const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
  const states: UpdateState[] = [];
  const service = new UpdateService({
    updater,
    feedUrl: 'https://update.electronjs.org/tillwithered/vetka-desktop/win32-x64/1.0.0',
    packaged: options.packaged ?? true,
    firstRun: options.firstRun ?? false,
    schedule: (callback, delayMs) => scheduled.push({ callback, delayMs }),
    onStateChanged: (state) => states.push(state),
  });

  return {
    emit(event: UpdateEvent, metadata?: { version?: string | null }) {
      listeners.get(event)?.(metadata);
    },
    listeners,
    scheduled,
    service,
    states,
    updater,
  };
}

describe('UpdateService', () => {
  it('configures the exact HTTPS feed and schedules a check in packaged builds', () => {
    const harness = createHarness();

    harness.service.start();

    expect(harness.updater.setFeedURL).toHaveBeenCalledWith({
      url: 'https://update.electronjs.org/tillwithered/vetka-desktop/win32-x64/1.0.0',
    });
    expect(harness.scheduled).toHaveLength(1);
    expect(harness.scheduled[0]?.delayMs).toBe(1_000);
    expect(harness.service.getState()).toEqual({ status: 'idle' });
  });

  it('waits ten seconds on Squirrel first run', () => {
    const harness = createHarness({ firstRun: true });

    harness.service.start();

    expect(harness.scheduled[0]?.delayMs).toBe(10_000);
  });

  it('does nothing outside a packaged build', () => {
    const harness = createHarness({ packaged: false });

    harness.service.start();

    expect(harness.updater.setFeedURL).not.toHaveBeenCalled();
    expect(harness.updater.on).not.toHaveBeenCalled();
    expect(harness.scheduled).toHaveLength(0);
  });

  it('moves through checking, available, and downloaded states', async () => {
    const harness = createHarness();
    harness.service.start();

    await harness.service.check();
    harness.emit('update-available', { version: '1.0.1' });
    harness.emit('update-downloaded', { version: '1.0.1' });

    expect(harness.states).toEqual([
      { status: 'checking' },
      { status: 'available', version: '1.0.1' },
      { status: 'downloaded', version: '1.0.1' },
    ]);
    expect(harness.service.getState()).toEqual({ status: 'downloaded', version: '1.0.1' });
  });

  it('returns to idle when there is no update', async () => {
    const harness = createHarness();
    harness.service.start();

    await harness.service.check();
    harness.emit('update-not-available');

    expect(harness.service.getState()).toEqual({ status: 'idle' });
  });

  it('suppresses duplicate checks while checking or downloading', async () => {
    const harness = createHarness();
    harness.service.start();

    await harness.service.check();
    await harness.service.check();
    harness.emit('update-available', { version: '1.0.1' });
    await harness.service.check();

    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('sanitizes updater failures and allows a later retry', async () => {
    const harness = createHarness();
    harness.service.start();

    harness.emit('error', { version: 'secret https://token@example.test' });

    expect(harness.service.getState()).toEqual({
      status: 'error',
      message: 'Не удалось проверить обновления. Приложение продолжит работать.',
    });
    expect(JSON.stringify(harness.service.getState())).not.toContain('token');

    await harness.service.check();
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('rejects restart before download and installs only a downloaded update', () => {
    const harness = createHarness();
    harness.service.start();

    expect(() => harness.service.restartAndInstall()).toThrow(UpdateNotReadyError);
    expect(harness.updater.quitAndInstall).not.toHaveBeenCalled();

    harness.emit('update-downloaded', { version: '1.0.1' });
    harness.service.restartAndInstall();

    expect(harness.updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
