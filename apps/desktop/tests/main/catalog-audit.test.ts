import { describe, expect, it } from 'vitest';

import { auditRetailCatalog } from '@/main/catalog/audit';
import { monsterHighSkuCatalog } from '@/main/catalog/seed';
import { verifiedAmazonListings } from '@/main/catalog/listing-seed';

describe('retail catalog audit', () => {
  it('accepts the production catalog and trusted listing seeds', () => {
    expect(auditRetailCatalog(monsterHighSkuCatalog, verifiedAmazonListings)).toEqual([]);
    expect(verifiedAmazonListings).toHaveLength(115);
    expect(verifiedAmazonListings.filter((listing) => listing.mattelSku === 'JHK29').map((listing) => listing.region).sort()).toEqual([
      'amazon_de', 'amazon_es', 'amazon_it', 'amazon_uk', 'amazon_us',
    ]);
    expect(verifiedAmazonListings.filter((listing) => listing.mattelSku === 'JMG74').map((listing) => listing.region).sort()).toEqual([
      'amazon_de', 'amazon_es', 'amazon_it', 'amazon_uk', 'amazon_us',
    ]);
  });

  it('reports incomplete identity, unknown SKUs, duplicate mappings, and invalid URLs', () => {
    const complete = monsterHighSkuCatalog.find((entry) => entry.monitorStatus === 'active')!;
    const listing = verifiedAmazonListings[0]!;
    const issues = auditRetailCatalog(
      [{ ...complete, mattelImageUrl: null }],
      [
        { ...listing, mattelSku: 'UNKNOWN' },
        listing,
        listing,
        { ...listing, region: 'amazon_uk', url: 'https://www.amazon.com/dp/B0CMGDLQC9' },
      ],
    );

    expect(issues.map((issue) => issue.code)).toEqual([
      'missing_mattel_identity',
      'listing_unknown_sku',
      'listing_identity_conflict',
      'duplicate_sku_region',
      'listing_identity_conflict',
      'invalid_listing_url',
    ]);
  });

  it('rejects one regional ASIN assigned to different Mattel SKUs', () => {
    const listing = verifiedAmazonListings[0]!;
    const otherSku = monsterHighSkuCatalog.find((entry) => entry.mattelSku !== listing.mattelSku)!.mattelSku;

    expect(auditRetailCatalog(monsterHighSkuCatalog, [listing, { ...listing, mattelSku: otherSku }]))
      .toContainEqual({ code: 'listing_identity_conflict', key: `${listing.region}:${listing.asin}` });
  });
});
