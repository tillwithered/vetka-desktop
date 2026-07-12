import { amazonRegions } from '@/collector/amazon/regions';
import { isPriceCheckOverdue } from '@/domain/freshness';
import type { AmazonRegion } from '@/shared/contracts';

import type { CatalogRegionEvidence } from './region-evidence-repository';
import { catalogAmazonRegions } from './region-state-service';

export type CatalogCoverageCell = CatalogRegionEvidence & { hasCurrentPrice: boolean };
export type CatalogCoverageIssueCode =
  | 'missing' | 'retryable' | 'overdue' | 'invalid_url' | 'asin_url_mismatch'
  | 'verified_without_price' | 'invalid_absence_evidence';
export type CatalogCoverageIssue = {
  mattelSku: string;
  region: AmazonRegion;
  code: CatalogCoverageIssueCode;
  status: string | null;
  evidenceUrl: string | null;
};
export type CatalogCoverageReport = {
  complete: boolean;
  total: number;
  terminal: number;
  issues: CatalogCoverageIssue[];
};

const terminalStatuses = new Set(['verified', 'no_price', 'out_of_stock', 'not_found']);

function issue(cell: CatalogCoverageCell | null, mattelSku: string, region: AmazonRegion, code: CatalogCoverageIssueCode): CatalogCoverageIssue {
  return { mattelSku, region, code, status: cell?.status ?? null, evidenceUrl: cell?.evidenceUrl ?? null };
}

export function evaluateCatalogCoverage(
  entries: ReadonlyArray<{ mattelSku: string; dollId: string }>,
  cells: readonly CatalogCoverageCell[],
  now: Date = new Date(),
): CatalogCoverageReport {
  const byIdentity = new Map(cells.map((cell) => [`${cell.mattelSku}:${cell.region}`, cell]));
  const issues: CatalogCoverageIssue[] = [];
  let terminal = 0;

  for (const entry of entries) for (const region of catalogAmazonRegions) {
    const cell = byIdentity.get(`${entry.mattelSku}:${region}`) ?? null;
    if (!cell) {
      issues.push(issue(null, entry.mattelSku, region, 'missing'));
      continue;
    }
    if (!terminalStatuses.has(cell.status)) issues.push(issue(cell, entry.mattelSku, region, 'retryable'));
    else terminal += 1;
    if (isPriceCheckOverdue(cell.checkedAt, now)) issues.push(issue(cell, entry.mattelSku, region, 'overdue'));

    let url: URL | null = null;
    try { url = new URL(cell.evidenceUrl); } catch { /* validated below */ }
    if (!url || url.protocol !== 'https:' || url.hostname !== amazonRegions[region].host) {
      issues.push(issue(cell, entry.mattelSku, region, 'invalid_url'));
      continue;
    }
    if (cell.asin && !url.pathname.toUpperCase().includes(cell.asin.toUpperCase())) {
      issues.push(issue(cell, entry.mattelSku, region, 'asin_url_mismatch'));
    }
    if (cell.status === 'verified' && !cell.hasCurrentPrice) issues.push(issue(cell, entry.mattelSku, region, 'verified_without_price'));
    if (cell.status === 'not_found' && (cell.asin || !url.pathname.startsWith('/s'))) {
      issues.push(issue(cell, entry.mattelSku, region, 'invalid_absence_evidence'));
    }
    if ((cell.status === 'no_price' || cell.status === 'out_of_stock') && (!cell.asin || !url.pathname.toUpperCase().includes(cell.asin.toUpperCase()))) {
      issues.push(issue(cell, entry.mattelSku, region, 'invalid_absence_evidence'));
    }
  }

  return { complete: issues.length === 0, total: entries.length * catalogAmazonRegions.length, terminal, issues };
}
