import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { registerIpcHandlers, type IpcRegistrar } from '@/main/ipc/register-ipc';
import { SettingsRepository } from '@/main/settings/repository';
import { channels } from '@/shared/channels';

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  runMigrations(db);
});

afterEach(() => db.close());

describe('validated IPC', () => {
  it('does not call a repository when doll input is invalid', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const registrar: IpcRegistrar = {
      handle: vi.fn((channel, handler) => handlers.set(channel, handler)),
    };
    const dolls = new DollRepository(db);
    const createSpy = vi.spyOn(dolls, 'create');

    registerIpcHandlers(registrar, {
      dolls,
      settings: new SettingsRepository(db),
      version: () => '0.0.0-test',
    });

    const result = await handlers.get(channels.dollsCreate)?.({}, { name: ' ' });

    expect(createSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(JSON.stringify(result)).not.toContain('stack');
  });

  it('returns typed data for a valid request', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const registrar: IpcRegistrar = {
      handle: (channel, handler) => handlers.set(channel, handler),
    };
    registerIpcHandlers(registrar, {
      dolls: new DollRepository(db),
      settings: new SettingsRepository(db),
      version: () => '1.2.3',
    });

    const result = await handlers.get(channels.dollsCreate)?.({}, { name: 'Abbey Bominable' });

    expect(result).toMatchObject({
      ok: true,
      data: { name: 'Abbey Bominable', isFavorite: false },
    });
  });
});
