import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCollectibleCollection, parseCollectibleLanding, parseCollectibleProduct } from '@/main/collectibles/parser';

const fixture = (name: string) => readFileSync(path.join(__dirname, '..', 'fixtures', 'mattel-creations', name), 'utf8');
const baseUrl = 'https://creations.mattel.com/collections/monster-high';
const gozerUrl = 'https://creations.mattel.com/products/monster-high-skullector-ghostbusters-gozer-doll-jkm54';

describe('Mattel Creations parser', () => {
  it('discovers unique doll product URLs and excludes obvious merchandise', () => {
    expect(parseCollectibleCollection(fixture('collection.html'), baseUrl)).toEqual([
      gozerUrl,
      'https://creations.mattel.com/products/beetlejuice-waiting-room-2-pack-jcx58',
    ]);
  });

  it('discovers featured product links only inside landing-page content sections', () => {
    expect(parseCollectibleLanding(fixture('landing.html'), 'https://creations.mattel.com/pages/monster-high')).toEqual([
      gozerUrl,
      'https://creations.mattel.com/products/beetlejuice-waiting-room-2-pack-jcx58',
    ]);
  });

  it('parses exact identity, money, image, and in-stock lifecycle', () => {
    expect(parseCollectibleProduct(fixture('in-stock.html'), gozerUrl)).toMatchObject({
      mattelSku: 'JKM54',
      officialName: 'Monster High Skullector Ghostbusters Gozer Doll',
      nameRu: 'Гозер — Skullector',
      lineName: 'Skullector x Ghostbusters',
      priceMinor: 7000,
      currency: 'USD',
      lifecycle: 'in_stock',
      fangClubOnly: false,
      imageUrl: 'https://cdn.shopify.com/gozer.jpg',
    });
  });

  it('normalizes schema.org ImageObject data to a bindable image URL', () => {
    const html = `<script type="application/ld+json">{
      "@type":"Product",
      "name":"Monster High Skullector Ghostbusters Gozer Doll",
      "sku":"JKM54",
      "image":{"@type":"ImageObject","url":"https://cdn.shopify.com/gozer-object.jpg"},
      "offers":{"price":"70","priceCurrency":"USD","availability":"https://schema.org/InStock"}
    }</script>`;

    expect(parseCollectibleProduct(html, gozerUrl)).toMatchObject({
      imageUrl: 'https://cdn.shopify.com/gozer-object.jpg',
    });
  });

  it('parses a sold-out doll without treating hidden Add to Bag copy as availability', () => {
    expect(parseCollectibleProduct(fixture('sold-out.html'), 'https://example.invalid')).toMatchObject({
      mattelSku: 'JCX58', lifecycle: 'sold_out', priceMinor: 10000,
    });
  });

  it('parses upcoming Fang Club timing from the active state', () => {
    expect(parseCollectibleProduct(fixture('coming-soon.html'), 'https://example.invalid')).toMatchObject({
      mattelSku: 'JKM44', lifecycle: 'fang_club', fangClubOnly: true,
      saleStartsAt: '2026-08-01T16:00:00.000Z',
    });
  });

  it('returns null for non-doll merchandise product data', () => {
    const html = '<script type="application/ld+json">{"@type":"Product","name":"Monster High Fang Club Hoodie","sku":"SHIRT","offers":{"price":"50","priceCurrency":"USD","availability":"https://schema.org/InStock"}}</script>';
    expect(parseCollectibleProduct(html, 'https://creations.mattel.com/products/hoodie')).toBeNull();
  });
});
