import { describe, expect, it } from 'vitest';
import { parseNbkRates } from '@/main/rates/nbk';

describe('parseNbkRates', () => {
  it('normalizes National Bank values by nominal', () => {
    const xml = '<item><title>USD</title><pubDate>11.07.2026</pubDate><description>464.71</description><quant>1</quant></item><item><title>GBP</title><pubDate>11.07.2026</pubDate><description>624.15</description><quant>1</quant></item><item><title>EUR</title><pubDate>11.07.2026</pubDate><description>531.26</description><quant>1</quant></item>';
    expect(parseNbkRates(xml)).toEqual(expect.objectContaining({ USD: 464_710_000, EUR: 531_260_000, GBP: 624_150_000 }));
  });
});
