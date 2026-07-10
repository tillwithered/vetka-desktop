import { load } from 'cheerio';

import type { AmazonRegion } from '@/shared/contracts';

import { parseAmazonProductPage } from './product-page';
import { amazonRegions, type AmazonCurrency } from './regions';

export type StoreLink = { region: AmazonRegion; asin: string; url: string };

export type OfficialStoreDoll = StoreLink & {
  name: string;
  mattelSku: string;
  imageUrl: string | null;
  price: { minor: number; currency: AmazonCurrency };
  seller: string | null;
  fulfilledByAmazon: boolean;
  availability: 'in_stock' | 'preorder';
};

const nonDollPattern = /\b(accessor(?:y|ies)|replacement|shoes?|boots?|clothes?|outfits?|stand|case|bag|wig|furniture|vehicle|earphones?|headphones?)\b/i;
const dollPattern = /\b(doll|puppe|muñeca|bambola)\b/i;
const monsterHighPattern = /monster\s+high|mattel/i;

export function parseAmazonStoreLinks(html: string, region: AmazonRegion): StoreLink[] {
  const $ = load(html);
  const seen = new Set<string>();
  const links: StoreLink[] = [];
  $('a[href*="/dp/"]').each((_index, element) => {
    const href = $(element).attr('href') ?? '';
    const match = href.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?=\/|[?#]|$)/i);
    if (!match) return;
    const asin = match[1].toUpperCase();
    if (seen.has(asin)) return;
    seen.add(asin);
    links.push({ region, asin, url: `https://${amazonRegions[region].host}/dp/${asin}` });
  });
  return links;
}

export function parseOfficialStoreDoll(html: string, region: AmazonRegion, url: string): OfficialStoreDoll | null {
  const asin = url.match(/\/dp\/([A-Z0-9]{10})(?=\/|$)/i)?.[1]?.toUpperCase();
  if (!asin) return null;
  const page = parseAmazonProductPage(html, { region, expectedAsin: asin });
  const title = page.title ?? '';
  const sku = title.match(/\b[A-Z]{2,4}\d{2,4}\b/i)?.[0]?.toUpperCase() ?? null;
  const price = page.regularPrice ?? page.primePrice ?? page.subscriptionPrice;
  if (page.status !== 'verified' || !sku || !price || !page.availability || page.availability === 'out_of_stock' || !monsterHighPattern.test(title) || !dollPattern.test(title) || nonDollPattern.test(title)) return null;
  return {
    region, asin, url, name: title, mattelSku: sku, imageUrl: page.imageUrl ?? null, price,
    seller: page.seller, fulfilledByAmazon: page.fulfilledByAmazon, availability: page.availability,
  };
}
