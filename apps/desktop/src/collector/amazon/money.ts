import type { AmazonCurrency } from './regions';

export type ParsedMoney = { minor: number; currency: AmazonCurrency };

function numericToMinor(raw: string, currency: AmazonCurrency): number | null {
  let normalized = raw.replace(/[\s\u00a0\u202f]/g, '');
  if (!normalized) return null;

  if (currency === 'EUR') {
    if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
    else if ((normalized.match(/\./g) ?? []).length > 1) normalized = normalized.replace(/\./g, '');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function parseLocalizedMoney(text: string, currency: AmazonCurrency): ParsedMoney | null {
  const withoutUnitPrices = text.replace(/\([^)]*\/[\s\w]+\)/gi, ' ');
  const marker = currency === 'USD' ? '(?:\\$|USD)' : currency === 'GBP' ? '(?:£|GBP)' : '(?:€|EUR)';
  const before = new RegExp(`${marker}\\s*([0-9][0-9.,\\s\\u00a0\\u202f]*)`, 'gi');
  const after = new RegExp(`([0-9][0-9.,\\s\\u00a0\\u202f]*)\\s*${marker}`, 'gi');
  const amounts: number[] = [];

  for (const expression of [before, after]) {
    for (const match of withoutUnitPrices.matchAll(expression)) {
      const minor = numericToMinor(match[1].trim(), currency);
      if (minor !== null) amounts.push(minor);
    }
  }

  const unique = [...new Set(amounts)];
  return unique.length === 1 ? { minor: unique[0], currency } : null;
}

export function parseStructuredMoney(value: unknown, currency: AmazonCurrency): ParsedMoney | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const minor = numericToMinor(String(value), currency);
  return minor === null ? null : { minor, currency };
}
