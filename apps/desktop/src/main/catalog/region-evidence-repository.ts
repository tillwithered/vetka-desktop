import type { DatabaseSync } from 'node:sqlite';

import { amazonRegions } from '@/collector/amazon/regions';
import type { AmazonRegion } from '@/shared/contracts';

export type CatalogRegionEvidenceStatus =
  | 'verified' | 'out_of_stock' | 'no_price' | 'not_found' | 'needs_review'
  | 'captcha_required' | 'blocked' | 'parser_changed' | 'identity_mismatch'
  | 'network_error' | 'conflict';

export type CatalogRegionEvidence = {
  mattelSku: string;
  dollId: string;
  region: AmazonRegion;
  status: CatalogRegionEvidenceStatus;
  evidenceUrl: string;
  asin: string | null;
  checkedAt: string;
  diagnostic: Record<string, unknown>;
};

type Row = Record<string, unknown>;

function mapEvidence(row: Row): CatalogRegionEvidence {
  return {
    mattelSku: String(row.mattel_sku), dollId: String(row.doll_id), region: String(row.region) as AmazonRegion,
    status: String(row.status) as CatalogRegionEvidenceStatus, evidenceUrl: String(row.evidence_url),
    asin: row.asin === null ? null : String(row.asin), checkedAt: String(row.checked_at),
    diagnostic: JSON.parse(String(row.diagnostic_json)) as Record<string, unknown>,
  };
}

function validateEvidenceUrl(region: AmazonRegion, value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== amazonRegions[region].host) {
    throw new Error('Evidence URL does not match Amazon region');
  }
  return url.toString();
}

export class CatalogRegionEvidenceRepository {
  constructor(private readonly db: DatabaseSync) {}

  upsert(input: CatalogRegionEvidence): void {
    const evidenceUrl = validateEvidenceUrl(input.region, input.evidenceUrl);
    const asin = input.asin?.trim().toUpperCase() ?? null;
    this.db.prepare(`
      insert into catalog_region_evidence (
        mattel_sku, doll_id, region, status, evidence_url, asin, checked_at, diagnostic_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(mattel_sku, region) do update set
        doll_id = excluded.doll_id, status = excluded.status, evidence_url = excluded.evidence_url,
        asin = excluded.asin, checked_at = excluded.checked_at, diagnostic_json = excluded.diagnostic_json
    `).run(input.mattelSku.trim().toUpperCase(), input.dollId, input.region, input.status,
      evidenceUrl, asin, input.checkedAt, JSON.stringify(input.diagnostic));
  }

  listForDoll(dollId: string): CatalogRegionEvidence[] {
    return (this.db.prepare('select * from catalog_region_evidence where doll_id = ? order by region').all(dollId) as Row[]).map(mapEvidence);
  }

  listForActiveCatalog(): CatalogRegionEvidence[] {
    return (this.db.prepare(`
      select e.* from catalog_region_evidence e
      join catalog_entries c on c.mattel_sku = e.mattel_sku
      where c.monitor_status = 'active'
      order by e.mattel_sku, e.region
    `).all() as Row[]).map(mapEvidence);
  }
}
