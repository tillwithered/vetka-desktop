# Official Monster High Store import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import high-confidence Monster High dolls and their visible New prices from official Amazon regional Store pages.

**Architecture:** A collector worker request fetches each official Store once, extracts canonical ASIN links, then opens product pages and emits only products with Monster High context, doll semantics, Mattel SKU and New price. `OfficialStoreImportService` imports the resulting SKU records into the existing catalog, persists their price snapshots, and exposes import progress through the current catalogue status channel.

**Tech Stack:** Electron utility process, Playwright Chromium, TypeScript, Vitest, SQLite.

## Global Constraints

- Regional Store URLs are the approved five URLs in `official-monster-high-store-import-design.md`.
- Store provenance proves the catalog product source; a product offer seller remains explicit and is not treated as Mattel.
- Auto-import only high-confidence dolls; never create catalog entries for accessories, outfits, replacements, furniture or vehicles.
- One Store page per region per manual import; normal scheduled refresh does not reload Store catalogues.
- Existing manual images and verified price history remain intact.

---

### Task 1: Store link and official-doll parsers

**Files:**
- Create: `apps/desktop/src/collector/amazon/store.ts`
- Test: `apps/desktop/tests/collector/amazon-store.test.ts`

**Interfaces:**
- Produces `parseAmazonStoreLinks(html, region): StoreLink[]` and `parseOfficialStoreDoll(page, region, url): OfficialStoreDoll | null`.

- [ ] **Step 1: Write failing parser tests**

```ts
expect(parseAmazonStoreLinks('<a href="/Monster-High-JHK59/dp/B0FK1V67X5">Robecca</a>', 'amazon_uk'))
  .toEqual([{ region: 'amazon_uk', asin: 'B0FK1V67X5', url: 'https://www.amazon.co.uk/dp/B0FK1V67X5' }]);
expect(parseOfficialStoreDoll(accessoryPage, 'amazon_uk', url)).toBeNull();
expect(parseOfficialStoreDoll(robeccaPage, 'amazon_uk', url)).toMatchObject({ mattelSku: 'JHK59', name: expect.stringContaining('Robecca'), price: { minor: 2499, currency: 'GBP' } });
```

- [ ] **Step 2: Run parser tests red**

Run: `npm.cmd test -- --run tests/collector/amazon-store.test.ts`

Expected: FAIL because Store parsers do not exist.

- [ ] **Step 3: Implement parsers**

Extract ASINs only from `a[href*="/dp/"]`, derive a region canonical URL, and deduplicate them. Reuse `parseAmazonProductPage()` for offer fields; require Monster High/Mattel title context, doll words (`doll`, `puppe`, `muñeca`, `bambola`) and a SKU matched from title by `/\b[A-Z]{2,4}\d{2,4}\b/`. Reject the existing non-doll vocabulary.

- [ ] **Step 4: Run parser tests green**

Run: `npm.cmd test -- --run tests/collector/amazon-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/desktop/src/collector/amazon/store.ts apps/desktop/tests/collector/amazon-store.test.ts
git commit -m "feat: parse official Monster High Store products"
```

### Task 2: Collector Store import request

**Files:**
- Modify: `apps/desktop/src/collector/contracts.ts`
- Modify: `apps/desktop/src/collector/worker.ts`
- Modify: `apps/desktop/src/main/collector/client.ts`
- Modify: `apps/desktop/src/collector/browser.ts`
- Test: `apps/desktop/tests/main/collector-client.test.ts`

**Interfaces:**
- Produces `CollectorClient.importOfficialStore({ dataDir, regions })` resolving `OfficialStoreImportResult` with products and per-region status.

- [ ] **Step 1: Write failing worker-client test**

```ts
await client.importOfficialStore({ dataDir: 'C:/data', regions: ['amazon_uk'] });
expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'import-official-store', regions: ['amazon_uk'] }));
```

- [ ] **Step 2: Run test red**

Run: `npm.cmd test -- --run tests/main/collector-client.test.ts`

Expected: FAIL because the client method and worker message type do not exist.

- [ ] **Step 3: Implement request and worker flow**

Add `BrowserCollectorDriver.openStore(region, url)`. The worker resolves the fixed regional URL map, opens each Store once, opens each unique product link, parses with Task 1, and returns products plus `blocked`/`completed` per region. Keep all browser operations serial.

- [ ] **Step 4: Run test green**

Run: `npm.cmd test -- --run tests/main/collector-client.test.ts tests/collector/amazon-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/desktop/src/collector apps/desktop/src/main/collector apps/desktop/tests/main/collector-client.test.ts
git commit -m "feat: collect official Monster High Store catalogues"
```

### Task 3: Import catalog and prices from official Store results

**Files:**
- Create: `apps/desktop/src/main/catalog/official-store-import-service.ts`
- Modify: `apps/desktop/src/main/catalog/repository.ts`
- Modify: `apps/desktop/src/main/prices/service.ts`
- Modify: `apps/desktop/src/main/catalog/scan-service.ts`
- Modify: `apps/desktop/src/main.ts`
- Test: `apps/desktop/tests/main/official-store-import-service.test.ts`

**Interfaces:**
- Produces `OfficialStoreImportService.runNow(): Promise<CatalogScanState>` and imports SKU products as `monitor_only` entries while persisting their initial confirmed Store price.

- [ ] **Step 1: Write failing service test**

```ts
const result = await service.runNow();
expect(catalog.listAll()).toContainEqual(expect.objectContaining({ mattelSku: 'JHK59', sourceUrl: 'https://www.amazon.co.uk/dp/B0FK1V67X5' }));
expect(prices.current(dollId)).toContainEqual(expect.objectContaining({ region: 'amazon_uk', priceMinor: 2499 }));
expect(result.processed).toBe(1);
```

- [ ] **Step 2: Run service test red**

Run: `npm.cmd test -- --run tests/main/official-store-import-service.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement service**

Convert each product into `CatalogSeedEntry` with `monitorStatus: 'monitor_only'`, `requiredTerms` from title words plus SKU, the product URL as source, and `evidence: 'Official Monster High Amazon Store'`. Call `CatalogRepository.importSeed()`, resolve its doll by SKU, then let a new `PriceService.persistOfficialStoreOffer()` create a deterministic confirmed regional listing and a verified price snapshot. Existing SKU records update; a manual doll image is kept because persistence uses `coalesce(image_path, imageUrl)`.

- [ ] **Step 4: Run service test green**

Run: `npm.cmd test -- --run tests/main/official-store-import-service.test.ts tests/main/catalog-repository.test.ts tests/main/price-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/desktop/src/main/catalog apps/desktop/src/main/prices apps/desktop/src/main.ts apps/desktop/tests/main/official-store-import-service.test.ts
git commit -m "feat: import official Store dolls and prices"
```

### Task 4: Manual import action, status and release

**Files:**
- Modify: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/shared/channels.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `apps/desktop/src/preload.ts`
- Modify: `apps/desktop/src/renderer/features/dolls/catalog-scan-status.tsx`
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/package-lock.json`
- Test: `apps/desktop/tests/renderer/catalog-scan-status.test.tsx`

**Interfaces:**
- Produces `catalog.importOfficialStore()` and visible import progress; version `1.0.12`.

- [ ] **Step 1: Write failing IPC/render test**

```tsx
render(<CatalogScanStatus state={{ status: 'running', phase: 'official_store', processed: 14, total: 38, region: 'amazon_uk' }} />);
expect(screen.getByText('Monster High Store UK: 14 из 38')).toBeInTheDocument();
```

- [ ] **Step 2: Run test red**

Run: `npm.cmd test -- --run tests/renderer/catalog-scan-status.test.tsx`

Expected: FAIL because import phase and IPC action do not exist.

- [ ] **Step 3: Implement the manual action**

Wire the existing «Обновить сейчас» button to `importOfficialStore()` first and then normal `runNow()`. Surface Store region/progress in the existing status card; do not change table or detail layouts. Bump package and lockfile version to `1.0.12`.

- [ ] **Step 4: Run complete verification**

Run: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`

Expected: all tests pass with no type or lint errors.

- [ ] **Step 5: Tag and push release**

```powershell
git add apps/desktop
git commit -m "release: v1.0.12"
git tag v1.0.12
git push origin main
git push origin v1.0.12
```
