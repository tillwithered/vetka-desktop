import { describe, expect, it } from 'vitest';

import { parseLocalizedMoney } from '@/collector/amazon/money';

describe('parseLocalizedMoney', () => {
  it.each([
    ['$1,299.99', 'USD', 129999],
    ['£29.99', 'GBP', 2999],
    ['31,20 €', 'EUR', 3120],
    ['EUR 42,90', 'EUR', 4290],
    ['1\u00a0299,99 €', 'EUR', 129999],
    ['$29.99 ($2.50 / count)', 'USD', 2999],
  ] as const)('parses %s', (text, currency, minor) => {
    expect(parseLocalizedMoney(text, currency)).toEqual({ currency, minor });
  });

  it('rejects two different amounts', () => {
    expect(parseLocalizedMoney('$29.99 or $31.99', 'USD')).toBeNull();
  });
});
