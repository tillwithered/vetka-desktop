import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { registerIpcHandlers, type IpcRegistrar } from '@/main/ipc/register-ipc';
import { SettingsRepository } from '@/main/settings/repository';
import { channels } from '@/shared/channels';
import type { CatalogScanState } from '@/main/catalog/scan-service';
import type { CollectiblesScanState } from '@/shared/contracts';

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

  it('returns scan state and delegates a manual catalog refresh', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const state: CatalogScanState = { status: 'idle', startedAt: null, completedAt: null, nextRunAt: null, processed: 0, total: 0 };
    const scanService = { getState: vi.fn(() => state), runNow: vi.fn(async () => state) };
    registerIpcHandlers({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      dolls: new DollRepository(db), settings: new SettingsRepository(db), version: () => '1.2.3', scanService,
    });

    await expect(handlers.get(channels.catalogRefreshNow)?.({})).resolves.toEqual({ ok: true, data: state });
    expect(scanService.runNow).toHaveBeenCalledTimes(1);
    expect(handlers.get(channels.catalogGetScanState)?.({})).toEqual({ ok: true, data: state });
  });

  it('lists collectibles and delegates their independent manual refresh', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const state: CollectiblesScanState = { status: 'idle', startedAt: null, completedAt: null, nextRunAt: null, processed: 0, total: 0, lastError: null };
    const collectibles = {
      list: vi.fn(() => [{ id: 'c1', officialName: 'Monster High Gozer Doll' }]),
      getState: vi.fn(() => state),
      runNow: vi.fn(async () => state),
    };
    registerIpcHandlers({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      dolls: new DollRepository(db), settings: new SettingsRepository(db), version: () => '1.2.3', collectibles: collectibles as never,
    });

    await expect(handlers.get(channels.collectiblesList)?.({}, { archived: false, query: 'Gozer' }))
      .resolves.toMatchObject({ ok: true, data: [{ id: 'c1' }] });
    expect(collectibles.list).toHaveBeenCalledWith({ archived: false, query: 'Gozer' });
    expect(handlers.get(channels.collectiblesGetScanState)?.({})).toEqual({ ok: true, data: state });
    await expect(handlers.get(channels.collectiblesRefreshNow)?.({})).resolves.toEqual({ ok: true, data: state });
  });

  it('keeps a bounded collector error instead of a generic operation error', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const dolls = new DollRepository(db);
    const doll = dolls.create({ name: 'Draculaura' });
    registerIpcHandlers({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      dolls,
      settings: new SettingsRepository(db),
      version: () => '1.2.3',
      priceService: { refreshDoll: vi.fn(async () => { throw new Error('Collector worker exited'); }) } as never,
    });

    await expect(handlers.get(channels.amazonRefreshDoll)?.({}, { dollId: doll.id, regions: ['amazon_us'] }))
      .resolves.toEqual({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Collector worker exited' } });
  });

  it('uses a dedicated redacted IPC surface for collector proxy routes', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const transport = {
      getPublic: vi.fn(() => ({ mode: 'proxy', regions: { amazon_uk: { configured: true, routeCount: 1, labels: ['uk.example:10000'] } } })),
      replace: vi.fn(() => ({ mode: 'proxy', regions: { amazon_uk: { configured: true, routeCount: 1, labels: ['uk.example:10000'] } } })),
    };
    registerIpcHandlers({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      dolls: new DollRepository(db), settings: new SettingsRepository(db), version: () => '1.2.3', proxyTransport: transport as never,
    });

    expect(handlers.get(channels.collectorTransportGet)?.({})).toMatchObject({ ok: true, data: { mode: 'proxy' } });
    await expect(handlers.get(channels.collectorTransportSet)?.({}, {
      mode: 'proxy', routes: { amazon_uk: ['http://violet:very-secret@uk.example:10000'] },
    })).resolves.toMatchObject({ ok: true, data: { regions: { amazon_uk: { labels: ['uk.example:10000'] } } } });
    expect(JSON.stringify(await handlers.get(channels.collectorTransportGet)?.({}))).not.toContain('very-secret');
  });

  it('returns the complete regional price state through a validated endpoint', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const regions = { list: vi.fn(() => [{ region: 'amazon_us', status: 'unchecked' }]) };
    registerIpcHandlers({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      dolls: new DollRepository(db), settings: new SettingsRepository(db), version: () => '1.2.3',
      regionStates: regions as never,
    });

    await expect(handlers.get(channels.pricesRegions)?.({}, 'doll-1'))
      .resolves.toMatchObject({ ok: true, data: [{ region: 'amazon_us', status: 'unchecked' }] });
    expect(regions.list).toHaveBeenCalledWith('doll-1');
    await expect(handlers.get(channels.pricesRegions)?.({}, ' '))
      .resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });
});
