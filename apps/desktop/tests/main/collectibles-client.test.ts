import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { MattelCreationsClient } from '@/main/collectibles/client';

const fixtures = path.join(__dirname, '..', 'fixtures', 'mattel-creations');
const fixture = (name: string) => readFileSync(path.join(fixtures, name), 'utf8');
const collectionUrl = 'https://creations.mattel.com/collections/monster-high';
const gozerUrl = 'https://creations.mattel.com/products/monster-high-skullector-ghostbusters-gozer-doll-jkm54';

describe('MattelCreationsClient', () => {
  it('uses direct fetch and browser fallback only for an ambiguous product', async () => {
    const fetchHtml = vi.fn(async (url: string) => url === collectionUrl
      ? `<a href="${gozerUrl}">Monster High Gozer Doll</a>`
      : '<h1>Monster High Gozer Doll</h1><span>Coming Soon</span><span>Sold Out</span>');
    const browser = { open: vi.fn(async () => fixture('in-stock.html')) };
    const client = new MattelCreationsClient({ fetchHtml, browser, now: () => new Date('2026-07-12T00:00:00.000Z') });

    const result = await client.collect();

    expect(fetchHtml).toHaveBeenNthCalledWith(1, collectionUrl);
    expect(fetchHtml).toHaveBeenNthCalledWith(2, gozerUrl);
    expect(browser.open).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ complete: true, errors: [] });
    expect(result.products[0]).toMatchObject({ mattelSku: 'JKM54', checkedAt: '2026-07-12T00:00:00.000Z' });
  });

  it('reports a failed product without making the collection scan incomplete', async () => {
    const fetchHtml = vi.fn(async (url: string) => {
      if (url === collectionUrl) return `<a href="${gozerUrl}">Monster High Gozer Doll</a>`;
      throw new Error('product unavailable');
    });
    const client = new MattelCreationsClient({ fetchHtml, browser: { open: vi.fn() } });

    expect(await client.collect()).toMatchObject({ complete: true, products: [], errors: [{ url: gozerUrl }] });
  });

  it('marks collection transport failure as incomplete', async () => {
    const client = new MattelCreationsClient({ fetchHtml: vi.fn(async () => { throw new Error('offline'); }), browser: { open: vi.fn() } });
    expect(await client.collect()).toMatchObject({ complete: false, products: [], errors: [{ url: collectionUrl }] });
  });
});
