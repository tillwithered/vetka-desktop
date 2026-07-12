# Retail Mattel and Amazon Catalog Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the incomplete Monster High seed with a current Mattel-backed retail catalog and a verified five-marketplace Amazon listing map.

**Architecture:** Keep `catalog_entries`, `dolls`, and the existing ASIN-first price service as the runtime model. Move trusted retail product and Amazon listing facts into validated seed records, import them idempotently, and add an audit utility that rejects incomplete Mattel identities or unsafe Amazon mappings before release.

**Tech Stack:** Electron, TypeScript, Zod, SQLite, Cheerio, Vitest, existing Amazon Playwright collector.

## Global Constraints

- Mattel retail product pages are the catalog source of truth; Mattel Creations is excluded.
- Include full-size dolls and doll multipacks only; exclude non-doll merchandise and duplicate locale variants.
- Mattel SKU is the primary identity key; Russian name, exact English title, product URL, and official image are required.
- Amazon mappings are accepted only after direct-page ASIN, exact SKU, Monster High context, and `New` verification.
- A missing Amazon marketplace remains empty; it must never be filled by a weak match.
- Scheduled pricing remains ASIN-first, direct-first, once per 24 hours, with proxy retry only for classified Amazon blocks.

---

### Task 1: Make retail seed completeness enforceable

**Files:**
- Modify: `apps/desktop/src/main/catalog/repository.ts`
- Modify: `apps/desktop/src/main/catalog/seed.ts`
- Test: `apps/desktop/tests/main/catalog-repository.test.ts`

**Interfaces:**
- Produces `CatalogSeedEntry` records whose `officialName`, `mattelUrl`, and `mattelImageUrl` are required for `monitorStatus: 'active'`.
- Preserves nullable official fields only for legacy `monitor_only` rows.

- [ ] **Step 1: Write failing completeness tests.**

```ts
it('requires complete Mattel identity for active retail entries', () => {
  const invalid = { ...monsterHighSkuCatalog.find((entry) => entry.monitorStatus === 'active')!, officialName: null };
  expect(() => catalog.importSeed([invalid])).toThrow('Active catalog entry requires official Mattel identity');
});

it('keeps every active retail entry product-specific and image-backed', () => {
  for (const entry of monsterHighSkuCatalog.filter((item) => item.monitorStatus === 'active')) {
    expect(entry.officialName).toMatch(/^Monster High/i);
    expect(entry.mattelUrl).toMatch(/^https:\/\/shop\.mattel\.com\/products\//);
    expect(entry.mattelImageUrl).toMatch(/^https:\/\/cdn\.shopify\.com\//);
    expect(entry.sourceUrl).toBe(entry.mattelUrl);
  }
});
```

- [ ] **Step 2: Run the focused test and confirm RED.**

Run: `npm.cmd --prefix apps/desktop test -- catalog-repository`

Expected: FAIL because active entries with collection-only or missing Mattel identity are currently accepted.

- [ ] **Step 3: Tighten validation and curate the live retail seed.**

Add the active-entry refinement:

```ts
const catalogSeedSchema = baseCatalogSeedSchema.superRefine((entry, context) => {
  if (entry.monitorStatus === 'active' && (!entry.officialName || !entry.mattelUrl || !entry.mattelImageUrl || entry.sourceUrl !== entry.mattelUrl)) {
    context.addIssue({ code: 'custom', message: 'Active catalog entry requires official Mattel identity' });
  }
});
```

Replace collection-only active rows in `monsterHighSkuCatalog` with product-specific facts gathered from current `shop.mattel.com` product pages. Retain only full-size dolls and multipacks; move confirmed unavailable legacy products to `monitor_only` instead of deleting user data. Set `sourceCheckedAt` to the actual collection audit date.

- [ ] **Step 4: Run the focused test and confirm GREEN.**

Run: `npm.cmd --prefix apps/desktop test -- catalog-repository dolls-repository price-service`

Expected: PASS with no active row missing official identity.

- [ ] **Step 5: Commit the retail catalog identity update.**

```powershell
git add apps/desktop/src/main/catalog/repository.ts apps/desktop/src/main/catalog/seed.ts apps/desktop/tests/main/catalog-repository.test.ts
git commit -m "data: complete Mattel retail catalog"
```

### Task 2: Support and validate five-region trusted listing seeds

**Files:**
- Modify: `apps/desktop/src/main/catalog/listing-seed.ts`
- Test: `apps/desktop/tests/main/catalog-repository.test.ts`
- Test: `apps/desktop/tests/main/prices-repository.test.ts`

**Interfaces:**
- Produces exported `VerifiedAmazonListingSeed` with `mattelSku`, `region`, `asin`, `url`, and `verifiedAt`.
- `seedVerifiedAmazonListings()` imports at most one trusted ASIN for each SKU/region pair.

- [ ] **Step 1: Write failing listing-seed validation tests.**

```ts
it('contains no duplicate SKU-region mapping and uses canonical marketplace URLs', () => {
  const keys = new Set<string>();
  for (const listing of verifiedAmazonListings) {
    const key = `${listing.mattelSku}:${listing.region}`;
    expect(keys.has(key)).toBe(false);
    keys.add(key);
    expect(normalizeAmazonUrl(listing.url)).toMatchObject({ region: listing.region, asin: listing.asin });
  }
});

it('seeds every verified region as confirmed exact identity', () => {
  seedVerifiedAmazonListings({ catalog, prices });
  expect(prices.listListings(doll.id)).toEqual(expect.arrayContaining([
    expect.objectContaining({ region: 'amazon_es', asin: 'B0CMGDLQC9', status: 'confirmed' }),
  ]));
});
```

- [ ] **Step 2: Run focused tests and confirm RED.**

Run: `npm.cmd --prefix apps/desktop test -- catalog-repository prices-repository`

Expected: FAIL because the seed is private, has no audit date, and only one mapping is represented.

- [ ] **Step 3: Implement the validated seed contract and import guard.**

```ts
export type VerifiedAmazonListingSeed = {
  mattelSku: string;
  region: AmazonRegion;
  asin: string;
  url: string;
  verifiedAt: string;
};

export const verifiedAmazonListings: readonly VerifiedAmazonListingSeed[] = [
  { mattelSku: 'HXH76', region: 'amazon_es', asin: 'B0CMGDLQC9', url: 'https://www.amazon.es/dp/B0CMGDLQC9', verifiedAt: '2026-07-12' },
];
```

Before writes, validate canonical region/ASIN and reject duplicate `${mattelSku}:${region}` keys. Expand this array only with mappings verified live from direct Amazon product pages. Leave genuinely missing countries absent.

- [ ] **Step 4: Run focused tests and confirm GREEN.**

Run: `npm.cmd --prefix apps/desktop test -- catalog-repository prices-repository asin-price-refresh-service`

Expected: PASS; all trusted rows import idempotently as confirmed exact-identity listings.

- [ ] **Step 5: Commit the trusted Amazon map.**

```powershell
git add apps/desktop/src/main/catalog/listing-seed.ts apps/desktop/tests/main/catalog-repository.test.ts apps/desktop/tests/main/prices-repository.test.ts
git commit -m "data: add verified Amazon catalog mappings"
```

### Task 3: Add a deterministic retail catalog audit

**Files:**
- Create: `apps/desktop/src/main/catalog/audit.ts`
- Create: `apps/desktop/tests/main/catalog-audit.test.ts`
- Modify: `apps/desktop/package.json`

**Interfaces:**
- Produces `auditRetailCatalog(catalog, listings): CatalogAuditIssue[]`.
- Produces `npm run catalog:audit` for release verification.

- [ ] **Step 1: Write the failing audit test.**

```ts
it('reports incomplete identity, duplicate mappings, and unknown SKUs', () => {
  expect(auditRetailCatalog(
    [{ ...completeEntry, mattelImageUrl: null }],
    [{ ...listing, mattelSku: 'UNKNOWN' }, listing, listing],
  ).map((issue) => issue.code)).toEqual([
    'missing_mattel_identity', 'listing_unknown_sku', 'duplicate_sku_region',
  ]);
});
```

- [ ] **Step 2: Run the audit test and confirm RED.**

Run: `npm.cmd --prefix apps/desktop test -- catalog-audit`

Expected: FAIL because `auditRetailCatalog` does not exist.

- [ ] **Step 3: Implement exact audit rules and command.**

```ts
export type CatalogAuditIssue = {
  code: 'missing_mattel_identity' | 'listing_unknown_sku' | 'duplicate_sku_region' | 'invalid_listing_url';
  key: string;
};
```

Return issues in catalog order, then listing order. The dedicated test imports both production seeds and fails with one assertion message per issue. Add `"catalog:audit": "vitest run tests/main/catalog-audit.test.ts"` to `package.json`.

- [ ] **Step 4: Run audit and focused tests.**

Run: `npm.cmd --prefix apps/desktop run catalog:audit`

Expected: exit 0 and no catalog issues.

- [ ] **Step 5: Commit the audit gate.**

```powershell
git add apps/desktop/src/main/catalog/audit.ts apps/desktop/tests/main/catalog-audit.test.ts apps/desktop/package.json
git commit -m "test: audit retail catalog seeds"
```

### Task 4: Verify the retail workflow end to end

**Files:**
- Modify: `apps/desktop/package.json` only for the final patch version after every check passes.

- [ ] **Step 1: Run deterministic verification.**

Run: `npm.cmd --prefix apps/desktop test; npm.cmd --prefix apps/desktop run lint; npm.cmd --prefix apps/desktop run typecheck; npm.cmd --prefix apps/desktop run catalog:audit; npm.cmd --prefix apps/desktop run package; npm.cmd --prefix apps/desktop run release:verify-version`

Expected: every command exits 0 without test failures, lint errors, type errors, audit issues, or packaging errors.

- [ ] **Step 2: Run live evidence checks.**

Open every active Mattel URL and each seeded Amazon URL. Record no listing unless the final ASIN, exact SKU, Monster High context, and New offer identity are visible. Trigger one bulk price refresh and confirm that failures preserve prior prices.

- [ ] **Step 3: Run visual verification.**

Check `Куклы` and a populated doll detail in Electron at 1080x720, 1280x800, and 1440x900 with expanded and collapsed sidebars. Confirm long names, missing-region cells, stale prices, and official Mattel links do not clip.

- [ ] **Step 4: Commit the patch release if source files changed after the last commit.**

```powershell
git add apps/desktop/package.json apps/desktop/package-lock.json
git commit -m "chore: release next Vetka Desktop patch"
```
