import type { AmazonCurrency } from './regions';

export type ParsedMoney = { minor: number; currency: AmazonCurrency };

function numericToMinor(raw: string): number | null {
  let normalized = raw.replace(/[\s\u00a0\u202f]/g, '');
  if (!normalized) return null;

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  const decimalSeparator = lastComma >= 0 && lastDot >= 0
    ? (lastComma > lastDot ? ',' : '.')
    : lastComma >= 0 && normalized.length - lastComma - 1 <= 2
      ? ','
      : lastDot >= 0 && normalized.length - lastDot - 1 <= 2
        ? '.'
        : null;
  if (decimalSeparator) {
    const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g;
    normalized = normalized.replace(thousandsSeparator, '').replace(decimalSeparator, '.');
  } else {
    normalized = normalized.replace(/[.,]/g, '');
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function parseLocalizedMoney(text: string, currency: AmazonCurrency): ParsedMoney | null {
  const withoutUnitPrices = text.replace(/\([^)]*\/[\s\w]+\)/gi, ' ');
  const marker = currency === 'USD'
    ? '(?:\\$|USD)'
    : currency === 'GBP'
      ? '(?:\\u00a3|GBP)'
      : currency === 'EUR'
        ? '(?:\\u20ac|EUR)'
        : 'KZT';
  const before = new RegExp(`${marker}\\s*([0-9][0-9.,\\s\\u00a0\\u202f]*)`, 'gi');
  const after = new RegExp(`([0-9][0-9.,\\s\\u00a0\\u202f]*)\\s*${marker}`, 'gi');
  const amountsFor = (expression: RegExp) => [...withoutUnitPrices.matchAll(expression)]
    .map((match) => numericToMinor(match[1].trim()))
    .filter((minor): minor is number => minor !== null);
  const beforeAmounts = [...new Set(amountsFor(before))];
  // Store-card text can concatenate a Mattel SKU and a price (for example,
  // `JHK59£24.99`). Prefer the amount following the currency marker so the
  // SKU suffix is not treated as a second price.
  if (beforeAmounts.length === 1) return { minor: beforeAmounts[0], currency };
  const afterAmounts = [...new Set(amountsFor(after))];
  return afterAmounts.length === 1 ? { minor: afterAmounts[0], currency } : null;
}

export function parseStructuredMoney(value: unknown, currency: AmazonCurrency): ParsedMoney | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const minor = numericToMinor(String(value));
  return minor === null ? null : { minor, currency };
}
