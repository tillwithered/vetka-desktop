import type { AmazonPageResult } from './amazon/product-page';
import type { AmazonCandidate } from './amazon/search';
import type { CatalogOfferRules, MatchDecision } from './amazon/matching';
import type { OfficialStoreDoll } from './amazon/store';
import type { AmazonRegion } from '@/shared/contracts';
import type { AmazonProxyTransport } from '@/main/collector/proxy-transport';

export type CollectorDollIdentity = {
  id: string;
  name: string;
  characterName?: string | null;
  lineName?: string | null;
  generation?: string | null;
  mattelSku?: string | null;
  upcEan?: string | null;
};

export type KnownAmazonListing = {
  region: AmazonRegion;
  asin: string;
  url: string;
  confirmed: boolean;
};

export type CollectorStage = 'queued' | 'searching' | 'checking' | 'captcha_required' | 'completed' | 'failed';

export type CollectorRequest = {
  type: 'refresh-doll';
  requestId: string;
  dataDir: string;
  doll: CollectorDollIdentity;
  knownListings: KnownAmazonListing[];
  regions: AmazonRegion[];
  knownAsinsOnly?: boolean;
  catalogRules?: CatalogOfferRules;
  transport?: AmazonProxyTransport;
};

export type CollectorRequestInput = Omit<CollectorRequest, 'type' | 'requestId' | 'regions'> & {
  regions: readonly AmazonRegion[];
};

export type CollectorRegionResult = AmazonPageResult & {
  region: AmazonRegion;
  url: string | null;
  evidenceUrl: string;
  reviewCandidates: AmazonCandidate[];
  matchDiagnostic?: MatchDecision;
};

export type CollectorOfficialStoreRequest = {
  type: 'import-official-store'; requestId: string; dataDir: string; regions: AmazonRegion[]; transport?: AmazonProxyTransport;
};

export type CollectorOfficialStoreResult = {
  requestId: string;
  products: OfficialStoreDoll[];
  regions: Partial<Record<AmazonRegion, { status: 'completed' | 'blocked' | 'failed'; total: number; error?: string }>>;
};

export type CollectorDollResult = {
  requestId: string;
  regions: Partial<Record<AmazonRegion, CollectorRegionResult>>;
};

export type CollectorResponse =
  | { type: 'progress'; requestId: string; stage: CollectorStage; region?: AmazonRegion; processed?: number; total?: number }
  | { type: 'result'; requestId: string; result: CollectorDollResult }
  | { type: 'official-store-result'; requestId: string; result: CollectorOfficialStoreResult }
  | { type: 'error'; requestId: string; code: string; message: string };

export type CollectorControlMessage =
  | CollectorRequest
  | CollectorOfficialStoreRequest
  | { type: 'cancel-request'; requestId: string }
  | { type: 'resume-region'; requestId: string; region: AmazonRegion };
