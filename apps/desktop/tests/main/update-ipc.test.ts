import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { registerIpcHandlers, type IpcRegistrar } from '@/main/ipc/register-ipc';
import { SettingsRepository } from '@/main/settings/repository';
import { UpdateNotReadyError } from '@/main/updates/service';
import { channels } from '@/shared/channels';
import type { UpdateState } from '@/shared/contracts';

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  runMigrations(db);
});

afterEach(() => db.close());

function createHarness(state: UpdateState = { status: 'idle' }) {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const registrar: IpcRegistrar = {
    handle: (channel, handler) => handlers.set(channel, handler),
  };
  const updates = {
    getState: vi.fn(() => state),
    check: vi.fn(async () => state),
    restartAndInstall: vi.fn(() => {
      if (state.status !== 'downloaded') throw new UpdateNotReadyError();
    }),
  };

  registerIpcHandlers(registrar, {
    dolls: new DollRepository(db),
    settings: new SettingsRepository(db),
    version: () => '1.0.0',
    updates,
  });

  return { handlers, updates };
}

describe('update IPC', () => {
  it('returns the current typed state', async () => {
    const harness = createHarness({ status: 'downloaded', version: '1.0.1' });

    const result = await harness.handlers.get(channels.updatesGetState)?.({});

    expect(result).toEqual({ ok: true, data: { status: 'downloaded', version: '1.0.1' } });
  });

  it('delegates a manual check', async () => {
    const harness = createHarness();

    const result = await harness.handlers.get(channels.updatesCheck)?.({});

    expect(harness.updates.check).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, data: { status: 'idle' } });
  });

  it('returns UPDATE_NOT_READY and never installs before download', async () => {
    const harness = createHarness();

    const result = await harness.handlers.get(channels.updatesRestartAndInstall)?.({});

    expect(harness.updates.restartAndInstall).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      error: { code: 'UPDATE_NOT_READY', message: 'Обновление ещё не готово к установке' },
    });
  });

  it('installs only a downloaded update', async () => {
    const harness = createHarness({ status: 'downloaded', version: '1.0.1' });

    const result = await harness.handlers.get(channels.updatesRestartAndInstall)?.({});

    expect(harness.updates.restartAndInstall).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, data: null });
  });

  it('does not leak updater errors or feed URLs', async () => {
    const harness = createHarness();
    harness.updates.check.mockRejectedValueOnce(
      new Error('token at https://update.electronjs.org/private-owner/private-repo'),
    );

    const result = await harness.handlers.get(channels.updatesCheck)?.({});

    expect(result).toEqual({
      ok: false,
      error: { code: 'UPDATE_ERROR', message: 'Не удалось проверить обновления' },
    });
    expect(JSON.stringify(result)).not.toContain('private-owner');
    expect(JSON.stringify(result)).not.toContain('stack');
  });
});
