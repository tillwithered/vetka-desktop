# Amazon Catalog Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 140 active Monster High SKU/region cells auditable with a current price or an explicit linked absence result, while preventing historical prices from appearing as current.

**Architecture:** Add a catalog-region evidence ledger beside existing listings and snapshots. The collector reports a deterministic evidence URL for every requested region, `PriceService` persists every result, and a new read model combines the evidence ledger with only currently verified snapshots. The UI renders exactly five operational region rows and keeps historical prices exclusively in history.

**Tech Stack:** Electron, TypeScript, React 19, SQLite `DatabaseSync`, Vitest, Testing Library, Playwright-backed Amazon collector, shadcn radix-maia.

## Global Constraints

- Process all 28 active SKUs across `amazon_us`, `amazon_uk`, `amazon_de`, `amazon_es`, and `amazon_it` (140 cells).
- Every cell needs a current terminal result, correct Amazon-domain evidence URL, and check timestamp.
- Retryable/error states keep coverage incomplete and must be retried.
- Do not show a historical snapshot as a current price after `no_price` or `out_of_stock`.
- Preserve price history and existing order audit records.
- Use the existing Maia/Violet/Inter/Lucide UI and local shadcn primitives only.
- Follow red-green TDD for every behavior change.

---

### Task 1: Persist regional evidence for every catalog check

**Files:**
- Create: `apps/desktop/src/main/db/migrations/0007_catalog_region_evidence.sql`
- Create: `apps/desktop/src/main/catalog/region-evidence-repository.ts`
- Modify: `apps/desktop/src/main/db/migrate.ts`
- Test: `apps/desktop/tests/main/catalog-region-evidence.test.ts`
- Modify: `apps/desktop/tests/main/database.test.ts`

**Interfaces:**
- Produces `CatalogRegionEvidenceStatus`, `CatalogRegionEvidence`, and `CatalogRegionEvidenceRepository.upsert/listForDoll/listForActiveCatalog`.
- Consumes the existing `catalog_entries(mattel_sku, doll_id)` and `AmazonRegion` values.

- [ ] **Step 1: Write failing migration and repository tests**

```ts
repository.upsert({
  mattelSku: 'JMB81', dollId, region: 'amazon_it', status: 'no_price',
  evidenceUrl: 'https://www.amazon.it/dp/B0FJZYDKX9', asin: 'B0FJZYDKX9',
  checkedAt: '2026-07-12T10:00:00.000Z', diagnostic: { source: 'exact_product' },
});
expect(repository.listForDoll(dollId)).toEqual([expect.objectContaining({ region: 'amazon_it', status: 'no_price' })]);
```

- [ ] **Step 2: Run `npm.cmd test -- --run tests/main/catalog-region-evidence.test.ts tests/main/database.test.ts` and verify the missing table/module failure**
- [ ] **Step 3: Add migration `0007` with primary key `(mattel_sku, region)`, Amazon region/status checks, evidence URL, nullable ASIN, timestamp, diagnostic JSON, and catalog/doll foreign keys**
- [ ] **Step 4: Implement repository validation so evidence URLs must match the expected regional Amazon host and ASINs are normalized uppercase**
- [ ] **Step 5: Re-run the targeted tests and commit `feat: persist catalog region evidence`**

### Task 2: Make collector results auditable even when no listing is found

**Files:**
- Modify: `apps/desktop/src/collector/contracts.ts`
- Modify: `apps/desktop/src/collector/amazon/collect.ts`
- Modify: `apps/desktop/src/collector/amazon/regions.ts`
- Test: `apps/desktop/tests/collector/collect.test.ts`

**Interfaces:**
- Extends `CollectorRegionResult` with required `evidenceUrl: string`.
- Produces `amazonEvidenceUrl(region, sku)` for deterministic SKU search links.

- [ ] **Step 1: Add failing tests asserting exact product evidence for known ASINs and SKU-search evidence for a not-found result**

```ts
expect(result.regions.amazon_it).toMatchObject({
  status: 'not_found',
  evidenceUrl: 'https://www.amazon.it/s?k=JMG63',
});
```

- [ ] **Step 2: Run the collector test and verify it fails because `not_found`/`evidenceUrl` do not exist**
- [ ] **Step 3: Add `not_found` to Amazon page/check status types, always attach exact product URLs to known ASIN results, and attach encoded regional search URLs when all identity-safe searches fail**
- [ ] **Step 4: Ensure blocked/captcha/network results also carry the URL that was actually checked**
- [ ] **Step 5: Re-run collector tests and commit `feat: report regional catalog evidence`**

### Task 3: Persist all five results during every retail refresh

**Files:**
- Modify: `apps/desktop/src/main/prices/service.ts`
- Modify: `apps/desktop/src/main/catalog/asin-price-refresh-service.ts`
- Modify: `apps/desktop/src/main.ts`
- Test: `apps/desktop/tests/main/price-service.test.ts`
- Test: `apps/desktop/tests/main/asin-price-refresh-service.test.ts`

**Interfaces:**
- `PriceService` receives `regionEvidence: CatalogRegionEvidenceRepository`.
- Every processed collector region calls `regionEvidence.upsert(...)`, including missing ASINs.

- [ ] **Step 1: Write a failing service test returning five mixed region results and assert five evidence rows are persisted**
- [ ] **Step 2: Run targeted tests and verify zero evidence rows are currently written**
- [ ] **Step 3: Inject the repository in app bootstrap and persist result status, ASIN, evidence URL, timestamp, and safe match diagnostics before snapshot handling**
- [ ] **Step 4: Convert thrown single-region collector failures into a persisted retryable `network_error` row, continue remaining regions, and return aggregate diagnostics without discarding successful regions**
- [ ] **Step 5: Re-run targeted tests and commit `feat: audit every Amazon catalog region`**

### Task 4: Stop historical prices from masquerading as current

**Files:**
- Modify: `apps/desktop/src/main/prices/repository.ts`
- Test: `apps/desktop/tests/main/prices-repository.test.ts`
- Test: `apps/desktop/tests/main/price-service.test.ts`

**Interfaces:**
- `PriceRepository.current/currentForDolls` return snapshots only when the listing's latest check is `verified` and the snapshot's `check_id` equals that latest check.
- `history` remains unchanged.

- [ ] **Step 1: Add failing tests for `verified -> no_price` and `verified -> out_of_stock`: current is empty while history retains the old amount**
- [ ] **Step 2: Run repository tests and observe the old snapshot incorrectly returned**
- [ ] **Step 3: Rewrite current-price queries around a `latest_checks` CTE and join snapshots by `check_id`, filtering `latest_checks.status = 'verified'`**
- [ ] **Step 4: Re-run repository and order-source tests and commit `fix: expose only currently verified prices`**

### Task 5: Complete trusted seed coverage and strengthen static audit

**Files:**
- Modify: `apps/desktop/src/main/catalog/listing-seed.ts`
- Modify: `apps/desktop/src/main/catalog/audit.ts`
- Test: `apps/desktop/tests/main/catalog-audit.test.ts`

**Interfaces:**
- Adds `amazon_it` for JMB81/B0FJZYDKX9.
- Static audit continues rejecting duplicate/conflicting identities and verifies known user-confirmed coverage.

- [ ] **Step 1: Change the audit expectation to 116 verified links and require all five JMB81 regions; run it red**
- [ ] **Step 2: Add `amazon_it` to the JMB81 region seed and run the audit green**
- [ ] **Step 3: Add assertions that every seeded URL host matches its region and commit `data: add verified JMB81 Amazon Italy listing`**

### Task 6: Expose a five-row regional state read model

**Files:**
- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `apps/desktop/src/shared/channels.ts`
- Modify: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/preload.ts`
- Create: `apps/desktop/src/main/catalog/region-state-service.ts`
- Test: `apps/desktop/tests/main/ipc-validation.test.ts`
- Test: `apps/desktop/tests/main/catalog-region-evidence.test.ts`

**Interfaces:**
- Adds `RegionalPriceState` and `window.vetka.prices.regions(dollId)`.
- `RegionalPriceState` includes region, status, evidence URL, ASIN, checkedAt, current price or null, and `overdue`.

- [ ] **Step 1: Write failing tests expecting exactly five ordered states and no amount for `no_price`**
- [ ] **Step 2: Run tests red because the endpoint/service is absent**
- [ ] **Step 3: Implement the service by left-joining the fixed five-region list to evidence and currently verified prices; compute overdue only after 36 hours**
- [ ] **Step 4: Register validated IPC/preload API and run tests green**
- [ ] **Step 5: Commit `feat: expose complete regional price states`**

### Task 7: Replace misleading freshness UI and hide unsourced identity gaps

**Files:**
- Modify: `apps/desktop/src/renderer/features/dolls/doll-detail-page.tsx`
- Modify: `apps/desktop/src/renderer/features/dolls/doll-identity-profile.tsx`
- Modify: `apps/desktop/src/renderer/features/prices/regional-offer-list.tsx`
- Modify: `apps/desktop/src/domain/freshness.ts`
- Test: `apps/desktop/tests/renderer/doll-detail.test.tsx`
- Test: `apps/desktop/tests/renderer/doll-identity-profile.test.tsx`
- Test: `apps/desktop/tests/domain/freshness.test.ts`

**Interfaces:**
- `RegionalOfferList` consumes `RegionalPriceState[]`, not `CurrentPrice[]`.
- Order sheet continues consuming currently verified `CurrentPrice[]` only.

- [ ] **Step 1: Add failing renderer tests for five rows, operational Russian labels, timestamps/links, no stale amount under `no_price`, and absence of `Свежая/Давно/Устарела`**
- [ ] **Step 2: Add a failing identity test requiring null optional facts to be omitted rather than rendered as dashes**
- [ ] **Step 3: Run tests red**
- [ ] **Step 4: Implement compact rows using existing `Badge`, `Button`, `Separator`, and `Alert`; show `Проверка просрочена` only after 36 hours**
- [ ] **Step 5: Filter null optional identity facts while preserving all required sourced facts**
- [ ] **Step 6: Run renderer/domain tests green and commit `fix: clarify Amazon price availability`**

### Task 8: Add and execute the 140-cell completion verifier

**Files:**
- Create: `apps/desktop/scripts/verify-amazon-catalog-coverage.ts`
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/tests/main/catalog-coverage.test.ts`
- Create: `outputs/amazon-catalog-coverage.json` (runtime artifact, keep untracked unless user requests otherwise)

**Interfaces:**
- Adds `npm.cmd run catalog:coverage`.
- Verifier exits nonzero for missing, overdue, wrong-domain, identity-conflict, or retryable cells and emits per-SKU/per-region JSON.

- [ ] **Step 1: Write failing verifier unit tests with a 140-cell fixture containing one missing and one blocked cell**
- [ ] **Step 2: Run tests red because the verifier is absent**
- [ ] **Step 3: Implement coverage evaluation with terminal statuses `verified/no_price/out_of_stock/not_found` and strict URL/ASIN/timestamp checks**
- [ ] **Step 4: Add package script and run tests green**
- [ ] **Step 5: Run the real full catalog refresh, repeatedly retry only incomplete cells, and write the evidence report**
- [ ] **Step 6: Continue discovery/checks until the report proves 140/140 terminal cells; manually inspect every SKU row and JMB81 IT**
- [ ] **Step 7: Commit verifier code (not the user's `outputs/` directory) as `feat: verify complete Amazon catalog coverage`**

### Task 9: Full verification and visual QA

**Files:**
- Verify all files changed above.

**Interfaces:**
- Consumes the completed 140-cell report and packaged Electron build.

- [ ] **Step 1: Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run catalog:audit`, and `npm.cmd run catalog:coverage`**
- [ ] **Step 2: Run `$env:GITHUB_REF_NAME='v1.0.33'; npm.cmd run release:verify-version` and `npm.cmd run package`**
- [ ] **Step 3: Launch the packaged app and inspect populated, no-price, out-of-stock, not-found, retryable, overdue, loading, and partial states**
- [ ] **Step 4: Check 1080×720, 1280×800, and 1440×900 with sidebar expanded and collapsed; reject clipping/global overflow**
- [ ] **Step 5: Re-query the production database and prove 28 active SKUs, 140 evidence rows, zero retryable/missing cells, JMB81 IT exact ASIN/link, and zero current prices whose latest check is non-verified**
- [ ] **Step 6: Commit any verification-only fixes separately and finish the branch**

