import { describe, expect, it } from 'vitest';

import { freshnessAt } from '@/domain/freshness';

describe('freshnessAt', () => {
  const checked = '2026-07-10T10:00:00.000Z';
  it.each([
    ['2026-07-10T11:00:00.000Z', 'fresh'],
    ['2026-07-10T11:00:00.001Z', 'aging'],
    ['2026-07-11T10:00:00.000Z', 'aging'],
    ['2026-07-11T10:00:00.001Z', 'stale'],
  ])('labels %s as %s', (now, expected) => {
    expect(freshnessAt(checked, now)).toBe(expected);
  });
});
