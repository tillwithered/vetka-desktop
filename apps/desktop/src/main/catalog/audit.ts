import { normalizeAmazonUrl } from '@/collector/amazon/url';

import type { CatalogSeedEntry } from './repository';
import type { VerifiedAmazonListingSeed } from './listing-seed';

export type CatalogAuditIssue = {
  code: 'missing_mattel_identity' | 'listing_unknown_sku' | 'duplicate_sku_region' | 'listing_identity_conflict' | 'invalid_listing_url';
  key: string;
};

export function auditRetailCatalog(
  catalog: readonly CatalogSeedEntry[],
  listings: readonly VerifiedAmazonListingSeed[],
): CatalogAuditIssue[] {
  const issues: CatalogAuditIssue[] = [];
  const knownSkus = new Set(catalog.map((entry) => entry.mattelSku));

  for (const entry of catalog) {
    if (entry.monitorStatus === 'active'
      && (!entry.officialName || !entry.mattelUrl || !entry.mattelImageUrl || entry.sourceUrl !== entry.mattelUrl)) {
      issues.push({ code: 'missing_mattel_identity', key: entry.mattelSku });
    }
  }

  const listingKeys = new Set<string>();
  const identityOwners = new Map<string, string>();
  for (const listing of listings) {
    const key = `${listing.mattelSku}:${listing.region}`;
    const identityKey = `${listing.region}:${listing.asin}`;
    if (!knownSkus.has(listing.mattelSku)) issues.push({ code: 'listing_unknown_sku', key });
    if (listingKeys.has(key)) issues.push({ code: 'duplicate_sku_region', key });
    listingKeys.add(key);
    const owner = identityOwners.get(identityKey);
    if (owner && owner !== listing.mattelSku) issues.push({ code: 'listing_identity_conflict', key: identityKey });
    else identityOwners.set(identityKey, listing.mattelSku);
    try {
      const normalized = normalizeAmazonUrl(listing.url);
      if (normalized.region !== listing.region || normalized.asin !== listing.asin) {
        issues.push({ code: 'invalid_listing_url', key });
      }
    } catch {
      issues.push({ code: 'invalid_listing_url', key });
    }
  }

  return issues;
}
