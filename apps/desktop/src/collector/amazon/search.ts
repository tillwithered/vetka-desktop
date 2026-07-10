import { load } from 'cheerio';

import type { AmazonRegion } from '@/shared/contracts';

import { parseLocalizedMoney, type ParsedMoney } from './money';
import { amazonRegions } from './regions';

export type AmazonCandidate = {
  asin: string;
  region: AmazonRegion;
  title: string;
  canonicalUrl: string;
  visiblePrice: ParsedMoney | null;
  imageUrl: string | null;
  status: 'candidate';
};

export function parseAmazonSearchResults(html: string, region: AmazonRegion): AmazonCandidate[] {
  const $ = load(html);
  const config = amazonRegions[region];
  const candidates: AmazonCandidate[] = [];
  const cards = $('div[data-component-type="s-search-result"][data-asin]').length > 0
    ? $('div[data-component-type="s-search-result"][data-asin]')
    : $('div[data-asin]');

  cards.each((_index, element) => {
    const node = $(element);
    const asin = String(node.attr('data-asin') ?? '').toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) return;
    const title = node.find('h2').first().attr('aria-label')?.trim()
      || node.find('h2 span').last().text().replace(/\s+/g, ' ').trim();
    const link = node.find(`a[href*="/dp/${asin}"]`).first();
    if (!title || link.length === 0) return;
    const priceText = node.find('.a-price .a-offscreen').first().text().trim();
    candidates.push({
      asin,
      region,
      title,
      canonicalUrl: `https://${config.host}/dp/${asin}`,
      visiblePrice: priceText
        ? parseLocalizedMoney(priceText, /\bKZT\b/i.test(priceText) ? 'KZT' : config.currency)
        : null,
      imageUrl: node.find('img.s-image').first().attr('src') ?? null,
      status: 'candidate',
    });
  });

  return candidates;
}
