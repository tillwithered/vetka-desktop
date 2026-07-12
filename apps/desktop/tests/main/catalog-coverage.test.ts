import { describe, expect, it } from 'vitest';

import { evaluateCatalogCoverage, type CatalogCoverageCell } from '@/main/catalog/coverage';
import type { AmazonRegion } from '@/shared/contracts';

const regions: AmazonRegion[] = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'];
const hosts: Record<AmazonRegion, string> = {
  amazon_us: 'www.amazon.com', amazon_uk: 'www.amazon.co.uk', amazon_de: 'www.amazon.de',
  amazon_es: 'www.amazon.es', amazon_it: 'www.amazon.it',
};

function completeCells(): CatalogCoverageCell[] {
  return regions.map((region, index) => ({
    mattelSku: 'JMB81', dollId: 'robecca', region,
    status: index === 0 ? 'verified' : index === 4 ? 'no_price' : 'not_found',
    evidenceUrl: index === 0 || index === 4
      ? `https://${hosts[region]}/dp/B0FJZYDKX9`
      : `https://${hosts[region]}/s?k=JMB81`,
    asin: index === 0 || index === 4 ? 'B0FJZYDKX9' : null,
    checkedAt: '2026-07-12T10:00:00.000Z', diagnostic: {},
    hasCurrentPrice: index === 0,
  }));
}

describe('evaluateCatalogCoverage', () => {
  it('accepts five terminal, linked and current regional results', () => {
    const report = evaluateCatalogCoverage(
      [{ mattelSku: 'JMB81', dollId: 'robecca' }], completeCells(), new Date('2026-07-13T00:00:00.000Z'),
    );
    expect(report).toMatchObject({ complete: true, total: 5, terminal: 5, issues: [] });
  });

  it('rejects missing, retryable, overdue and unpriced verified cells', () => {
    const cells = completeCells().filter((cell) => cell.region !== 'amazon_de');
    cells.find((cell) => cell.region === 'amazon_uk')!.status = 'blocked';
    cells.find((cell) => cell.region === 'amazon_us')!.hasCurrentPrice = false;

    const report = evaluateCatalogCoverage(
      [{ mattelSku: 'JMB81', dollId: 'robecca' }], cells, new Date('2026-07-14T00:00:00.001Z'),
    );

    expect(report.complete).toBe(false);
    expect(report.issues.map((issue) => `${issue.region}:${issue.code}`)).toEqual(expect.arrayContaining([
      'amazon_us:verified_without_price', 'amazon_uk:retryable', 'amazon_de:missing', 'amazon_it:overdue',
    ]));
  });
});
