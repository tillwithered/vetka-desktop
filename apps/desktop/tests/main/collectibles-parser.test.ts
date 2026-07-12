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

  it.each([
    ['Annabelle Monster High Skullector Doll', 'Аннабель — Skullector', 'Skullector'],
    ['Frankenstein & Bride of Frankenstein Monster High Skullector Doll Set', 'Франкенштейн и Невеста Франкенштейна — Skullector', 'Skullector'],
    ['Monster High 2024 Fang Vote Jinafire Long Doll', 'Джинафайр Лонг — Fang Vote', 'Fang Vote'],
    ['Monster High Clawdeen Haunt Couture Doll', 'Клодин Вульф — Haunt Couture', 'Haunt Couture'],
    ['Monster High Collectors Ghouluxe Ghoulia Yelps Doll', 'Гулия Йелпс — Ghouluxe', 'Ghouluxe'],
    ['Monster High Draculaura and Clawd Wolf Howliday Love 2-Pack', 'Дракулаура и Клод Вульф — Howliday', 'Howliday'],
    ['Monster High Howliday Día De Muertos Skelita Calaveras Doll', 'Скелита Калаверас — Howliday: Día de Muertos', 'Howliday: Día de Muertos'],
    ['Monster High Rave’N Dance Wednesday Doll', "Уэнсдэй Аддамс — Rave'N Dance", "Rave'N Dance"],
    ['Monster High Skullector Chucky and Tiffany Doll 2-Pack', 'Чаки и Тиффани — Skullector', 'Skullector'],
    ['Monster High Skullector Elvira Doll', 'Эльвира — Skullector', 'Skullector'],
    ['Monster High Skullector Greta Gremlin Doll', 'Грета Гремлин — Skullector', 'Skullector'],
    ['Monster High Skullector Series Creature From The Black Lagoon Doll', 'Существо из Чёрной лагуны — Skullector', 'Skullector'],
    ['Monster High Skullector The Nightmare Before Christmas DollS', 'Джек Скеллингтон и Салли — Skullector', 'Skullector'],
    ['Monster High Skullector Us Dolls – Adelaide and Red 2-Pack', 'Аделаида и Рэд — Skullector', 'Skullector'],
    ['Monster High Wednesday Morticia Addams Skullector Doll', 'Мортиша Аддамс — Skullector', 'Skullector'],
    ['Monster High x Wednesday Bianca Barclay Doll', 'Бьянка Барклай — Monster High x Wednesday', 'Monster High x Wednesday'],
    ['Off-White™ c/o Monster High Electra Melody Doll', 'Электра Мелоди — Off-White', 'Off-White'],
    ['Off-White™ c/o Monster High Harmonie Ghoul Doll', 'Хармони Гул — Off-White', 'Off-White'],
    ['Off-White™ c/o Monster High Raven Rhapsody Doll', 'Рэйвен Рапсоди — Off-White', 'Off-White'],
    ['Off-White™ c/o Monster High Symphanee Midnight Doll', 'Симфани Миднайт — Off-White', 'Off-White'],
  ])('provides Russian identity for %s', (officialName, nameRu, lineName) => {
    const html = `<script type="application/ld+json">{
      "@type":"Product","name":${JSON.stringify(officialName)},"sku":"TEST1",
      "offers":{"availability":"https://schema.org/InStock"}
    }</script>`;

    expect(parseCollectibleProduct(html, gozerUrl)).toMatchObject({ nameRu, lineName });
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
