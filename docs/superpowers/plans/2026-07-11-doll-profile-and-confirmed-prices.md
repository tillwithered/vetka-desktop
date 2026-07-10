# Doll profile and confirmed prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make deterministic catalog matches visible as current prices and add a compact identity profile to each doll page.

**Architecture:** `PriceService` distinguishes catalog fact-triangle matches from generic review candidates when it creates a listing. A focused renderer composition receives the existing `Doll` object and leaves price data in `RegionalOfferList`; the history chart simply moves below the top grid.

**Tech Stack:** Electron, React, TanStack Query, shadcn/ui, Tailwind, node:sqlite, Vitest.

## Global Constraints

- Keep Amazon regions as the primary current-price surface.
- Use Maia/Violet semantic tokens and existing shadcn primitives only.
- Preserve manual image priority and generic candidate review flow.
- Run focused tests first, then full test, typecheck, lint, package, and desktop visual QA.

---

### Task 1: Confirm deterministic catalog listings

**Files:**
- Modify: `apps/desktop/src/main/prices/service.ts`
- Modify: `apps/desktop/tests/main/price-service.test.ts`

**Interfaces:**
- Consumes: `catalogRules` passed to `PriceService.refresh()` for a fact-triangle catalog scan.
- Produces: `amazon_listings.status = 'confirmed'` and `confirmation_source = 'deterministic_match'` for a verified catalog result.

- [ ] **Step 1: Write the failing test**

```ts
await service.refreshCatalogEntry(entry, ['amazon_us']);
expect(prices.getByIdentity(doll.id, 'amazon_us', 'B0CXYZ1234')).toMatchObject({
  status: 'confirmed',
  confirmationSource: 'deterministic_match',
});
expect(prices.current(doll.id)).toHaveLength(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run tests/main/price-service.test.ts`

Expected: the listing is `candidate` or current prices are empty.

- [ ] **Step 3: Write minimal implementation**

```ts
const listing = this.dependencies.prices.getByIdentity(dollId, resultRegion, regionResult.asin)
  ?? this.dependencies.prices.ensureListing({
    dollId,
    region: resultRegion,
    asin: regionResult.asin,
    url: regionResult.url,
    ...(catalogRules ? { status: 'confirmed', confirmationSource: 'deterministic_match' } : {}),
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --run tests/main/price-service.test.ts`

Expected: PASS.

### Task 2: Add doll identity profile composition

**Files:**
- Create: `apps/desktop/src/renderer/features/dolls/doll-identity-profile.tsx`
- Modify: `apps/desktop/src/renderer/features/dolls/doll-detail-page.tsx`
- Modify: `apps/desktop/tests/renderer/doll-detail.test.tsx`

**Interfaces:**
- Consumes: `Doll` from the existing doll query.
- Produces: `DollIdentityProfile({ doll })` with image, placeholder, series, character, generation, SKU, and UPC/EAN.

- [ ] **Step 1: Write the failing test**

```tsx
render(<DollDetailPage />);
expect(await screen.findByText('О кукле')).toBeInTheDocument();
expect(screen.getByText('Mattel SKU')).toBeInTheDocument();
expect(screen.getByText('HRP64')).toBeInTheDocument();
expect(screen.getByRole('img', { name: /Draculaura/i })).toBeInTheDocument();
expect(screen.getByText('Регионы Amazon')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run tests/renderer/doll-detail.test.tsx`

Expected: `О кукле` is absent.

- [ ] **Step 3: Write minimal implementation**

```tsx
<div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,1fr)]">
  <DollIdentityProfile doll={doll.data} />
  <Card>{/* existing RegionalOfferList unchanged */}</Card>
</div>
<ChartCard>{/* existing PriceHistoryChart */}</ChartCard>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --run tests/renderer/doll-detail.test.tsx`

Expected: PASS.

### Task 3: Verify release quality

**Files:**
- No source changes.

- [ ] **Step 1: Run the complete suite**

Run: `npm.cmd test && npm.cmd run typecheck && npm.cmd run lint && npm.cmd run package`

Expected: all commands exit 0.

- [ ] **Step 2: Verify packaged runtime**

Run:

```powershell
$manifest = Get-ChildItem out -Recurse -Filter playwright-chromium.json | Select-Object -First 1
$runtime = Get-Content $manifest.FullName -Raw | ConvertFrom-Json
Test-Path (Join-Path (Join-Path $manifest.Directory.FullName playwright-chromium) $runtime.executable)
```

Expected: `True`.
