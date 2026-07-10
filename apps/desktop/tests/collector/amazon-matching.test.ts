import { describe, expect, it } from 'vitest';

import { matchAmazonProduct } from '@/collector/amazon/matching';

const doll = {
  name: 'Monster High Draculaura Core Refresh Doll',
  characterName: 'Draculaura',
  lineName: 'Core Refresh',
  generation: 'G3',
  mattelSku: 'HRP64',
  upcEan: '194735183302',
};

describe('matchAmazonProduct', () => {
  it('verifies exact identifiers and manual confirmations', () => {
    expect(matchAmazonProduct(doll, { title: doll.name, modelNumber: 'hrp64' })).toMatchObject({ status: 'verified', score: 100, reason: 'mattel_sku' });
    expect(matchAmazonProduct(doll, { title: doll.name, upcEan: '194735183302' })).toMatchObject({ status: 'verified', reason: 'upc_ean' });
    expect(matchAmazonProduct(doll, { title: doll.name, manuallyConfirmed: true })).toMatchObject({ status: 'verified', reason: 'manual' });
  });

  it('rejects accessories before considering character overlap', () => {
    expect(matchAmazonProduct(doll, { title: 'Draculaura replacement shoes accessory set HRP64', modelNumber: 'HRP64' })).toMatchObject({ status: 'rejected', reason: 'non_doll' });
  });

  it('never verifies from title similarity alone', () => {
    expect(matchAmazonProduct(doll, { title: 'Mattel Monster High Draculaura Core Refresh G3 Doll' })).toMatchObject({ status: 'needs_review' });
  });
});
