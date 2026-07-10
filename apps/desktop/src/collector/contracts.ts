import type { AmazonPageResult } from './amazon/product-page';
import type { AmazonCandidate } from './amazon/search';
import type { CatalogOfferRules, MatchDecision } from './amazon/matching';
import type { AmazonRegion } from '@/shared/contracts';

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
  catalogRules?: CatalogOfferRules;
};

export type CollectorRequestInput = Omit<CollectorRequest, 'type' | 'requestId' | 'regions'> & {
  regions: readonly AmazonRegion[];
};

export type CollectorRegionResult = AmazonPageResult & {
  region: AmazonRegion;
  url: string | null;
  reviewCandidates: AmazonCandidate[];
  matchDiagnostic?: MatchDecision;
};

export type CollectorDollResult = {
  requestId: string;
  regions: Partial<Record<AmazonRegion, CollectorRegionResult>>;
};

export type CollectorResponse =
  | { type: 'progress'; requestId: string; stage: CollectorStage; region?: AmazonRegion }
  | { type: 'result'; requestId: string; result: CollectorDollResult }
  | { type: 'error'; requestId: string; code: string; message: string };

export type CollectorControlMessage =
  | CollectorRequest
  | { type: 'cancel-request'; requestId: string }
  | { type: 'resume-region'; requestId: string; region: AmazonRegion };
