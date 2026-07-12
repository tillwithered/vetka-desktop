import { describe, expect, it } from 'vitest';

import { matchAmazonProduct, matchCatalogOffer } from '@/collector/amazon/matching';

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

describe('matchCatalogOffer', () => {
  const rules = { mattelSku: 'JMB92', upcEan: '194735123456', requiredTerms: ['Willow Thorne', 'Moonspell Magic'], rejectTerms: ['used', 'outfit'] };

  it('confirms an exact SKU together with doll context', () => {
    expect(matchCatalogOffer(rules, {
      title: 'Monster High Willow Thorne Moonspell Magic Doll', evidenceText: 'Model JMB92 Monster High', modelNumber: 'JMB92', condition: 'New',
    })).toMatchObject({ status: 'verified' });
    expect(matchCatalogOffer(rules, {
      title: 'Monster High Willow Thorne outfit', evidenceText: 'Model JMB92 Monster High', modelNumber: 'JMB92', condition: 'New',
    })).toMatchObject({ status: 'rejected', reason: 'reject_term' });
    expect(matchCatalogOffer(rules, {
      title: 'Willow Thorne', evidenceText: 'Model JMB93', condition: 'New',
    })).toMatchObject({ status: 'rejected', reason: 'insufficient_facts' });
  });

  it('does not reject a matching product because an unrelated page section mentions an accessory', () => {
    expect(matchCatalogOffer(rules, {
      title: 'Monster High Willow Thorne Moonspell Magic Doll',
      evidenceText: 'Model JMB92 Customers also viewed an outfit accessory only',
      modelNumber: 'JMB92',
      condition: 'New',
    })).toMatchObject({ status: 'verified' });
  });

  it('uses the fact triangle and rejects a single weak fact', () => {
    expect(matchCatalogOffer(rules, {
      title: 'Willow Thorne collector doll', evidenceText: 'EAN 194735123456', upcEan: '194735123456', condition: 'New',
    })).toMatchObject({ status: 'verified', facts: { upcEan: true, title: true } });
    expect(matchCatalogOffer(rules, {
      title: 'Willow Thorne', evidenceText: 'a random product', condition: 'New',
    })).toMatchObject({ status: 'rejected', reason: 'insufficient_facts' });
  });

  it('rejects Hunter x Hunter before it can become a catalog price', () => {
    expect(matchCatalogOffer(rules, {
      title: 'Hunter x Hunter HGC29 Figure', evidenceText: 'Model HGC29 anime figure', condition: 'New',
    })).toMatchObject({ status: 'rejected', reason: 'insufficient_facts' });
  });

  it('ignores a target SKU that appears only in recommendations', () => {
    expect(matchCatalogOffer({
      mattelSku: 'HYV90', requiredTerms: ['Operetta', 'Creeproduction'], rejectTerms: ['outfit'],
    }, {
      title: 'Monster High Lagoona Blue Gore-Geous Oasis Doll JDR51',
      evidenceText: 'Customers also viewed Monster High Operetta HYV90 Creeproduction Doll',
      modelNumber: 'JDR51',
      condition: 'New',
    })).toMatchObject({ status: 'rejected', reason: 'insufficient_facts' });
  });
});
