import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

import type { DollRepository } from '@/main/dolls/repository';

const catalogSeedSchema = z.object({
  mattelSku: z.string().trim().regex(/^[A-Z0-9]{4,40}$/),
  name: z.string().trim().min(1).max(160),
  characterName: z.string().trim().max(100).nullable().default(null),
  lineName: z.string().trim().max(100).nullable().default(null),
  productType: z.string().trim().min(1).max(40),
  monitorStatus: z.enum(['active', 'monitor_only']),
  requiredTerms: z.array(z.string().trim().min(1).max(100)).min(1),
  rejectTerms: z.array(z.string().trim().min(1).max(100)),
  searchQuery: z.string().trim().min(1).max(240),
  sourceUrl: z.string().url().max(2048).nullable().default(null),
  sourceCheckedAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  evidence: z.string().trim().min(1).max(500),
});

export type CatalogSeedEntry = {
  mattelSku: string;
  name: string;
  characterName?: string | null;
  lineName?: string | null;
  productType: string;
  monitorStatus: 'active' | 'monitor_only';
  requiredTerms: readonly string[];
  rejectTerms: readonly string[];
  searchQuery: string;
  sourceUrl?: string | null;
  sourceCheckedAt: string;
  evidence: string;
};
export type CatalogEntry = z.output<typeof catalogSeedSchema> & { dollId: string | null };
export type CatalogImportResult = { inserted: number; updated: number; skipped: number };

export class CatalogRepository {
  constructor(private readonly db: DatabaseSync, private readonly dolls: DollRepository) {}

  importSeed(entries: readonly CatalogSeedEntry[]): CatalogImportResult {
    const parsed = entries.map((entry) => {
      const result = catalogSeedSchema.safeParse({ ...entry, requiredTerms: [...entry.requiredTerms], rejectTerms: [...entry.rejectTerms], mattelSku: entry.mattelSku.trim().toUpperCase() });
      if (!result.success) throw new Error('Invalid catalog entry');
      return result.data;
    });
    const duplicate = new Set<string>();
    for (const entry of parsed) {
      if (duplicate.has(entry.mattelSku)) throw new Error('Invalid catalog entry');
      duplicate.add(entry.mattelSku);
    }

    let inserted = 0;
    let updated = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const entry of parsed) {
        const existing = this.db.prepare('select doll_id from catalog_entries where mattel_sku = ?').get(entry.mattelSku) as { doll_id: string | null } | undefined;
        const doll = this.dolls.findByMattelSku(entry.mattelSku) ?? this.dolls.create({
          name: entry.name,
          characterName: entry.characterName,
          lineName: entry.lineName,
          mattelSku: entry.mattelSku,
        });
        const now = new Date().toISOString();
        this.db.prepare(`
          insert into catalog_entries (
            mattel_sku, name, character_name, line_name, product_type, monitor_status,
            required_terms_json, reject_terms_json, search_query, source_url, source_checked_at,
            evidence, doll_id, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(mattel_sku) do update set
            name = excluded.name, character_name = excluded.character_name, line_name = excluded.line_name,
            product_type = excluded.product_type, monitor_status = excluded.monitor_status,
            required_terms_json = excluded.required_terms_json, reject_terms_json = excluded.reject_terms_json,
            search_query = excluded.search_query, source_url = excluded.source_url,
            source_checked_at = excluded.source_checked_at, evidence = excluded.evidence,
            doll_id = excluded.doll_id, updated_at = excluded.updated_at
        `).run(entry.mattelSku, entry.name, entry.characterName, entry.lineName, entry.productType,
          entry.monitorStatus, JSON.stringify(entry.requiredTerms), JSON.stringify(entry.rejectTerms),
          entry.searchQuery, entry.sourceUrl, entry.sourceCheckedAt, entry.evidence, doll.id, now, now);
        if (existing) updated += 1;
        else inserted += 1;
      }
      this.db.exec('COMMIT');
      return { inserted, updated, skipped: 0 };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  listActive(): CatalogEntry[] {
    return this.listByStatus('active');
  }

  listAll(): CatalogEntry[] {
    return this.mapRows(this.db.prepare('select * from catalog_entries order by name').all() as Record<string, unknown>[]);
  }

  private listByStatus(status: 'active' | 'monitor_only'): CatalogEntry[] {
    return this.mapRows(this.db.prepare('select * from catalog_entries where monitor_status = ? order by name').all(status) as Record<string, unknown>[]);
  }

  private mapRows(rows: Record<string, unknown>[]): CatalogEntry[] {
    return rows.map((row) => ({
      mattelSku: String(row.mattel_sku), name: String(row.name),
      characterName: row.character_name === null ? null : String(row.character_name),
      lineName: row.line_name === null ? null : String(row.line_name),
      productType: String(row.product_type), monitorStatus: row.monitor_status as 'active' | 'monitor_only',
      requiredTerms: JSON.parse(String(row.required_terms_json)) as string[],
      rejectTerms: JSON.parse(String(row.reject_terms_json)) as string[],
      searchQuery: String(row.search_query), sourceUrl: row.source_url === null ? null : String(row.source_url),
      sourceCheckedAt: String(row.source_checked_at), evidence: String(row.evidence),
      dollId: row.doll_id === null ? null : String(row.doll_id),
    }));
  }
}
