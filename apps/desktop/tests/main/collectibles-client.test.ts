import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { MattelCreationsClient } from '@/main/collectibles/client';

const fixtures = path.join(__dirname, '..', 'fixtures', 'mattel-creations');
const fixture = (name: string) => readFileSync(path.join(fixtures, name), 'utf8');
const collectionUrl = 'https://creations.mattel.com/collections/monster-high';
const landingUrl = 'https://creations.mattel.com/pages/monster-high';
const gozerUrl = 'https://creations.mattel.com/products/monster-high-skullector-ghostbusters-gozer-doll-jkm54';

describe('MattelCreationsClient', () => {
  it('uses direct fetch and browser fallback only for an ambiguous product', async () => {
    const fetchHtml = vi.fn(async (url: string) => url === landingUrl
      ? `<div id="shopify-section-template--mh__hero"><button data-href="${gozerUrl}">Pre-Order</button></div>`
      : url === collectionUrl ? '<div id="collectionApp"><article class="collection-grid__product"><a href="/products/monster-high-skullector-ghostbusters-gozer-doll-jkm54">Gozer Doll</a></article></div>'
      : '<h1>Monster High Gozer Doll</h1><span>Coming Soon</span><span>Sold Out</span>');
    const browser = { open: vi.fn(async () => fixture('in-stock.html')) };
    const client = new MattelCreationsClient({ fetchHtml, browser, now: () => new Date('2026-07-12T00:00:00.000Z') });

    const result = await client.collect();

    expect(fetchHtml).toHaveBeenNthCalledWith(1, landingUrl);
    expect(fetchHtml).toHaveBeenNthCalledWith(2, collectionUrl);
    expect(fetchHtml).toHaveBeenCalledWith(gozerUrl);
    expect(browser.open).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ complete: true, errors: [] });
    expect(result.products[0]).toMatchObject({ mattelSku: 'JKM54', checkedAt: '2026-07-12T00:00:00.000Z' });
  });

  it('reports a failed product without making the collection scan incomplete', async () => {
    const fetchHtml = vi.fn(async (url: string) => {
      if (url === landingUrl) return `<div id="shopify-section-template--mh__hero"><a href="${gozerUrl}">Gozer Doll</a></div>`;
      if (url === collectionUrl) return '<div id="collectionApp"></div>';
      throw new Error('product unavailable');
    });
    const client = new MattelCreationsClient({ fetchHtml, browser: { open: vi.fn() } });

    expect(await client.collect()).toMatchObject({ complete: true, products: [], errors: [{ url: gozerUrl }] });
  });

  it('marks collection transport failure as incomplete', async () => {
    const client = new MattelCreationsClient({ fetchHtml: vi.fn(async () => { throw new Error('offline'); }), browser: { open: vi.fn() } });
    expect(await client.collect()).toMatchObject({ complete: false, products: [] });
  });
});
