import { z } from 'zod';
import type { CollectorDollResult, CollectorStage } from '@/collector/contracts';

export const amazonRegionSchema = z.enum([
  'amazon_us',
  'amazon_uk',
  'amazon_de',
  'amazon_es',
  'amazon_it',
]);

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().default(null);

export const dollInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  characterName: nullableText(100),
  lineName: nullableText(100),
  generation: nullableText(40),
  mattelSku: nullableText(40),
  upcEan: z.string().trim().regex(/^\d{8,14}$/).nullable().default(null),
  imagePath: z.string().trim().nullable().default(null),
  notes: nullableText(2000),
});

export const dollUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    characterName: z.string().trim().max(100).nullable().optional(),
    lineName: z.string().trim().max(100).nullable().optional(),
    generation: z.string().trim().max(40).nullable().optional(),
    mattelSku: z.string().trim().max(40).nullable().optional(),
    upcEan: z.string().trim().regex(/^\d{8,14}$/).nullable().optional(),
    imagePath: z.string().trim().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const dollListFilterSchema = z.object({
  query: z.string().trim().max(160).optional(),
  favoritesOnly: z.boolean().optional(),
});

export type AmazonRegion = z.infer<typeof amazonRegionSchema>;
export type DollInput = z.infer<typeof dollInputSchema>;
export type DollUpdate = z.infer<typeof dollUpdateSchema>;
export type DollListFilter = z.infer<typeof dollListFilterSchema>;

export type Doll = DollInput & {
  id: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiError = { code: string; message: string };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string | null }
  | { status: 'downloaded'; version: string | null }
  | { status: 'error'; message: string };

export type CurrentPrice = {
  listingId: string;
  region: AmazonRegion;
  asin: string;
  url: string;
  snapshotId: string;
  offerKind: string;
  priceMinor: number;
  currency: 'USD' | 'GBP' | 'EUR';
  shippingMinor: number | null;
  sellerName: string | null;
  fulfilledByAmazon: boolean;
  availability: string;
  condition: 'New';
  couponText: string | null;
  rateToKztMicros: number;
  priceKztMinor: number;
  checkedAt: string;
  latestCheckStatus: string;
};

export type PriceHistoryRecord = {
  region: AmazonRegion;
  listingId: string;
  priceMinor: number;
  priceKztMinor: number;
  currency: string;
  checkedAt: string;
};

export type OrderStatus = 'new' | 'awaiting_payment' | 'ordered' | 'shipped' | 'warehouse' | 'in_transit' | 'received' | 'delivered';
export type OrderCreateInput = {
  snapshotId: string; customerContact: string; localShippingMinor: number; localShippingRateToKztMicros: number;
  weightGrams: number; internationalRateMinorPerKg: number; internationalRateCurrency: string;
  internationalRateToKztMicros: number; extraCostsKztMinor: number; customerPriceKztMinor: number; notes: string | null;
};
export type OrderRecord = {
  id: string; customerContact: string; dollId: string; dollName: string | null; sourceSnapshotId: string;
  sourceRegion: string; sourceAsin: string; sourceUrl: string; sourceSeller: string | null; sourcePriceMinor: number;
  sourceCurrency: string; sourceRateToKztMicros: number; sourcePriceKztMinor: number; localShippingMinor: number;
  weightGrams: number; internationalRateMinorPerKg: number; internationalShippingKztMinor: number; extraCostsKztMinor: number;
  totalCostKztMinor: number; customerPriceKztMinor: number; profitKztMinor: number; marginBasisPoints: number | null;
  status: OrderStatus; trackingNumber: string | null; notes: string | null; createdAt: string; updatedAt: string;
  events: Array<{ id: string; previousStatus: OrderStatus | null; nextStatus: OrderStatus; comment: string | null; createdAt: string }>;
};

export type VetkaDesktopApi = {
  health(): Promise<ApiResult<{ version: string }>>;
  updates: {
    getState(): Promise<ApiResult<UpdateState>>;
    check(): Promise<ApiResult<UpdateState>>;
    restartAndInstall(): Promise<ApiResult<null>>;
    onStateChanged(listener: (state: UpdateState) => void): () => void;
  };
  dolls: {
    list(filter?: DollListFilter): Promise<ApiResult<Doll[]>>;
    get(id: string): Promise<ApiResult<Doll | null>>;
    create(input: DollInput): Promise<ApiResult<Doll>>;
    update(id: string, input: DollUpdate): Promise<ApiResult<Doll>>;
    setFavorite(id: string, favorite: boolean): Promise<ApiResult<Doll>>;
  };
  settings: {
    getAll(): Promise<ApiResult<Record<string, unknown>>>;
    set(key: string, value: unknown): Promise<ApiResult<unknown>>;
  };
  amazon: {
    addListing(dollId: string, url: string): Promise<ApiResult<unknown>>;
    refreshDoll(dollId: string, regions: AmazonRegion[]): Promise<ApiResult<CollectorDollResult>>;
    reviewCandidate(listingId: string, decision: 'confirm' | 'reject'): Promise<ApiResult<unknown>>;
    resumeRegion(requestId: string, region: AmazonRegion): Promise<ApiResult<null>>;
    onProgress(listener: (event: { requestId: string; stage: CollectorStage; region?: AmazonRegion }) => void): () => void;
  };
  prices: {
    current(dollId: string): Promise<ApiResult<CurrentPrice[]>>;
    history(dollId: string, range?: '7d' | '30d' | '90d' | 'all'): Promise<ApiResult<PriceHistoryRecord[]>>;
  };
  orders: {
    list(filter?: { query?: string; status?: OrderStatus }): Promise<ApiResult<OrderRecord[]>>;
    get(id: string): Promise<ApiResult<OrderRecord | null>>;
    create(input: OrderCreateInput): Promise<ApiResult<OrderRecord>>;
    transition(id: string, status: OrderStatus, comment?: string | null): Promise<ApiResult<OrderRecord>>;
    updateTracking(id: string, trackingNumber: string | null): Promise<ApiResult<OrderRecord>>;
  };
};

declare global {
  interface Window {
    vetka: VetkaDesktopApi;
  }
}
