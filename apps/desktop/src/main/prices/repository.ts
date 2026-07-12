import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type { AmazonRegion } from '@/shared/contracts';
import { amazonRegions, type AmazonCurrency } from '@/collector/amazon/regions';

export type ListingStatus = 'candidate' | 'confirmed' | 'rejected' | 'frozen';
export type CheckStatus = 'verified' | 'out_of_stock' | 'no_price' | 'needs_review' | 'captcha_required' | 'blocked' | 'parser_changed' | 'identity_mismatch' | 'network_error' | 'conflict';

export type AmazonListing = {
  id: string;
  dollId: string;
  region: AmazonRegion;
  asin: string;
  url: string;
  status: ListingStatus;
  confirmationSource: 'exact_id' | 'deterministic_match' | 'manual' | null;
};

type OfferInput = {
  offerKind: 'regular' | 'prime' | 'subscription';
  priceMinor: number;
  currency: AmazonCurrency;
  shippingMinor: number | null;
  sellerName: string | null;
  fulfilledByAmazon: boolean;
  availability: 'in_stock' | 'preorder' | 'unknown';
  condition: 'New';
  couponText: string | null;
  rateToKztMicros: number;
};

type Row = Record<string, unknown>;

const mapListing = (row: Row): AmazonListing => ({
  id: String(row.id), dollId: String(row.doll_id), region: String(row.region) as AmazonRegion,
  asin: String(row.asin), url: String(row.url), status: String(row.status) as ListingStatus,
  confirmationSource: row.confirmation_source === null ? null : String(row.confirmation_source) as AmazonListing['confirmationSource'],
});

export class PriceRepository {
  constructor(private readonly db: DatabaseSync) {}

  ensureListing(input: { dollId: string; region: AmazonRegion; asin: string; url: string; status?: ListingStatus; confirmationSource?: AmazonListing['confirmationSource']; matchScore?: number; matchReasons?: string[] }): AmazonListing {
    const existing = this.getByIdentity(input.dollId, input.region, input.asin);
    if (existing) return existing;
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      insert into amazon_listings (
        id, doll_id, region, asin, url, status, confirmation_source, match_score,
        match_reasons_json, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.dollId, input.region, input.asin.toUpperCase(), input.url,
      input.status ?? 'candidate', input.confirmationSource ?? null, input.matchScore ?? 0,
      JSON.stringify(input.matchReasons ?? []), now, now);
    return this.getListing(id)!;
  }

  upsertTrustedListing(input: { dollId: string; region: AmazonRegion; asin: string; url: string }): AmazonListing {
    const listing = this.ensureListing({
      ...input,
      status: 'confirmed',
      confirmationSource: 'exact_id',
      matchScore: 100,
      matchReasons: ['live_verified_sku_asin'],
    });
    this.db.prepare(`
      update amazon_listings
      set url = ?, status = 'confirmed', confirmation_source = 'exact_id',
          match_score = 100, match_reasons_json = ?, updated_at = ?
      where id = ?
    `).run(input.url, JSON.stringify(['live_verified_sku_asin']), new Date().toISOString(), listing.id);
    return this.getListing(listing.id)!;
  }

  getListing(id: string): AmazonListing | null {
    const row = this.db.prepare('select * from amazon_listings where id = ?').get(id) as Row | undefined;
    return row ? mapListing(row) : null;
  }

  getByIdentity(dollId: string, region: AmazonRegion, asin: string): AmazonListing | null {
    const row = this.db.prepare('select * from amazon_listings where doll_id = ? and region = ? and asin = ?').get(dollId, region, asin.toUpperCase()) as Row | undefined;
    return row ? mapListing(row) : null;
  }

  listListings(dollId: string): AmazonListing[] {
    return (this.db.prepare('select * from amazon_listings where doll_id = ? order by region, created_at').all(dollId) as Row[]).map(mapListing);
  }

  listDollIdsWithConfirmedListings(): string[] {
    return (this.db.prepare(`
      select distinct doll_id
      from amazon_listings
      where status = 'confirmed'
      order by doll_id
    `).all() as Array<{ doll_id: string }>).map((row) => row.doll_id);
  }

  reviewCandidate(listingId: string, decision: 'confirm' | 'reject'): AmazonListing {
    this.db.prepare('update amazon_listings set status = ?, confirmation_source = ?, updated_at = ? where id = ?')
      .run(decision === 'confirm' ? 'confirmed' : 'rejected', decision === 'confirm' ? 'manual' : null, new Date().toISOString(), listingId);
    const listing = this.getListing(listingId);
    if (!listing) throw new Error('Listing not found');
    return listing;
  }

  confirmDeterministicMatch(listingId: string): AmazonListing {
    this.db.prepare('update amazon_listings set status = ?, confirmation_source = ?, updated_at = ? where id = ?')
      .run('confirmed', 'deterministic_match', new Date().toISOString(), listingId);
    const listing = this.getListing(listingId);
    if (!listing) throw new Error('Listing not found');
    return listing;
  }

  activateOfficialStoreListing(dollId: string, region: AmazonRegion, asin: string): AmazonListing {
    const listing = this.getByIdentity(dollId, region, asin);
    if (!listing) throw new Error('Official Store listing is missing');
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare("update amazon_listings set status = 'frozen', updated_at = ? where doll_id = ? and region = ? and id <> ? and status = 'confirmed'")
        .run(now, dollId, region, listing.id);
      this.db.prepare("update amazon_listings set status = 'confirmed', confirmation_source = 'deterministic_match', updated_at = ? where id = ?")
        .run(now, listing.id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.getListing(listing.id)!;
  }

  promoteVerifiedCandidates(): number {
    const result = this.db.prepare(`
      update amazon_listings
      set status = 'confirmed', confirmation_source = 'deterministic_match', updated_at = ?
      where status = 'candidate' and last_check_status = 'verified'
    `).run(new Date().toISOString());
    return Number(result.changes);
  }

  applyCheck(input: { listingId: string; status: CheckStatus; checkedAt: string; offer: OfferInput | null; diagnostic?: Record<string, unknown> }): void {
    const listing = this.getListing(input.listingId);
    if (!listing) throw new Error('Listing not found');
    const checkId = randomUUID();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`insert into price_checks (
        id, listing_id, status, adapter_version, started_at, finished_at, diagnostic_json
      ) values (?, ?, ?, ?, ?, ?, ?)`)
        .run(checkId, input.listingId, input.status, 'amazon-v0.1', input.checkedAt, input.checkedAt, JSON.stringify(input.diagnostic ?? {}));
      this.db.prepare('update amazon_listings set last_checked_at = ?, last_check_status = ?, updated_at = ? where id = ?')
        .run(input.checkedAt, input.status, input.checkedAt, input.listingId);

      if (input.status === 'verified' && input.offer) {
        const offer = input.offer;
        if (offer.currency !== amazonRegions[listing.region].currency) throw new Error('Currency does not match Amazon region');
        if (!Number.isSafeInteger(offer.priceMinor) || offer.priceMinor < 0 || !Number.isSafeInteger(offer.rateToKztMicros) || offer.rateToKztMicros <= 0) throw new Error('Invalid verified offer');
        const priceKztMinor = Math.round((offer.priceMinor * offer.rateToKztMicros) / 1_000_000);
        this.db.prepare(`insert into price_snapshots (
          id, check_id, listing_id, offer_kind, price_minor, currency, shipping_minor,
          seller_name, fulfilled_by_amazon, availability, condition, coupon_text,
          rate_to_kzt_micros, price_kzt_minor, checked_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(randomUUID(), checkId, input.listingId, offer.offerKind, offer.priceMinor, offer.currency,
            offer.shippingMinor, offer.sellerName, offer.fulfilledByAmazon ? 1 : 0, offer.availability,
            offer.condition, offer.couponText, offer.rateToKztMicros, priceKztMinor, input.checkedAt);
        this.db.prepare('update amazon_listings set last_verified_at = ? where id = ?').run(input.checkedAt, input.listingId);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  current(dollId: string) {
    return (this.db.prepare(`
      with latest_checks as (
        select c.*,
          row_number() over (partition by c.listing_id order by c.finished_at desc, c.rowid desc) as check_rank
        from price_checks c
      ), current_listing_snapshots as (
        select l.id as listing_id, l.region, l.asin, l.url,
          s.id as snapshot_id, s.offer_kind, s.price_minor, s.currency, s.shipping_minor,
          s.seller_name, s.fulfilled_by_amazon, s.availability, s.condition, s.coupon_text,
          s.rate_to_kzt_micros, s.price_kzt_minor, s.checked_at,
          c.status as latest_check_status,
          row_number() over (partition by l.region order by s.checked_at desc, s.rowid desc) as region_rank
        from latest_checks c
        join amazon_listings l on l.id = c.listing_id
        join price_snapshots s on s.check_id = c.id
        where l.doll_id = ? and l.status = 'confirmed'
          and c.check_rank = 1 and c.status = 'verified'
      )
      select * from current_listing_snapshots where region_rank = 1 order by region
    `).all(dollId) as Row[]).map((row) => ({
      listingId: String(row.listing_id), region: String(row.region) as AmazonRegion, asin: String(row.asin), url: String(row.url),
      snapshotId: String(row.snapshot_id), offerKind: String(row.offer_kind), priceMinor: Number(row.price_minor), currency: String(row.currency) as AmazonCurrency,
      shippingMinor: row.shipping_minor === null ? null : Number(row.shipping_minor), sellerName: row.seller_name === null ? null : String(row.seller_name),
      fulfilledByAmazon: Number(row.fulfilled_by_amazon) === 1, availability: String(row.availability), condition: 'New' as const,
      couponText: row.coupon_text === null ? null : String(row.coupon_text), rateToKztMicros: Number(row.rate_to_kzt_micros),
      priceKztMinor: Number(row.price_kzt_minor), checkedAt: String(row.checked_at), latestCheckStatus: String(row.latest_check_status),
    })).filter((price) => price.currency === amazonRegions[price.region].currency);
  }

  currentForDolls(dollIds: readonly string[]) {
    const result = Object.fromEntries(dollIds.map((dollId) => [dollId, [] as ReturnType<PriceRepository['current']>]));
    if (dollIds.length === 0) return result;
    const placeholders = dollIds.map(() => '?').join(', ');
    const rows = this.db.prepare(`
      with latest_checks as (
        select c.*,
          row_number() over (partition by c.listing_id order by c.finished_at desc, c.rowid desc) as check_rank
        from price_checks c
      ), current_listing_snapshots as (
        select l.doll_id, l.id as listing_id, l.region, l.asin, l.url,
          s.id as snapshot_id, s.offer_kind, s.price_minor, s.currency, s.shipping_minor,
          s.seller_name, s.fulfilled_by_amazon, s.availability, s.condition, s.coupon_text,
          s.rate_to_kzt_micros, s.price_kzt_minor, s.checked_at,
          c.status as latest_check_status,
          row_number() over (partition by l.doll_id, l.region order by s.checked_at desc, s.rowid desc) as region_rank
        from latest_checks c
        join amazon_listings l on l.id = c.listing_id
        join price_snapshots s on s.check_id = c.id
        where l.doll_id in (${placeholders}) and l.status = 'confirmed'
          and c.check_rank = 1 and c.status = 'verified'
      )
      select * from current_listing_snapshots where region_rank = 1 order by doll_id, region
    `).all(...dollIds) as Row[];
    for (const row of rows) {
      const dollId = String(row.doll_id);
      const region = String(row.region) as AmazonRegion;
      const currency = String(row.currency) as AmazonCurrency;
      if (currency !== amazonRegions[region].currency) continue;
      result[dollId]!.push({
        listingId: String(row.listing_id), region, asin: String(row.asin), url: String(row.url),
        snapshotId: String(row.snapshot_id), offerKind: String(row.offer_kind), priceMinor: Number(row.price_minor), currency,
        shippingMinor: row.shipping_minor === null ? null : Number(row.shipping_minor), sellerName: row.seller_name === null ? null : String(row.seller_name),
        fulfilledByAmazon: Number(row.fulfilled_by_amazon) === 1, availability: String(row.availability), condition: 'New' as const,
        couponText: row.coupon_text === null ? null : String(row.coupon_text), rateToKztMicros: Number(row.rate_to_kzt_micros),
        priceKztMinor: Number(row.price_kzt_minor), checkedAt: String(row.checked_at), latestCheckStatus: String(row.latest_check_status),
      });
    }
    return result;
  }

  history(dollId: string, range: '7d' | '30d' | '90d' | 'all' = '30d') {
    const days = range === 'all' ? null : Number(range.slice(0, -1));
    const cutoff = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
    const rows = this.db.prepare(`
      select l.region, l.id as listing_id, s.price_minor, s.price_kzt_minor, s.currency, s.checked_at
      from price_snapshots s join amazon_listings l on l.id = s.listing_id
      where l.doll_id = ? and (? is null or s.checked_at >= ?)
      order by s.checked_at asc
    `).all(dollId, cutoff, cutoff) as Row[];
    return rows.map((row) => ({ region: String(row.region) as AmazonRegion, listingId: String(row.listing_id), priceMinor: Number(row.price_minor), priceKztMinor: Number(row.price_kzt_minor), currency: String(row.currency), checkedAt: String(row.checked_at) }))
      .filter((price) => price.currency === amazonRegions[price.region].currency);
  }
}
