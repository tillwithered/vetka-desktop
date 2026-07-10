import { amazonRegions, regionForHost } from './regions';

export function normalizeAmazonUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Invalid Amazon URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid Amazon protocol');
  const region = regionForHost(url.hostname);
  if (!region) throw new Error('Unsupported Amazon host');
  const match = url.pathname.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?=\/|$)/i);
  if (!match) throw new Error('Amazon URL does not contain a valid ASIN');
  const asin = match[1].toUpperCase();
  return {
    region,
    asin,
    canonicalUrl: `https://${amazonRegions[region].host}/dp/${asin}`,
  };
}
