import type { AmazonRegion } from '@/shared/contracts';

export const amazonRegions = {
  amazon_us: { host: 'www.amazon.com', currency: 'USD', locale: 'en-US' },
  amazon_uk: { host: 'www.amazon.co.uk', currency: 'GBP', locale: 'en-GB' },
  amazon_de: { host: 'www.amazon.de', currency: 'EUR', locale: 'de-DE' },
  amazon_es: { host: 'www.amazon.es', currency: 'EUR', locale: 'es-ES' },
  amazon_it: { host: 'www.amazon.it', currency: 'EUR', locale: 'it-IT' },
} as const satisfies Record<AmazonRegion, { host: string; currency: 'USD' | 'GBP' | 'EUR'; locale: string }>;

export type AmazonCurrency = (typeof amazonRegions)[AmazonRegion]['currency'];

export function regionForHost(hostname: string): AmazonRegion | null {
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  const entry = Object.entries(amazonRegions).find(([, config]) => config.host.replace(/^www\./, '') === normalized);
  return (entry?.[0] as AmazonRegion | undefined) ?? null;
}
