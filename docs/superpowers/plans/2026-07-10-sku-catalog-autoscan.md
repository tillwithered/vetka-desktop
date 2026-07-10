# SKU Catalog and Automatic Amazon Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the canonical SKU catalog into Vetka Desktop and automatically check active entries on launch and every two hours while the app is open.

**Architecture:** Add a catalog repository and seed asset backed by SQLite. A serial `CatalogScanService` obtains active catalog rows, applies SKU/title/condition rejection rules before handing accepted results to `PriceService`, and exposes its state via typed IPC. The existing price snapshots remain the only source for regional prices and history.

**Tech Stack:** Electron, TypeScript, node:sqlite, React, shadcn/ui, Vitest.

## Global Constraints

- Scan only `amazon_us`, `amazon_uk`, `amazon_de`, and `amazon_es`.
- Start one scan when services are ready; re-run 120 minutes after the prior run completes; never overlap runs.
- Accept only exact Mattel SKU + one configured title term + `New` condition and no reject term.
- Do not create candidates or a candidate-review interface from a catalog scan.
- Failed checks never overwrite a prior verified price.
- Closing the app disposes the scheduler.

---

### Task 1: Persist and seed the catalog

**Files:**
- Create: `apps/desktop/src/main/db/migrations/0002_catalog.sql`
- Create: `apps/desktop/src/main/catalog/seed.ts`
- Create: `apps/desktop/src/main/catalog/repository.ts`
- Create: `apps/desktop/tests/main/catalog-repository.test.ts`
- Modify: `apps/desktop/src/main/db/migrate.ts`
- Modify: `apps/desktop/src/main/dolls/repository.ts`

**Interfaces:**
- Produces `CatalogEntry`, `CatalogRepository.importSeed(entries)`, and `CatalogRepository.listActive()`.
- Consumes existing `DollRepository.create` and SQLite transaction boundary.

- [ ] **Step 1: Write failing catalog tests**

```ts
it('imports a seed idempotently and creates one doll per SKU', () => {
  const first = catalog.importSeed(seed);
  const second = catalog.importSeed(seed);
  expect(first.inserted).toBe(seed.length);
  expect(second.inserted).toBe(0);
  expect(db.prepare('select count(*) as count from dolls where mattel_sku = ?').get('JMB92')).toEqual({ count: 1 });
});

it('does not import a malformed SKU or partial batch', () => {
  expect(() => catalog.importSeed([{ ...seed[0], mattelSku: '' }])).toThrow('Invalid catalog entry');
  expect(catalog.listActive()).toEqual([]);
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm.cmd test -- catalog-repository.test.ts`

Expected: FAIL because catalog repository and migration do not exist.

- [ ] **Step 3: Add the migration, typed seed, and idempotent repository**

```sql
CREATE TABLE IF NOT EXISTS catalog_entries (
  mattel_sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  character_name TEXT,
  line_name TEXT,
  product_type TEXT NOT NULL,
  monitor_status TEXT NOT NULL CHECK (monitor_status IN ('active','monitor_only')),
  required_terms_json TEXT NOT NULL,
  reject_terms_json TEXT NOT NULL,
  search_query TEXT NOT NULL,
  source_url TEXT,
  source_checked_at TEXT NOT NULL,
  evidence TEXT NOT NULL,
  doll_id TEXT UNIQUE REFERENCES dolls(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`seed.ts` defines all 21 workbook rows as `readonly CatalogSeedEntry[]`. `importSeed` validates and normalizes uppercase SKUs, writes every row in one transaction, then calls a repository method that creates a doll only when no existing exact SKU exists; it never mutates `notes`, `is_favorite`, or `image_path`.

- [ ] **Step 4: Run catalog tests**

Run: `npm.cmd test -- catalog-repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/db apps/desktop/src/main/catalog apps/desktop/src/main/dolls/repository.ts apps/desktop/tests/main/catalog-repository.test.ts
git commit -m "feat: persist Monster High SKU catalog"
```

### Task 2: Make collector matching strict and candidate-free

**Files:**
- Modify: `apps/desktop/src/collector/contracts.ts`
- Modify: `apps/desktop/src/collector/amazon/collect.ts`
- Modify: `apps/desktop/src/collector/amazon/matching.ts`
- Modify: `apps/desktop/src/main/prices/service.ts`
- Modify: `apps/desktop/tests/collector/amazon-matching.test.ts`
- Modify: `apps/desktop/tests/collector/amazon-product-page.test.ts`
- Create: `apps/desktop/tests/collector/catalog-collection.test.ts`

**Interfaces:**
- Consumes `CatalogEntry` as `catalogRules` on a collector doll request.
- Produces one region result only after a candidate’s page passes exact SKU, configured terms, New condition, and reject-term checks.

- [ ] **Step 1: Write failing acceptance tests**

```ts
it.each([
  ['JMB92', 'Monster High Willow Thorne Moonspell Magic Doll', 'New', 'verified'],
  ['JMB93', 'Monster High Willow Thorne Moonspell Magic Doll', 'New', 'identity_mismatch'],
  ['JMB92', 'Monster High Willow Thorne outfit', 'New', 'identity_mismatch'],
  ['JMB92', 'Monster High Willow Thorne Moonspell Magic Doll', 'Used', 'identity_mismatch'],
])('accepts only the catalog identity rules', async (sku, title, condition, status) => {
  await expect(runFixture({ sku, title, condition })).resolves.toMatchObject({ status });
});

it('does not persist a search candidate when its product page fails catalog identity', async () => {
  await scanFixtureWithRejectedCandidate();
  expect(prices.listListings(doll.id)).toEqual([]);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd test -- catalog-collection.test.ts amazon-matching.test.ts`

Expected: FAIL because collector requests have no catalog rules and search candidates are persisted.

- [ ] **Step 3: Implement strict collection**

Search only the configured `searchQuery`; for each parsed Amazon result, open its product URL and build evidence from page title plus normalized page text. `matchCatalogOffer` returns `verified` only for exact case-insensitive SKU and one required term, and returns `identity_mismatch` for a reject term, mismatch, or non-New condition. `PriceService.refreshDoll` passes catalog rules and removes the `reviewCandidates` persistence loop.

- [ ] **Step 4: Run focused collector and price tests**

Run: `npm.cmd test -- catalog-collection.test.ts amazon-matching.test.ts prices-repository.test.ts`

Expected: PASS; rejected results create no listing or snapshot.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/collector apps/desktop/src/main/prices apps/desktop/tests/collector apps/desktop/tests/main/prices-repository.test.ts
git commit -m "feat: accept only verified catalog offers"
```

### Task 3: Schedule catalog scans and add typed IPC

**Files:**
- Create: `apps/desktop/src/main/catalog/scan-service.ts`
- Create: `apps/desktop/tests/main/catalog-scan-service.test.ts`
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/preload.ts`
- Modify: `apps/desktop/src/shared/channels.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`

**Interfaces:**
- `CatalogScanService.start(): void`, `runNow(): Promise<CatalogScanState>`, `getState(): CatalogScanState`, `dispose(): void`.
- `CatalogScanState = { status: 'idle'|'running'; startedAt: string|null; completedAt: string|null; nextRunAt: string|null; processed: number; total: number; regionStates: Partial<Record<AmazonRegion, string>> }`.

- [ ] **Step 1: Write failing scheduler tests**

```ts
it('runs once on start and schedules 120 minutes after completion', async () => {
  const harness = createSchedulerHarness();
  harness.service.start();
  await harness.flush();
  expect(harness.refreshCalls).toHaveLength(harness.activeEntries.length);
  expect(harness.scheduledDelayMs).toBe(120 * 60 * 1000);
});

it('does not overlap a manual run and clears the timer on dispose', async () => {
  const harness = createSchedulerHarness({ holdRefresh: true });
  void harness.service.runNow();
  await expect(harness.service.runNow()).resolves.toMatchObject({ status: 'running' });
  harness.service.dispose();
  expect(harness.clearCalls).toBe(1);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd test -- catalog-scan-service.test.ts`

Expected: FAIL because no scheduler exists.

- [ ] **Step 3: Implement serial scheduler and IPC**

Use injected `schedule`, `clearSchedule`, and `now` functions in `CatalogScanService` tests. `runNow` returns the existing state while a scan is active. It calls `PriceService.refreshCatalogEntry(entry, ['amazon_us','amazon_uk','amazon_de','amazon_es'])` one entry at a time, continues after errors, and schedules next only after the loop resolves. Start it after repositories and `PriceService` are ready; dispose it in `before-quit`.

Add `catalog.getScanState`, `catalog.refreshNow`, and `catalog.onScanStateChanged` to channels, preload, shared API contracts, and IPC registrar. Broadcast state to all windows from main.

- [ ] **Step 4: Run scheduler and IPC tests**

Run: `npm.cmd test -- catalog-scan-service.test.ts ipc.test.ts`

Expected: PASS; startup, cadence, non-overlap, disposal, and IPC validation are covered.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/catalog apps/desktop/src/main.ts apps/desktop/src/main/ipc apps/desktop/src/preload.ts apps/desktop/src/shared apps/desktop/tests/main/catalog-scan-service.test.ts apps/desktop/tests/main/ipc.test.ts
git commit -m "feat: schedule SKU catalog scans"
```

### Task 4: Show scan state and catalog prices in the desktop worklist

**Files:**
- Modify: `apps/desktop/src/renderer/features/dolls/dolls-page.tsx`
- Modify: `apps/desktop/src/renderer/features/dolls/doll-table.tsx`
- Modify: `apps/desktop/src/renderer/features/dolls/doll-detail-page.tsx`
- Create: `apps/desktop/src/renderer/features/dolls/catalog-scan-status.tsx`
- Create: `apps/desktop/tests/renderer/catalog-scan-status.test.tsx`

**Interfaces:**
- Consumes `window.vetka.catalog.getScanState`, `refreshNow`, and `onScanStateChanged`.
- Produces an accessible status region and one manual refresh button that is disabled during a running scan.

- [ ] **Step 1: Write failing renderer test**

```tsx
it('shows the scheduled scan and disables duplicate refreshes', async () => {
  render(<CatalogScanStatus />);
  expect(await screen.findByText(/следующая проверка/i)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /обновить сейчас/i }));
  expect(screen.getByRole('button', { name: /обновляется/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run focused renderer test and confirm failure**

Run: `npm.cmd test -- catalog-scan-status.test.tsx`

Expected: FAIL because the component and catalog API do not exist.

- [ ] **Step 3: Implement within the existing Maia/Violet desktop shell**

Add `CatalogScanStatus` above the doll worklist with last run, next run, `processed / total`, and a compact region outcome line. Add SKU and best verified current price columns to the existing table; reuse existing shadcn `Button`, `Badge`, `Tooltip`, and table primitives. On a doll detail, show per-region latest price/check status above the existing history chart. Do not create a candidate screen.

- [ ] **Step 4: Run renderer tests**

Run: `npm.cmd test -- catalog-scan-status.test.tsx dolls-page.test.tsx doll-detail-page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer apps/desktop/tests/renderer
git commit -m "feat: show catalog scan status and prices"
```

### Task 5: Full verification and release readiness

**Files:**
- Modify only if tests reveal a defect in the files above.

- [ ] **Step 1: Run the complete deterministic suite**

Run: `npm.cmd test`

Expected: PASS with no skipped new catalog/scheduler tests.

- [ ] **Step 2: Validate static quality and packaged app**

Run: `npm.cmd run lint; npm.cmd run typecheck; npm.cmd run package`

Expected: all commands exit 0 and the Windows package is created.

- [ ] **Step 3: Run a local smoke sequence**

Run: `npm.cmd run start`

Expected: app opens; catalog shows an initial scan state; manual refresh moves to running; a saved fixture/known listing produces price history; closing the app releases the scheduler.

- [ ] **Step 4: Commit verification fixes only if needed**

```bash
git add apps/desktop
git commit -m "test: verify catalog scan workflow"
```

## Plan self-review

- Spec coverage: Tasks 1–4 implement catalog import, strict matching, the four-region schedule, non-overlap, no candidate queue, persistence, IPC, and the desktop workflow. Task 5 verifies all required gates.
- Placeholder scan: no deferred or undefined implementation steps remain.
- Contract consistency: Task 1 creates `CatalogEntry`; Task 2 consumes it through `catalogRules`; Task 3 schedules `PriceService.refreshCatalogEntry`; Task 4 consumes the IPC scan state.
