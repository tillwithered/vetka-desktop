import { describe, expect, it, vi } from 'vitest';

import { NbkRateService } from '@/main/rates/service';

const xml = '<item><title>USD</title><description>464.71</description><quant>1</quant></item><item><title>EUR</title><description>531.26</description><quant>1</quant></item><item><title>GBP</title><description>624.15</description><quant>1</quant></item>';

describe('NbkRateService', () => {
  it('stores National Bank rates in automatic mode', async () => {
    const values = new Map<string, unknown>();
    const service = new NbkRateService({ get: <T>(key: string) => values.get(key) as T ?? null, set: <T>(key: string, value: T) => { values.set(key, value); return value; }, fetch: vi.fn(async () => new Response(xml)) });
    const rates = await service.refresh();
    expect(rates.USD).toMatchObject({ rateMicros: 464_710_000, source: 'nbk' });
    expect(values.get('exchangeRates')).toEqual(rates);
  });

  it('leaves manual rates untouched', async () => {
    const fetch = vi.fn();
    const service = new NbkRateService({ get: <T>(key: string) => (key === 'exchangeRatesMode' ? 'manual' : null) as T, set: <T>(_key: string, value: T) => value, fetch });
    await expect(service.refresh()).rejects.toThrow('manual mode');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the last saved rate when NBK is temporarily unavailable', async () => {
    const cached = { USD: { rateMicros: 500_000_000, updatedAt: '2026-07-01T00:00:00.000Z', source: 'nbk' }, EUR: { rateMicros: 550_000_000, updatedAt: '2026-07-01T00:00:00.000Z', source: 'nbk' }, GBP: { rateMicros: 650_000_000, updatedAt: '2026-07-01T00:00:00.000Z', source: 'nbk' } };
    const service = new NbkRateService({ get: <T>(key: string) => (key === 'exchangeRates' ? cached : 'auto') as T, set: <T>(_key: string, value: T) => value, fetch: vi.fn(async () => { throw new Error('offline'); }) });
    await expect(service.refresh()).resolves.toEqual(cached);
  });
});
