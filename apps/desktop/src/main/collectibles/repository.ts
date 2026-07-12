import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type { Collectible, CollectibleLifecycle, CollectiblesScanState } from '@/shared/contracts';

type Row = Record<string, unknown>;

export type CollectibleUpsert = {
  mattelSku: string | null;
  canonicalUrl: string;
  nameRu: string;
  officialName: string;
  lineName: string | null;
  priceMinor: number | null;
  currency: string | null;
  lifecycle: CollectibleLifecycle;
  saleStartsAt: string | null;
  fangClubOnly: boolean;
  imageUrl: string | null;
  checkedAt: string;
};

function mapCollectible(row: Row): Collectible {
  return {
    id: String(row.id),
    mattelSku: row.mattel_sku === null ? null : String(row.mattel_sku),
    canonicalUrl: String(row.canonical_url),
    nameRu: String(row.name_ru),
    officialName: String(row.official_name),
    lineName: row.line_name === null ? null : String(row.line_name),
    priceMinor: row.price_minor === null ? null : Number(row.price_minor),
    currency: row.currency === null ? null : String(row.currency),
    lifecycle: String(row.lifecycle) as CollectibleLifecycle,
    saleStartsAt: row.sale_starts_at === null ? null : String(row.sale_starts_at),
    fangClubOnly: Number(row.fang_club_only) === 1,
    imageUrl: row.image_url === null ? null : String(row.image_url),
    lastCheckResult: String(row.last_check_result) as Collectible['lastCheckResult'],
    lastCheckedAt: String(row.last_checked_at),
    archivedAt: row.archived_at === null ? null : String(row.archived_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapScanState(row: Row): CollectiblesScanState {
  return {
    status: String(row.status) as CollectiblesScanState['status'],
    startedAt: row.started_at === null ? null : String(row.started_at),
    completedAt: row.completed_at === null ? null : String(row.completed_at),
    nextRunAt: row.next_run_at === null ? null : String(row.next_run_at),
    processed: Number(row.processed),
    total: Number(row.total),
    lastError: row.last_error === null ? null : String(row.last_error),
  };
}

export class CollectiblesRepository {
  constructor(private readonly db: DatabaseSync) {}

  upsert(input: CollectibleUpsert): Collectible {
    const existing = (input.mattelSku
      ? this.db.prepare('select id from collectibles where mattel_sku = ? or canonical_url = ? limit 1').get(input.mattelSku, input.canonicalUrl)
      : this.db.prepare('select id from collectibles where canonical_url = ? limit 1').get(input.canonicalUrl)) as { id: string } | undefined;
    const id = existing?.id ?? randomUUID();
    const now = input.checkedAt;
    if (existing) {
      this.db.prepare(`
        update collectibles set mattel_sku = ?, canonical_url = ?, name_ru = ?, official_name = ?, line_name = ?,
          price_minor = ?, currency = ?, lifecycle = ?, sale_starts_at = ?, fang_club_only = ?, image_url = ?,
          last_check_result = 'verified', last_checked_at = ?, missing_complete_scans = 0, archived_at = null, updated_at = ?
        where id = ?
      `).run(input.mattelSku, input.canonicalUrl, input.nameRu, input.officialName, input.lineName,
        input.priceMinor, input.currency, input.lifecycle, input.saleStartsAt, input.fangClubOnly ? 1 : 0,
        input.imageUrl, input.checkedAt, now, id);
    } else {
      this.db.prepare(`
        insert into collectibles (
          id, mattel_sku, canonical_url, name_ru, official_name, line_name, price_minor, currency,
          lifecycle, sale_starts_at, fang_club_only, image_url, last_check_result, last_checked_at,
          missing_complete_scans, archived_at, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, 0, null, ?, ?)
      `).run(id, input.mattelSku, input.canonicalUrl, input.nameRu, input.officialName, input.lineName,
        input.priceMinor, input.currency, input.lifecycle, input.saleStartsAt, input.fangClubOnly ? 1 : 0,
        input.imageUrl, input.checkedAt, now, now);
    }
    return mapCollectible(this.db.prepare('select * from collectibles where id = ?').get(id) as Row);
  }

  list(filter: { archived?: boolean; query?: string } = {}): Collectible[] {
    const conditions = [filter.archived ? 'archived_at is not null' : 'archived_at is null'];
    const rows = (this.db.prepare(`select * from collectibles where ${conditions.join(' and ')} order by updated_at desc, name_ru`).all() as Row[]).map(mapCollectible);
    const query = filter.query?.trim().toLocaleLowerCase('ru');
    if (!query) return rows;
    return rows.filter((item) => [item.nameRu, item.officialName, item.lineName, item.mattelSku]
      .some((value) => value?.toLocaleLowerCase('ru').includes(query)));
  }

  recordFailure(canonicalUrl: string, checkedAt: string): void {
    this.db.prepare("update collectibles set last_check_result = 'error', last_checked_at = ?, updated_at = ? where canonical_url = ?")
      .run(checkedAt, checkedAt, canonicalUrl);
  }

  finishCompleteScan(presentUrls: readonly string[]): void {
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (presentUrls.length > 0) {
        const placeholders = presentUrls.map(() => '?').join(', ');
        this.db.prepare(`update collectibles set missing_complete_scans = 0, archived_at = null where canonical_url in (${placeholders})`).run(...presentUrls);
        this.db.prepare(`
          update collectibles set missing_complete_scans = missing_complete_scans + 1,
            archived_at = case when missing_complete_scans + 1 >= 2 then coalesce(archived_at, ?) else archived_at end,
            updated_at = ? where canonical_url not in (${placeholders})
        `).run(now, now, ...presentUrls);
      } else {
        this.db.prepare(`
          update collectibles set missing_complete_scans = missing_complete_scans + 1,
            archived_at = case when missing_complete_scans + 1 >= 2 then coalesce(archived_at, ?) else archived_at end,
            updated_at = ?
        `).run(now, now);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getScanState(): CollectiblesScanState {
    return mapScanState(this.db.prepare('select * from collectibles_scan_state where singleton = 1').get() as Row);
  }

  setScanState(state: CollectiblesScanState): void {
    this.db.prepare(`
      update collectibles_scan_state set status = ?, started_at = ?, completed_at = ?, next_run_at = ?,
        processed = ?, total = ?, last_error = ? where singleton = 1
    `).run(state.status, state.startedAt, state.completedAt, state.nextRunAt, state.processed, state.total, state.lastError);
  }
}
