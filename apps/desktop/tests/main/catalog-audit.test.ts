import { describe, expect, it } from 'vitest';

import { auditRetailCatalog } from '@/main/catalog/audit';
import { monsterHighSkuCatalog } from '@/main/catalog/seed';
import { verifiedAmazonListings } from '@/main/catalog/listing-seed';

describe('retail catalog audit', () => {
  it('accepts the production catalog and trusted listing seeds', () => {
    expect(auditRetailCatalog(monsterHighSkuCatalog, verifiedAmazonListings)).toEqual([]);
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
      'duplicate_sku_region',
      'invalid_listing_url',
    ]);
  });
});
