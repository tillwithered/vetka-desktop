# Official Store-only and Update Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the operational catalog use only official Monster High Amazon Store pages, expose one current price per region, and move update checking into Settings without a notification banner.

**Architecture:** `CatalogScanService` will invoke `OfficialStoreImportService` as its complete work unit and schedule that unit after a manual run. `PriceRepository` will preserve historical listings but select one canonical Store-backed current listing per doll/region. Renderer update controls will use existing health/update IPC only.

**Tech Stack:** Electron, TypeScript, SQLite (`node:sqlite`), Playwright utility worker, React, TanStack Query, shadcn Maia/Violet primitives, Vitest.

## Global Constraints

- Amazon data source is only official Monster High Store US, UK, DE, ES and IT pages.
- Never start an Amazon scan on application launch; repeat Store import every two hours only after a manual update.
- Preserve historical listings, price snapshots and orders while hiding stale duplicate listings from current prices.
- Never expose Chromium executable paths, arguments, profile paths or raw worker logs in renderer errors.
- Use existing shadcn primitives and the Maia/Violet/Inter/Lucide preset; no new UI library, raw palette or full-width desktop CTA.
- Use `npm.cmd` for all npm commands in PowerShell.

---

### Task 1: Make one official Store listing canonical per doll and region

**Files:**
- Modify: `apps/desktop/src/main/prices/repository.ts:45-190`
- Modify: `apps/desktop/src/main/prices/service.ts:37-52`
- Test: `apps/desktop/tests/main/prices-repository.test.ts`
- Test: `apps/desktop/tests/main/price-service.test.ts`

**Interfaces:**
- Consumes: `PriceRepository.ensureListing`, `PriceRepository.applyCheck`, and `OfficialStoreDoll`.
- Produces: `PriceRepository.activateOfficialStoreListing(dollId, region, asin): AmazonListing` and current-price queries that yield at most one row per `(dollId, region)`.

- [ ] **Step 1: Write failing repository tests for duplicate regional listings**

```ts
it('returns only the canonical Store listing for a doll and region while retaining snapshots', () => {
  const old = prices.ensureListing({ dollId: doll.id, region: 'amazon_it', asin: 'B000OLD001', url: 'https://amazon.it/dp/B000OLD001', status: 'confirmed' });
  const official = prices.ensureListing({ dollId: doll.id, region: 'amazon_it', asin: 'B000STORE1', url: 'https://amazon.it/dp/B000STORE1', status: 'confirmed' });
  prices.applyCheck({ listingId: old.id, status: 'verified', checkedAt: '2026-07-11T10:00:00.000Z', offer: offer(3050, 'EUR') });
  prices.applyCheck({ listingId: official.id, status: 'verified', checkedAt: '2026-07-11T11:00:00.000Z', offer: offer(2953, 'EUR') });

  prices.activateOfficialStoreListing(doll.id, 'amazon_it', 'B000STORE1');

  expect(prices.current(doll.id)).toEqual([expect.objectContaining({ asin: 'B000STORE1', region: 'amazon_it', priceMinor: 2953 })]);
  expect(prices.history(doll.id, 'all')).toHaveLength(2);
});
```

- [ ] **Step 2: Run the targeted repository test and verify it fails**

Run: `npm.cmd test -- --run tests/main/prices-repository.test.ts`

Expected: FAIL because `activateOfficialStoreListing` does not exist.

- [ ] **Step 3: Add canonicalisation to the repository and Store persistence**

```ts
activateOfficialStoreListing(dollId: string, region: AmazonRegion, asin: string): AmazonListing {
  const listing = this.getByIdentity(dollId, region, asin);
  if (!listing) throw new Error('Official Store listing is missing');
  this.db.exec('BEGIN IMMEDIATE');
  try {
    this.db.prepare("update amazon_listings set status = 'frozen', updated_at = ? where doll_id = ? and region = ? and id <> ? and status = 'confirmed'")
      .run(new Date().toISOString(), dollId, region, listing.id);
    this.db.prepare("update amazon_listings set status = 'confirmed', confirmation_source = 'deterministic_match', updated_at = ? where id = ?")
      .run(new Date().toISOString(), listing.id);
    this.db.exec('COMMIT');
  } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  return this.getListing(listing.id)!;
}
```

Call `activateOfficialStoreListing(dollId, offer.region, offer.asin)` in `PriceService.persistOfficialStoreOffer` immediately after `ensureListing`, before `applyCheck`.

Change `current` and `currentForDolls` to rank confirmed rows by `s.checked_at desc, s.rowid desc` partitioned by `l.doll_id, l.region`, returning `row_number() = 1`. This prevents legacy data from rendering duplicates even before its next Store refresh.

- [ ] **Step 4: Run repository and service tests**

Run: `npm.cmd test -- --run tests/main/prices-repository.test.ts tests/main/price-service.test.ts`

Expected: PASS with the new duplicate-region test and existing tests.

- [ ] **Step 5: Commit the data-layer change**

```powershell
git add apps/desktop/src/main/prices/repository.ts apps/desktop/src/main/prices/service.ts apps/desktop/tests/main/prices-repository.test.ts apps/desktop/tests/main/price-service.test.ts
git commit -m "fix: keep one official Store price per region"
```

### Task 2: Replace generic catalog crawling with Store-only runs and safe errors

**Files:**
- Modify: `apps/desktop/src/main/catalog/scan-service.ts:1-118`
- Modify: `apps/desktop/src/collector/worker.ts:42-86`
- Modify: `apps/desktop/src/main/catalog/official-store-import-service.ts:18-48`
- Test: `apps/desktop/tests/main/catalog-scan-service.test.ts`
- Test: `apps/desktop/tests/main/official-store-import-service.test.ts`

**Interfaces:**
- Consumes: `OfficialStoreImportService.run(regions, onProgress)` and worker `CollectorOfficialStoreResult`.
- Produces: `CatalogScanService.runNow()` that only imports Store data and schedules its next Store-only run after manual start; region errors are short safe strings.

- [ ] **Step 1: Write failing Store-only scan tests**

```ts
it('does not call generic price refresh and schedules Store-only refresh after manual update', async () => {
  const refreshCatalogEntry = vi.fn();
  const officialStoreImport = { run: vi.fn(async () => ({ errors: [] })) };
  const schedule = vi.fn(() => 1 as unknown as ReturnType<typeof setTimeout>);
  const service = new CatalogScanService({ catalog, priceService: { refreshCatalogEntry }, officialStoreImport, schedule });

  await service.runNow({ includeOfficialStore: true });

  expect(officialStoreImport.run).toHaveBeenCalledWith(['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'], expect.any(Function));
  expect(refreshCatalogEntry).not.toHaveBeenCalled();
  expect(schedule).toHaveBeenCalledWith(expect.any(Function), 120 * 60 * 1000);
});

it('stores a safe Store error instead of Chromium output', async () => {
  const officialStoreImport = { run: vi.fn(async () => ({ errors: ['amazon_it: Store browser session ended'] })) };
  const service = new CatalogScanService({ catalog, priceService, officialStoreImport });
  await service.runNow({ includeOfficialStore: true });
  expect(service.getState().lastError).toBe('amazon_it: Store browser session ended');
});
```

- [ ] **Step 2: Run the scan-service tests and verify they fail**

Run: `npm.cmd test -- --run tests/main/catalog-scan-service.test.ts`

Expected: FAIL because `refreshCatalogEntry` still runs after Store import.

- [ ] **Step 3: Implement Store-only orchestration and error mapping**

Change `CatalogScanService.run` so that its only operation is `officialStoreImport.run(storeRegions, progress)`. Its manual run sets `phase: 'official_store'`; the normal scheduled callback also calls `runNow()`. Do not call `catalog.listActive()` or `priceService.refreshCatalogEntry()`.

Change `FavoritePriceTable` and `DollDetailPage` price-refresh mutations to call `window.vetka.catalog.refreshNow()` and invalidate their price/history queries after success. Remove the individual `window.vetka.amazon.refreshDoll` path and its CAPTCHA UI from these operational surfaces.

In `worker.ts`, use a closed-session matcher before storing a region error:

```ts
function safeStoreError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/Target page, context or browser has been closed|process did exit|browser.*closed/i.test(message)) return 'Store browser session ended';
  if (/captcha/i.test(message)) return 'Amazon requested CAPTCHA';
  if (/timeout|net::/i.test(message)) return 'Store temporarily unavailable';
  return 'Store import failed';
}
```

Use `safeStoreError(error)` for failed Store regions. In `OfficialStoreImportService`, turn the worker result into `${region}: ${safe text}` only; never concatenate raw worker data.

- [ ] **Step 4: Run Store import and scan tests**

Run: `npm.cmd test -- --run tests/main/catalog-scan-service.test.ts tests/main/official-store-import-service.test.ts`

Expected: PASS; no assertion contains `chrome.exe`, `--disable-`, profile path or raw error log.

- [ ] **Step 5: Commit the Store-only orchestration**

```powershell
git add apps/desktop/src/main/catalog/scan-service.ts apps/desktop/src/collector/worker.ts apps/desktop/src/main/catalog/official-store-import-service.ts apps/desktop/tests/main/catalog-scan-service.test.ts apps/desktop/tests/main/official-store-import-service.test.ts
git commit -m "feat: run catalog updates only through official Store"
```

### Task 3: Move update control from notification banner to Settings

**Files:**
- Modify: `apps/desktop/src/renderer/app.tsx`
- Modify: `apps/desktop/src/renderer/features/updates/update-notification.tsx`
- Modify: `apps/desktop/src/renderer/features/settings/settings-page.tsx`
- Test: `apps/desktop/tests/renderer/update-notification.test.tsx`
- Test: `apps/desktop/tests/renderer/settings-page.test.tsx`

**Interfaces:**
- Consumes: `window.vetka.health`, `window.vetka.updates.getState`, `window.vetka.updates.check`, `window.vetka.updates.restartAndInstall`, and existing `FormSection`.
- Produces: a Settings «Приложение» section; no mounted notification banner.

- [ ] **Step 1: Write failing renderer tests**

```tsx
it('does not mount the legacy update banner', () => {
  render(<App />);
  expect(screen.queryByText('Обновление готово')).not.toBeInTheDocument();
});

it('checks updates from Settings without restarting the app', async () => {
  const user = userEvent.setup();
  window.vetka.health = vi.fn(async () => ({ ok: true, data: { version: '1.0.16' } }));
  window.vetka.updates.check = vi.fn(async () => ({ ok: true, data: { status: 'checking' } }));
  renderPage();
  await user.click(await screen.findByRole('button', { name: 'Проверить обновления' }));
  expect(window.vetka.updates.check).toHaveBeenCalledTimes(1);
  expect(window.vetka.updates.restartAndInstall).not.toHaveBeenCalled();
  expect(screen.getByText('Vetka Desktop v1.0.16')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run renderer tests and verify they fail**

Run: `npm.cmd test -- --run tests/renderer/update-notification.test.tsx tests/renderer/settings-page.test.tsx`

Expected: FAIL because the root still renders `UpdateNotification` and Settings has no application section.

- [ ] **Step 3: Implement the compact Settings application section**

Remove `<UpdateNotification />` and its import from `app.tsx`; keep the component file only if no import remains, otherwise remove it with its test.

In `SettingsPage`, add a local update-state query/subscription. Render this existing-pattern section after delivery settings:

```tsx
<FormSection title="Приложение" description="Проверка и установка новых версий.">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="space-y-1">
      <p className="text-sm font-medium">{version ? `Vetka Desktop v${version}` : 'Vetka Desktop'}</p>
      <p className="text-xs text-muted-foreground">{updateCopy(update)}</p>
    </div>
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={update.status === 'checking'} onClick={() => void checkUpdates()}>
        <RefreshCwIcon className={update.status === 'checking' ? 'animate-spin' : ''} />Проверить обновления
      </Button>
      {update.status === 'downloaded' ? <Button type="button" size="sm" onClick={() => void restartAndInstall()}><RefreshCwIcon />Обновить</Button> : null}
    </div>
  </div>
</FormSection>
```

Use `useEffect` to load health/update state and subscribe with `window.vetka.updates.onStateChanged`. `updateCopy` returns static safe text for idle/checking/available/downloaded/error; do not show raw errors.

- [ ] **Step 4: Run renderer tests**

Run: `npm.cmd test -- --run tests/renderer/update-notification.test.tsx tests/renderer/settings-page.test.tsx tests/renderer/app-shell.test.tsx`

Expected: PASS; only the footer and Settings can expose update actions.

- [ ] **Step 5: Commit the update UI**

```powershell
git add apps/desktop/src/renderer/app.tsx apps/desktop/src/renderer/features/updates/update-notification.tsx apps/desktop/src/renderer/features/settings/settings-page.tsx apps/desktop/tests/renderer/update-notification.test.tsx apps/desktop/tests/renderer/settings-page.test.tsx
git commit -m "feat: check application updates from settings"
```

### Task 4: Verify UI, packaged runtime and release

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/package-lock.json`
- Verify: `apps/desktop/out/Vetka Desktop-win32-x64/resources/`

**Interfaces:**
- Consumes: completed data, worker and renderer tasks.
- Produces: a Windows release whose version is greater than `1.0.15` and whose Chromium resources are packaged.

- [ ] **Step 1: Bump the desktop version to `1.0.16`**

Set the root `version` in `apps/desktop/package.json` and the first two package version fields in `apps/desktop/package-lock.json` to `1.0.16`.

- [ ] **Step 2: Run complete automated validation**

Run: `npm.cmd test; npm.cmd run typecheck; npm.cmd run lint; npm.cmd run package`

Expected: all tests pass, TypeScript and ESLint exit 0, and Forge packages `Vetka Desktop-win32-x64`.

- [ ] **Step 3: Inspect packaged Chromium resources**

Run:

```powershell
Get-Item 'out\Vetka Desktop-win32-x64\resources\app.asar', 'out\Vetka Desktop-win32-x64\resources\playwright-chromium.json', 'out\Vetka Desktop-win32-x64\resources\playwright-chromium\chrome-win64\chrome.exe'
```

Expected: all three files exist; the manifest points to `chrome-win64/chrome.exe`.

- [ ] **Step 4: Perform desktop visual QA**

At 1080×720, 1280×800 and 1440×900 inspect: a long Store name is ellipsized; table rows contain one IT price; no update banner appears; Settings «Приложение» has bounded controls; expanded/collapsed sidebar version and update action remain usable.

- [ ] **Step 5: Commit, tag and publish**

```powershell
git add apps/desktop/package.json apps/desktop/package-lock.json
git commit -m "release: v1.0.16"
git tag -a v1.0.16 -m "Vetka Desktop v1.0.16"
git push origin main
git push origin v1.0.16
```

Confirm the GitHub Release workflow passes its package resource verification and release publication steps.

## Plan Self-review

- Store-only scanning, canonical per-region price, safe errors, update UI and release verification each have a dedicated task.
- All files, commands, tests and method signatures are specified; no placeholder actions remain.
- Later tasks refer only to methods defined in their own or earlier tasks: `activateOfficialStoreListing` is defined in Task 1; Store-only scan is Task 2; Settings IPC already exists.
