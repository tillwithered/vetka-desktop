import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '@/main/db/migrate';
import { ProxyTransportRepository } from '@/main/settings/proxy-transport-repository';
import { SettingsRepository } from '@/main/settings/repository';

describe('ProxyTransportRepository', () => {
  let db: DatabaseSync;
  afterEach(() => db?.close());

  it('encrypts routes at rest and exposes only redacted transport state', () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const settings = new SettingsRepository(db);
    const encryptString = vi.fn((value: string) => Buffer.from(`cipher:${value}`));
    const decryptString = vi.fn((value: Buffer) => value.toString().replace(/^cipher:/, ''));
    const repository = new ProxyTransportRepository(settings, { encryptString, decryptString });

    repository.replace({
      mode: 'proxy',
      routes: { amazon_uk: ['http://violet:very-secret@uk.example:10000'] },
    });

    const ciphertext = settings.get<string>('_private.amazonProxyTransport');
    expect(encryptString).toHaveBeenCalledWith(expect.stringContaining('very-secret'));
    expect(ciphertext).toBe(Buffer.from(`cipher:${encryptString.mock.calls[0]?.[0]}`).toString('base64'));
    expect(ciphertext).not.toContain('very-secret');
    expect(settings.getAll()).not.toHaveProperty('_private.amazonProxyTransport');
    expect(repository.getResolved().routes.amazon_uk?.[0]).toMatchObject({ username: 'violet', password: 'very-secret' });
    expect(repository.getPublic()).toMatchObject({
      mode: 'proxy', regions: { amazon_uk: { configured: true, labels: ['uk.example:10000'] } },
    });
  });
});
