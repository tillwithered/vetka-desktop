import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { calculateOrder } from '@/domain/calculations';

export type OrderStatus = 'new' | 'awaiting_payment' | 'ordered' | 'shipped' | 'warehouse' | 'in_transit' | 'received' | 'delivered';
export type OrderCreateInput = {
  snapshotId: string; customerContact: string; localShippingMinor: number; localShippingRateToKztMicros: number;
  weightGrams: number; internationalRateMinorPerKg: number; internationalRateCurrency: string;
  internationalRateToKztMicros: number; extraCostsKztMinor: number; customerPriceKztMinor: number; notes: string | null;
};

type Row = Record<string, unknown>;

function mapOrder(row: Row, events: Row[] = []) {
  return {
    id: String(row.id), customerContact: String(row.customer_contact), dollId: String(row.doll_id), dollName: row.doll_name ? String(row.doll_name) : null,
    sourceSnapshotId: String(row.source_snapshot_id), sourceRegion: String(row.source_region), sourceAsin: String(row.source_asin), sourceUrl: String(row.source_url), sourceSeller: row.source_seller === null ? null : String(row.source_seller),
    sourcePriceMinor: Number(row.source_price_minor), sourceCurrency: String(row.source_currency), sourceRateToKztMicros: Number(row.source_rate_to_kzt_micros), sourcePriceKztMinor: Number(row.source_price_kzt_minor),
    localShippingMinor: Number(row.local_shipping_minor), weightGrams: Number(row.weight_grams), internationalRateMinorPerKg: Number(row.international_rate_minor_per_kg), internationalShippingKztMinor: Number(row.international_shipping_kzt_minor),
    extraCostsKztMinor: Number(row.extra_costs_kzt_minor), totalCostKztMinor: Number(row.total_cost_kzt_minor), customerPriceKztMinor: Number(row.customer_price_kzt_minor), profitKztMinor: Number(row.profit_kzt_minor), marginBasisPoints: row.margin_basis_points === null ? null : Number(row.margin_basis_points),
    status: String(row.status) as OrderStatus, trackingNumber: row.tracking_number === null ? null : String(row.tracking_number), notes: row.notes === null ? null : String(row.notes), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    events: events.map((event) => ({ id: String(event.id), previousStatus: event.previous_status === null ? null : String(event.previous_status) as OrderStatus, nextStatus: String(event.next_status) as OrderStatus, comment: event.comment === null ? null : String(event.comment), createdAt: String(event.created_at) })),
  };
}

export class OrderRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(input: OrderCreateInput) {
    const contact = input.customerContact.trim();
    if (!contact) throw new Error('Customer contact is required');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const source = this.db.prepare(`select s.*, l.doll_id, l.region, l.asin, l.url from price_snapshots s join amazon_listings l on l.id = s.listing_id where s.id = ?`).get(input.snapshotId) as Row | undefined;
      if (!source) throw new Error('Price snapshot not found');
      const calculation = calculateOrder({ sourcePriceMinor: Number(source.price_minor), sourceRateToKztMicros: Number(source.rate_to_kzt_micros), localShippingMinor: input.localShippingMinor, localShippingRateToKztMicros: input.localShippingRateToKztMicros, weightGrams: input.weightGrams, internationalRateMinorPerKg: input.internationalRateMinorPerKg, internationalRateToKztMicros: input.internationalRateToKztMicros, extraCostsKztMinor: input.extraCostsKztMinor, customerPriceKztMinor: input.customerPriceKztMinor });
      const id = randomUUID(); const now = new Date().toISOString();
      this.db.prepare(`insert into orders (
        id, customer_contact, doll_id, source_snapshot_id, source_region, source_asin, source_url, source_seller,
        source_price_minor, source_currency, source_rate_to_kzt_micros, source_price_kzt_minor,
        local_shipping_minor, local_shipping_currency, local_shipping_rate_to_kzt_micros, weight_grams,
        international_rate_minor_per_kg, international_rate_currency, international_rate_to_kzt_micros,
        international_shipping_kzt_minor, extra_costs_kzt_minor, total_cost_kzt_minor, customer_price_kzt_minor,
        profit_kzt_minor, margin_basis_points, status, notes, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`)
        .run(id, contact, String(source.doll_id), input.snapshotId, String(source.region), String(source.asin), String(source.url), source.seller_name === null ? null : String(source.seller_name),
          Number(source.price_minor), String(source.currency), Number(source.rate_to_kzt_micros), calculation.sourcePriceKztMinor,
          input.localShippingMinor, String(source.currency), input.localShippingRateToKztMicros, input.weightGrams,
          input.internationalRateMinorPerKg, input.internationalRateCurrency, input.internationalRateToKztMicros,
          calculation.internationalShippingKztMinor, input.extraCostsKztMinor, calculation.totalCostKztMinor,
          input.customerPriceKztMinor, calculation.profitKztMinor, calculation.marginBasisPoints, input.notes, now, now);
      this.db.prepare('insert into order_status_events (id, order_id, previous_status, next_status, created_at) values (?, ?, null, ?, ?)').run(randomUUID(), id, 'new', now);
      this.db.exec('COMMIT');
      return this.get(id)!;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  get(id: string) {
    const row = this.db.prepare('select o.*, d.name as doll_name from orders o join dolls d on d.id = o.doll_id where o.id = ?').get(id) as Row | undefined;
    if (!row) return null;
    const events = this.db.prepare('select * from order_status_events where order_id = ? order by created_at, rowid').all(id) as Row[];
    return mapOrder(row, events);
  }

  list(filter: { query?: string; status?: OrderStatus } = {}) {
    const conditions: string[] = []; const values: string[] = [];
    if (filter.status) { conditions.push('o.status = ?'); values.push(filter.status); }
    if (filter.query?.trim()) { conditions.push("(lower(o.customer_contact) like ? or lower(d.name) like ? or lower(coalesce(o.tracking_number,'')) like ?)"); const like = `%${filter.query.trim().toLowerCase()}%`; values.push(like, like, like); }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    return (this.db.prepare(`select o.*, d.name as doll_name from orders o join dolls d on d.id = o.doll_id ${where} order by o.updated_at desc`).all(...values) as Row[]).map((row) => mapOrder(row));
  }

  transition(id: string, nextStatus: OrderStatus, comment: string | null = null) {
    const order = this.get(id); if (!order) throw new Error('Order not found');
    const now = new Date().toISOString();
    this.db.prepare('update orders set status = ?, updated_at = ? where id = ?').run(nextStatus, now, id);
    this.db.prepare('insert into order_status_events (id, order_id, previous_status, next_status, comment, created_at) values (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, order.status, nextStatus, comment, now);
    return this.get(id)!;
  }

  updateTracking(id: string, trackingNumber: string | null) {
    this.db.prepare('update orders set tracking_number = ?, updated_at = ? where id = ?').run(trackingNumber?.trim() || null, new Date().toISOString(), id);
    const order = this.get(id); if (!order) throw new Error('Order not found'); return order;
  }
}
