# Cross-region ASIN collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse confirmed Amazon ASINs as strictly validated direct probes in every Amazon region before marketplace search.

**Architecture:** `collectDoll` will deduplicate every confirmed ASIN for the doll and open its canonical product URL in the requested region before any query search. The existing SKU/EAN/title fact triangle remains the only acceptance rule. Browser HTTP 202, 429 and 5xx responses will become a `blocked` collector result rather than `no_price`.

**Tech Stack:** Electron utility process, Playwright Chromium, TypeScript, Vitest, SQLite price checks.

## Global Constraints

- Use bundled Playwright Chromium only; do not use system Chrome/Edge or an extension.
- ASIN equality alone never confirms a product.
- Keep normal collection headless; only an explicit CAPTCHA uses a visible window.
- Preserve verified price history when a region is blocked.

---

### Task 1: Direct cross-region ASIN probe

**Files:**
- Modify: `apps/desktop/src/collector/amazon/collect.ts`
- Test: `apps/desktop/tests/collector/collect.test.ts`

**Interfaces:**
- Consumes: `CollectorRequest.knownListings`, `amazonRegions[region].host`, `matchCatalogOffer()`.
- Produces: a regional verified result before `CollectorDriver.search()` when a confirmed ASIN passes strict matching.

- [ ] **Step 1: Write the failing test**

```ts
expect(driver.openProduct).toHaveBeenCalledWith('amazon_uk', 'https://www.amazon.co.uk/dp/B0FK1V67X5');
expect(driver.search).not.toHaveBeenCalled();
expect(result.regions.amazon_uk).toMatchObject({ status: 'verified', asin: 'B0FK1V67X5' });
```

- [ ] **Step 2: Run the test red**

Run: `npm.cmd test -- --run tests/collector/collect.test.ts`

Expected: FAIL because known listings are currently filtered to the target region.

- [ ] **Step 3: Implement the minimal probe**

```ts
const listings = [...new Map(
  request.knownListings.filter((listing) => listing.confirmed).map((listing) => [listing.asin, listing]),
).values()];
const url = `https://${amazonRegions[region].host}/dp/${listing.asin}`;
```

Probe target-region listings first, then global listings. Parse with `expectedAsin`; accept only a verified `matchCatalogOffer()` result. On mismatch, continue to search.

- [ ] **Step 4: Run the test green**

Run: `npm.cmd test -- --run tests/collector/collect.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/desktop/src/collector/amazon/collect.ts apps/desktop/tests/collector/collect.test.ts
git commit -m "feat: probe confirmed ASINs across Amazon regions"
```

### Task 2: Transient Amazon block result

**Files:**
- Modify: `apps/desktop/src/collector/browser.ts`
- Modify: `apps/desktop/src/collector/amazon/product-page.ts`
- Modify: `apps/desktop/src/collector/amazon/collect.ts`
- Test: `apps/desktop/tests/collector/browser.test.ts`
- Test: `apps/desktop/tests/collector/collect.test.ts`

**Interfaces:**
- Consumes: Playwright response status and a `data-vetka-collector-status="blocked"` marker.
- Produces: `AmazonPageStatus = 'blocked'`, propagated without a false `no_price`.

- [ ] **Step 1: Write failing tests**

```ts
expect(isTransientAmazonResponse(202)).toBe(true);
expect(isTransientAmazonResponse(429)).toBe(true);
expect(isTransientAmazonResponse(503)).toBe(true);
expect(isTransientAmazonResponse(200)).toBe(false);
expect(result.regions.amazon_uk).toMatchObject({ status: 'blocked', asin: null });
```

- [ ] **Step 2: Run the tests red**

Run: `npm.cmd test -- --run tests/collector/browser.test.ts tests/collector/collect.test.ts`

Expected: FAIL because the classifier and blocked status do not exist.

- [ ] **Step 3: Implement minimal propagation**

```ts
export function isTransientAmazonResponse(status: number | null | undefined): boolean {
  return status === 202 || status === 429 || (status !== undefined && status >= 500);
}
```

For a transient response return a marker after closing the page. `parseAmazonProductPage()` maps the marker to `emptyResult('blocked')`; the collector returns it for that region and skips search.

- [ ] **Step 4: Run the tests green**

Run: `npm.cmd test -- --run tests/collector/browser.test.ts tests/collector/collect.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/desktop/src/collector/browser.ts apps/desktop/src/collector/amazon/product-page.ts apps/desktop/src/collector/amazon/collect.ts apps/desktop/tests/collector/browser.test.ts apps/desktop/tests/collector/collect.test.ts
git commit -m "fix: distinguish Amazon blocks from missing prices"
```

### Task 3: Persistence, version and release

**Files:**
- Modify: `apps/desktop/tests/main/price-service.test.ts`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/package-lock.json`

**Interfaces:**
- Consumes: `CollectorRegionResult.status = 'blocked'` for an existing confirmed regional listing.
- Produces: `price_checks.status = 'blocked'` and Windows release `v1.0.11`.

- [ ] **Step 1: Write the persistence test**

```ts
expect(db.prepare('select status from price_checks where listing_id = ?').get(listing.id)).toEqual({ status: 'blocked' });
```

- [ ] **Step 2: Run the test**

Run: `npm.cmd test -- --run tests/main/price-service.test.ts`

Expected: regression proof for the existing repository path after Task 2.

- [ ] **Step 3: Bump version to 1.0.11**

Set `"version": "1.0.11"` in `package.json` and both package-lock root entries.

- [ ] **Step 4: Run full verification**

Run: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`

Expected: all tests pass with no TypeScript or ESLint errors.

- [ ] **Step 5: Commit, tag and push**

```powershell
git add apps/desktop/package.json apps/desktop/package-lock.json apps/desktop/tests/main/price-service.test.ts
git commit -m "release: v1.0.11"
git tag v1.0.11
git push origin main
git push origin v1.0.11
```
