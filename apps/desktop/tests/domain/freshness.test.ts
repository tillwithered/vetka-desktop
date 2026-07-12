import { describe, expect, it } from 'vitest';

import { isPriceCheckOverdue } from '@/domain/freshness';

describe('isPriceCheckOverdue', () => {
  const checked = '2026-07-10T10:00:00.000Z';
  it.each([
    ['2026-07-11T22:00:00.000Z', false],
    ['2026-07-11T22:00:00.001Z', true],
  ])('returns %s at the 36-hour boundary', (now, expected) => {
    expect(isPriceCheckOverdue(checked, now)).toBe(expected);
  });
});
