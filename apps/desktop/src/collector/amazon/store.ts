import { load } from 'cheerio';

import type { AmazonRegion } from '@/shared/contracts';

import { parseLocalizedMoney } from './money';
import { parseAmazonProductPage } from './product-page';
import { amazonRegions, type AmazonCurrency } from './regions';

export type StoreLink = { region: AmazonRegion; asin: string; url: string };

export const officialMonsterHighStoreUrls: Record<AmazonRegion, string> = {
  amazon_us: 'https://www.amazon.com/stores/MonsterHigh/page/8153CA24-16BD-4D5B-B6FD-FAB40CBF9D55',
  amazon_uk: 'https://www.amazon.co.uk/stores/MonsterHigh/page/F08243CA-36AF-405B-B3CF-BF5EA9644BBE',
  amazon_de: 'https://www.amazon.de/stores/MonsterHigh/page/5E7E208A-1FAE-46F1-9E9B-1EC19E18108F',
  amazon_es: 'https://www.amazon.es/stores/MonsterHigh/page/497AFA99-E38B-4DBC-9BEC-0751E198AA35',
  amazon_it: 'https://www.amazon.it/stores/MonsterHigh/page/38828C3D-2177-488D-9D09-F758976215AF',
};

export type OfficialStoreDoll = StoreLink & {
  name: string;
  mattelSku: string;
  imageUrl: string | null;
  price: { minor: number; currency: AmazonCurrency };
  seller: string | null;
  fulfilledByAmazon: boolean;
  availability: 'in_stock' | 'preorder' | 'unknown';
};

const nonDollPattern = /\b(accessor(?:y|ies)|replacement|shoes?|boots?|clothes?|outfits?|stand|case|bag|wig|furniture|vehicle|earphones?|headphones?)\b/i;
const dollPattern = /\b(doll|puppe|muñeca|bambola)\b/i;
const monsterHighPattern = /monster\s+high|mattel/i;

function linkFromHref(region: AmazonRegion, href: string): StoreLink | null {
  const match = href.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?=\/|[?#]|$)/i);
  if (!match) return null;
  const asin = match[1].toUpperCase();
  return { region, asin, url: `https://${amazonRegions[region].host}/dp/${asin}` };
}

function normalizedText(value: string | undefined | null): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text || null;
}

function cardContainer($: ReturnType<typeof load>, element: ReturnType<ReturnType<typeof load>>) {
  const candidates = [element.get(0), ...element.parents().toArray()].filter(Boolean).slice(0, 8);
  for (const candidate of candidates) {
    const card = $(candidate);
    const productAsins = new Set(card.find('a[href*="/dp/"], a[href*="/gp/product/"]').toArray()
      .map((link) => $(link).attr('href')?.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?=\/|[?#]|$)/i)?.[1]?.toUpperCase())
      .filter((asin): asin is string => Boolean(asin)));
    const priceNodes = card.find('.a-offscreen, [data-testid*="price"], [data-a-price]').length;
    if (productAsins.size === 1 && priceNodes > 0) return card;
  }
  return null;
}

export function parseAmazonStoreCards(html: string, region: AmazonRegion): OfficialStoreDoll[] {
  const $ = load(html);
  const seen = new Set<string>();
  const products: OfficialStoreDoll[] = [];
  const currency = amazonRegions[region].currency;

  $('a[href*="/dp/"], a[href*="/gp/product/"]').each((_index, element) => {
    const link = $(element);
    const listing = linkFromHref(region, link.attr('href') ?? '');
    if (!listing || seen.has(listing.asin)) return;
    const card = cardContainer($, link);
    if (!card) return;

    const titleCandidates = [
      link.attr('aria-label'),
      card.find('h1, h2, h3, h4').first().text(),
      card.find('img[alt]').first().attr('alt'),
      link.text(),
    ];
    const name = titleCandidates.map(normalizedText).find((candidate) => candidate && monsterHighPattern.test(candidate)) ?? null;
    const price = card.find('.a-offscreen, [data-testid*="price"], [data-a-price]').toArray()
      .map((node) => parseLocalizedMoney($(node).text(), currency))
      .find((candidate) => candidate !== null) ?? null;
    const sku = name?.match(/\b[A-Z]{2,4}\d{2,4}\b/i)?.[0]?.toUpperCase() ?? null;
    if (!name || !sku || !price || !dollPattern.test(name) || nonDollPattern.test(name)) return;

    seen.add(listing.asin);
    products.push({
      ...listing,
      name,
      mattelSku: sku,
      imageUrl: card.find('img[src]').first().attr('src') ?? null,
      price,
      seller: null,
      fulfilledByAmazon: false,
      availability: 'unknown',
    });
  });
  return products;
}

export function parseAmazonStoreLinks(html: string, region: AmazonRegion): StoreLink[] {
  const $ = load(html);
  const seen = new Set<string>();
  const links: StoreLink[] = [];
  $('a[href*="/dp/"], a[href*="/gp/product/"]').each((_index, element) => {
    const listing = linkFromHref(region, $(element).attr('href') ?? '');
    if (!listing || seen.has(listing.asin)) return;
    seen.add(listing.asin);
    links.push(listing);
  });
  return links;
}

export function parseOfficialStoreDoll(html: string, region: AmazonRegion, url: string): OfficialStoreDoll | null {
  const asin = url.match(/\/dp\/([A-Z0-9]{10})(?=\/|$)/i)?.[1]?.toUpperCase();
  if (!asin) return null;
  const page = parseAmazonProductPage(html, { region, expectedAsin: asin });
  const title = page.title ?? '';
  const sku = page.modelNumber ?? title.match(/\b[A-Z]{2,4}\d{2,4}\b/i)?.[0]?.toUpperCase() ?? null;
  const price = page.regularPrice ?? page.primePrice ?? page.subscriptionPrice;
  if (page.status !== 'verified' || !sku || !price || !page.availability || page.availability === 'out_of_stock' || !monsterHighPattern.test(title) || !dollPattern.test(title) || nonDollPattern.test(title)) return null;
  return {
    region, asin, url, name: title, mattelSku: sku, imageUrl: page.imageUrl ?? null, price,
    seller: page.seller, fulfilledByAmazon: page.fulfilledByAmazon, availability: page.availability,
  };
}
