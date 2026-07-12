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
    const client = new MattelCreationsClient({
      fetchHtml: vi.fn(async () => { throw new Error('offline'); }),
      browser: { open: vi.fn(async () => { throw new Error('browser offline'); }) },
    });
    expect(await client.collect()).toMatchObject({ complete: false, products: [] });
  });

  it('recovers a rate-limited collection page through the direct browser', async () => {
    const fetchHtml = vi.fn(async (url: string) => {
      if (url === landingUrl) throw new Error('Mattel returned HTTP 429');
      if (url === collectionUrl) return '<div id="collectionApp"></div>';
      return fixture('in-stock.html');
    });
    const browser = { open: vi.fn(async (url: string) => url === landingUrl
      ? `<div id="shopify-section-template--mh__hero"><a href="${gozerUrl}">Gozer Doll</a></div>`
      : fixture('in-stock.html')) };

    const result = await new MattelCreationsClient({ fetchHtml, browser }).collect();

    expect(result.complete).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(1);
    expect(browser.open).toHaveBeenCalledWith(landingUrl);
  });

  it('marks a suspiciously small discovery as incomplete', async () => {
    const fetchHtml = vi.fn(async (url: string) => url === landingUrl
      ? `<div id="shopify-section-template--mh__hero"><a href="${gozerUrl}">Gozer Doll</a></div>`
      : url === collectionUrl ? '<div id="collectionApp"></div>' : fixture('in-stock.html'));

    const result = await new MattelCreationsClient({
      fetchHtml,
      browser: { open: vi.fn() },
      minimumDiscoveredProducts: 3,
    }).collect();

    expect(result.complete).toBe(false);
    expect(result.products).toHaveLength(1);
    expect(result.errors.some((error) => error.message.includes('only 1 product links'))).toBe(true);
  });

  it('checks independent product pages with bounded parallelism', async () => {
    const urls = Array.from({ length: 8 }, (_value, index) => `https://creations.mattel.com/products/monster-high-doll-${index}`);
    let active = 0;
    let maximumActive = 0;
    const fetchHtml = vi.fn(async (url: string) => {
      if (url === landingUrl) return `<div id="shopify-section-template--mh__grid">${urls.map((item) => `<a href="${item}">Monster High Doll</a>`).join('')}</div>`;
      if (url === collectionUrl) return '<div id="collectionApp"></div>';
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return fixture('in-stock.html');
    });
    const client = new MattelCreationsClient({ fetchHtml, browser: { open: vi.fn() } });

    await client.collect();

    expect(maximumActive).toBeGreaterThan(1);
    expect(maximumActive).toBeLessThanOrEqual(6);
  });

  it('serializes browser fallback while direct product requests remain parallel', async () => {
    const urls = Array.from({ length: 4 }, (_value, index) => `https://creations.mattel.com/products/monster-high-ambiguous-doll-${index}`);
    const fetchHtml = vi.fn(async (url: string) => {
      if (url === landingUrl) return `<div id="shopify-section-template--mh__grid">${urls.map((item) => `<a href="${item}">Monster High Doll</a>`).join('')}</div>`;
      if (url === collectionUrl) return '<div id="collectionApp"></div>';
      return '<h1>Monster High Ambiguous Doll</h1><span>Coming Soon</span><span>Sold Out</span>';
    });
    let browserActive = 0;
    let maximumBrowserActive = 0;
    const browser = { open: vi.fn(async () => {
      browserActive += 1;
      maximumBrowserActive = Math.max(maximumBrowserActive, browserActive);
      await new Promise((resolve) => setTimeout(resolve, 5));
      browserActive -= 1;
      return fixture('in-stock.html');
    }) };

    await new MattelCreationsClient({ fetchHtml, browser }).collect();

    expect(browser.open).toHaveBeenCalledTimes(4);
    expect(maximumBrowserActive).toBe(1);
  });
});
