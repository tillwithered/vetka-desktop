import type { AmazonRegion } from '@/shared/contracts';

export const amazonRegions = {
  amazon_us: { host: 'www.amazon.com', currency: 'USD', locale: 'en-US' },
  amazon_uk: { host: 'www.amazon.co.uk', currency: 'GBP', locale: 'en-GB' },
  amazon_de: { host: 'www.amazon.de', currency: 'EUR', locale: 'de-DE' },
  amazon_es: { host: 'www.amazon.es', currency: 'EUR', locale: 'es-ES' },
  amazon_it: { host: 'www.amazon.it', currency: 'EUR', locale: 'it-IT' },
} as const satisfies Record<AmazonRegion, { host: string; currency: 'USD' | 'GBP' | 'EUR'; locale: string }>;

// Amazon's global storefront can render the delivered total in KZT even on
// amazon.com. Keep the observed currency rather than silently dropping it.
export type AmazonCurrency = (typeof amazonRegions)[AmazonRegion]['currency'] | 'KZT';

export function amazonSearchEvidenceUrl(region: AmazonRegion, term: string): string {
  const url = new URL(`https://${amazonRegions[region].host}/s`);
  url.searchParams.set('k', term.trim());
  return url.toString();
}

export function regionForHost(hostname: string): AmazonRegion | null {
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  const entry = Object.entries(amazonRegions).find(([, config]) => config.host.replace(/^www\./, '') === normalized);
  return (entry?.[0] as AmazonRegion | undefined) ?? null;
}
