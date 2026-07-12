import { load } from 'cheerio';

import type { CollectibleLifecycle } from '@/shared/contracts';

export type ParsedCollectible = {
  mattelSku: string | null;
  canonicalUrl: string;
  officialName: string;
  nameRu: string;
  lineName: string | null;
  priceMinor: number | null;
  currency: string | null;
  lifecycle: CollectibleLifecycle;
  saleStartsAt: string | null;
  fangClubOnly: boolean;
  imageUrl: string | null;
};

export type AmbiguousCollectible = { ambiguous: true; canonicalUrl: string };

type ProductJson = {
  '@type'?: string;
  name?: string;
  sku?: string;
  image?: string | string[];
  offers?: { price?: string | number; priceCurrency?: string; availability?: string } | Array<{ price?: string | number; priceCurrency?: string; availability?: string }>;
};

const merchandise = /\b(?:t-?shirt|hoodie|sweatshirt|mug|tote|bag|backpack|beanie|hat|poster|glass|membership|game deck|bracelet|pin set|jersey|pants)\b/i;

function canonicalProductUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (url.hostname !== 'creations.mattel.com' || !url.pathname.startsWith('/products/')) return null;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function parseCollectibleCollection(html: string, baseUrl: string): string[] {
  const $ = load(html);
  const urls: string[] = [];
  const seen = new Set<string>();
  $('a[href*="/products/"]').each((_index, element) => {
    const label = $(element).text().replace(/\s+/g, ' ').trim();
    if (merchandise.test(label)) return;
    const url = canonicalProductUrl($(element).attr('href') ?? '', baseUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  });
  return urls;
}

function findProductJson(html: string): ProductJson | null {
  const $ = load(html);
  let product: ProductJson | null = null;
  $('script[type="application/ld+json"]').each((_index, element) => {
    if (product) return;
    try {
      const parsed = JSON.parse($(element).text()) as ProductJson | ProductJson[] | { '@graph': ProductJson[] };
      const candidates: ProductJson[] = Array.isArray(parsed)
        ? parsed
        : ('@graph' in parsed ? parsed['@graph'] : [parsed as ProductJson]);
      product = candidates.find((candidate) => candidate['@type'] === 'Product') ?? null;
    } catch {
      // Ignore unrelated or malformed analytics JSON-LD blocks.
    }
  });
  return product;
}

function russianIdentity(officialName: string): { nameRu: string; lineName: string | null } {
  const characters: Array<[RegExp, string]> = [
    [/Ghostbusters Gozer/i, 'Гозер'],
    [/Beetlejuice/i, 'Битлджус'],
    [/Abbey Bominable/i, 'Эбби Боминейбл'],
    [/Draculaura/i, 'Дракулаура'],
    [/Frankie Stein/i, 'Фрэнки Штейн'],
    [/Clawdeen Wolf/i, 'Клодин Вульф'],
    [/Cleo De Nile/i, 'Клео де Нил'],
    [/Lagoona Blue/i, 'Лагуна Блю'],
    [/Robecca Steam/i, 'Робекка Стим'],
    [/Spectra Vondergeist/i, 'Спектра Вондергейст'],
  ];
  const character = characters.find(([pattern]) => pattern.test(officialName))?.[1] ?? officialName;
  const collaboration = /Ghostbusters/i.test(officialName) ? 'Skullector x Ghostbusters'
    : /Beetlejuice/i.test(officialName) ? 'Skullector x Beetlejuice'
      : /Skullector/i.test(officialName) ? 'Skullector'
        : /Fang Vote/i.test(officialName) ? 'Fang Vote'
          : /Haunt Couture/i.test(officialName) ? 'Haunt Couture'
            : null;
  return { nameRu: collaboration ? `${character} — ${collaboration.split(' x ')[0]}` : character, lineName: collaboration };
}

function moneyMinor(price: string | number | undefined): number | null {
  if (price === undefined) return null;
  const amount = typeof price === 'number' ? price : Number.parseFloat(price.replace(/[^\d.]/g, ''));
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function parseCollectibleProduct(
  html: string,
  requestedUrl: string,
): ParsedCollectible | AmbiguousCollectible | null {
  const $ = load(html);
  const product = findProductJson(html);
  const officialName = product?.name?.replace(/\s+/g, ' ').trim() || $('h1').first().text().replace(/\s+/g, ' ').trim();
  if (!officialName || merchandise.test(officialName)) return null;
  if (!/\b(?:doll|dolls|2-pack|figure)\b/i.test(officialName)) return null;

  const canonicalUrl = canonicalProductUrl($('link[rel="canonical"]').attr('href') ?? requestedUrl, requestedUrl) ?? requestedUrl;
  const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  const availability = offer?.availability ?? '';
  const activeState = $('[data-active-product-state]').first().attr('data-active-product-state')?.toLowerCase() ?? '';
  const pageText = $('body').text().replace(/\s+/g, ' ').trim();
  const fangClubOnly = activeState.includes('fang') || (activeState.includes('coming') && /only Fang Club members/i.test(pageText));

  let lifecycle: CollectibleLifecycle | null = null;
  if (/InStock$/i.test(availability)) lifecycle = 'in_stock';
  else if (/OutOfStock$/i.test(availability)) lifecycle = 'sold_out';
  else if (activeState.includes('preorder')) lifecycle = 'preorder';
  else if (fangClubOnly) lifecycle = 'fang_club';
  else if (activeState.includes('coming')) lifecycle = 'coming_soon';
  else if (/\bPre-order\b/i.test(pageText) && !/\bSold Out\b/i.test(pageText)) lifecycle = 'preorder';
  else if (/\bSold Out\b/i.test(pageText) && !/\bComing Soon\b/i.test(pageText)) lifecycle = 'sold_out';
  if (!lifecycle) return { ambiguous: true, canonicalUrl };

  const skuText = pageText.match(/SKU#?:\s*([A-Z0-9_-]{4,40})/i)?.[1]?.toUpperCase() ?? null;
  const sku = product?.sku?.trim().toUpperCase() || skuText;
  const image = Array.isArray(product?.image) ? product.image[0] : product?.image;
  const identity = russianIdentity(officialName);

  return {
    mattelSku: sku,
    canonicalUrl,
    officialName,
    nameRu: identity.nameRu,
    lineName: identity.lineName,
    priceMinor: moneyMinor(offer?.price),
    currency: offer?.priceCurrency?.toUpperCase() ?? null,
    lifecycle,
    saleStartsAt: $('time[datetime]').first().attr('datetime') ?? null,
    fangClubOnly,
    imageUrl: image ?? null,
  };
}
