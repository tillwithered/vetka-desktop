# Mattel catalog identity implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each operational doll card Russian-first while retaining official Mattel identity, URL and image provenance for reliable Amazon price matching.

**Architecture:** Add nullable source fields to local `dolls`, then let the curated catalog seed own the Russian display name, official English Mattel title and Mattel source data for known SKUs. The seed never replaces a manual image; it may replace an old Amazon-derived image with the authoritative Mattel image. The existing identity Card exposes the English title and Mattel link without creating a new page.

**Tech Stack:** Electron, SQLite migrations, TypeScript/Zod, Vitest, React and existing shadcn Card/Badge/Button/Separator primitives.

## Global constraints

- Only verified official Mattel product pages may populate an initial catalog record; a collection landing page is not a substitute when a product page exists.
- Include purchasable dolls and doll multipacks only; exclude books, minis, cars, playsets, styling heads, furniture and regional-language duplicates.
- `name` is the concise Russian operational label used in the table, order and page heading. `officialName` is the English Mattel product title kept for verification.
- `mattelUrl` and Mattel image URLs are saved directly; no Amazon image retrieval or Webshare bandwidth is used for catalog media.
- A manual image always wins. Existing Amazon-derived images may be upgraded to Mattel. Legacy records remain valid with nullable new fields.
- Keep the existing Maia/Violet identity Card and desktop layout. Do not add a new navigation item, UI library or mobile-specific composition.

---

### Task 1: Persist catalog identity and image provenance

**Files:**
- Create: `apps/desktop/src/main/db/migrations/0005_doll_catalog_identity.sql`
- Modify: `apps/desktop/src/main/db/migrate.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `apps/desktop/src/main/dolls/repository.ts`
- Test: `apps/desktop/tests/main/dolls-repository.test.ts`
- Test: `apps/desktop/tests/main/database.test.ts`

**Interfaces:**
- `Doll` gains `officialName: string | null`, `mattelUrl: string | null` and `imageSource: 'manual' | 'mattel' | 'amazon' | null`.
- `DollInput`/`DollUpdate` accept optional `officialName` and `mattelUrl`; user-initiated `imagePath` updates become `imageSource = 'manual'`.
- Migration 5 adds `official_name`, `mattel_url`, and `image_source` to `dolls`, classifies existing Amazon image URLs as `amazon`, and classifies other existing image paths as `manual`.

- [ ] **Step 1: Write failing repository/migration tests.**

```ts
it('persists official Mattel identity and marks a user supplied image as manual', () => {
  const doll = dolls.create({
    name: 'Робекка Стим — Boo-riginal Creeproduction',
    officialName: 'Monster High Boo-Riginal Creeproduction Robecca Steam Doll With Diary, Doll Stand And Pet',
    mattelUrl: 'https://shop.mattel.com/products/monster-high-boo-riginal-creeproduction-robecca-steam-doll-jhk59',
    imagePath: 'C:/Violetta/robecca.jpg',
  });
  expect(dolls.get(doll.id)).toMatchObject({ officialName: expect.stringContaining('Robecca Steam'), mattelUrl: expect.stringContaining('shop.mattel.com'), imageSource: 'manual' });
});
```

Add a migration assertion that a pre-migration `https://images-na.ssl-images-amazon.com/...` value becomes `amazon`, while `C:/photos/doll.jpg` becomes `manual`.

- [ ] **Step 2: Run focused tests and confirm they fail because migration 5 and the contract fields do not exist.**

Run: `npm.cmd --prefix apps/desktop test -- dolls-repository database`

Expected: FAIL with missing `officialName`, `mattelUrl`, `imageSource`, or migration expectations.

- [ ] **Step 3: Implement the nullable identity migration and repository mapping.**

```sql
ALTER TABLE dolls ADD COLUMN official_name TEXT;
ALTER TABLE dolls ADD COLUMN mattel_url TEXT;
ALTER TABLE dolls ADD COLUMN image_source TEXT CHECK (image_source IN ('manual', 'mattel', 'amazon'));
UPDATE dolls
SET image_source = CASE
  WHEN image_path LIKE '%amazon.%' OR image_path LIKE '%images-na.%' THEN 'amazon'
  WHEN image_path IS NOT NULL THEN 'manual'
  ELSE NULL
END
WHERE image_source IS NULL;
```

Use the existing Zod URL limits for `mattelUrl`, add columns to `mapDoll`, and only assign `imageSource: 'manual'` when a create/update contains a non-empty `imagePath` supplied by the user.

- [ ] **Step 4: Run focused tests and confirm they pass.**

Run: `npm.cmd --prefix apps/desktop test -- dolls-repository database`

Expected: PASS.

- [ ] **Step 5: Commit the persistence layer.**

```powershell
git add apps/desktop/src/main/db/migrations/0005_doll_catalog_identity.sql apps/desktop/src/main/db/migrate.ts apps/desktop/src/shared/contracts.ts apps/desktop/src/main/dolls/repository.ts apps/desktop/tests/main/dolls-repository.test.ts apps/desktop/tests/main/database.test.ts
git commit -m "feat: persist Mattel doll identity"
```

### Task 2: Make seed import source-aware and preserve manual images

**Files:**
- Modify: `apps/desktop/src/main/catalog/repository.ts`
- Modify: `apps/desktop/src/main/catalog/seed.ts`
- Test: `apps/desktop/tests/main/catalog-repository.test.ts`
- Test: `apps/desktop/tests/main/price-service.test.ts`

**Interfaces:**
- `CatalogSeedEntry` gains `officialName`, `mattelUrl`, and `mattelImageUrl`, all nullable for legacy/manual catalog rows.
- `CatalogRepository.importSeed()` updates the associated doll’s Russian display data and official source fields; it sets the Mattel image only when `image_source` is `NULL` or `amazon`.
- `PriceService` continues to add an Amazon image only when no image exists and records it as `amazon`.

- [ ] **Step 1: Write failing seed-import tests.**

```ts
it('upgrades an Amazon image to Mattel but preserves a manual image', () => {
  const seeded = { ...seed[0], officialName: 'Monster High Moonspell Magic Willow Thorne Doll', mattelUrl: 'https://shop.mattel.com/products/example', mattelImageUrl: 'https://cdn.shopify.com/example.jpg' };
  catalog.importSeed([seeded]);
  const doll = dolls.findByMattelSku('JMB92')!;
  expect(doll).toMatchObject({ name: 'Виллоу Торн — Moonspell Magic', officialName: seeded.officialName, imagePath: seeded.mattelImageUrl, imageSource: 'mattel' });

  dolls.update(doll.id, { imagePath: 'C:/manual/willow.jpg' });
  catalog.importSeed([{ ...seeded, mattelImageUrl: 'https://cdn.shopify.com/new.jpg' }]);
  expect(dolls.get(doll.id)).toMatchObject({ imagePath: 'C:/manual/willow.jpg', imageSource: 'manual' });
});
```

- [ ] **Step 2: Run focused seed tests and confirm they fail for unknown source fields.**

Run: `npm.cmd --prefix apps/desktop test -- catalog-repository price-service`

Expected: FAIL because `CatalogSeedEntry` and import do not yet know `officialName`, `mattelUrl`, `mattelImageUrl`, or image provenance.

- [ ] **Step 3: Implement seed validation and deterministic upsert policy.**

Use the product-specific Mattel URL as both `sourceUrl` and the doll’s `mattelUrl`. Update `DollRepository` through an internal catalog-only method or a narrowly scoped repository method so public user updates remain manual. The catalog method must execute:

```sql
UPDATE dolls
SET name = ?, character_name = ?, line_name = ?, official_name = ?, mattel_url = ?,
    image_path = CASE WHEN image_source IS NULL OR image_source = 'amazon' THEN ? ELSE image_path END,
    image_source = CASE WHEN image_source IS NULL OR image_source = 'amazon' THEN 'mattel' ELSE image_source END,
    updated_at = ?
WHERE id = ?;
```

- [ ] **Step 4: Curate the initial known-SKU seed from Mattel sources.**

For every retained seed SKU, record: concise Russian display name, exact English product title, source product URL, first Mattel CDN image, character, line and `sourceCheckedAt: '2026-07-12'`. Use current official pages such as the Catty Noir product page and the Creeproductions collection/product pages. Do not add a source record from a locale duplicate when an English US/CA page is available. Remove a seed row only when it is not a doll or doll multipack.

- [ ] **Step 5: Run focused tests and confirm they pass.**

Run: `npm.cmd --prefix apps/desktop test -- catalog-repository price-service`

Expected: PASS, including the existing Amazon thumbnail fallback test.

- [ ] **Step 6: Commit source-aware catalog import and seed.**

```powershell
git add apps/desktop/src/main/catalog/repository.ts apps/desktop/src/main/catalog/seed.ts apps/desktop/tests/main/catalog-repository.test.ts apps/desktop/tests/main/price-service.test.ts
git commit -m "feat: enrich dolls from Mattel catalog"
```

### Task 3: Show official Mattel identity in the existing doll profile

**Files:**
- Modify: `apps/desktop/src/renderer/features/dolls/doll-identity-profile.tsx`
- Test: `apps/desktop/tests/renderer/doll-identity-profile.test.tsx`

**UI decision:**
- **Surface type:** existing operational detail Card.
- **User job:** verify that the Russian-facing working card is the exact official doll before acting on an Amazon price.
- **Primary action:** unchanged (`Обновить цены`); Mattel is a compact source link, not a second primary action.
- **Existing pattern:** local `DollIdentityProfile` + `Card`, `Separator`, two-column fact grid.
- **Candidates inspected:** `Card`, `Badge`, `Button`, `Separator`, local `PageHeader`; selected local profile/Card composition because it already owns doll facts.
- **Desktop strategy:** preserves the existing 36px thumbnail, two-column facts and 24px page gap at 1080×720, 1280×800 and 1440×900. Long official titles wrap in a full-width fact, never force the Amazon regions Card wider.
- **States:** populated official source, legacy empty source (`—` and no link), manual image, Mattel image, and long English text. No new navigation or custom controls.

- [ ] **Step 1: Write failing profile tests.**

```tsx
it('shows a Russian working title, official English title and source link', () => {
  render(<DollIdentityProfile doll={{ ...doll, name: 'Кэтти Нуар — Core', officialName: 'Monster High Catty Noir Fashion Doll With Pet Cat Amulette And Accessories', mattelUrl: 'https://shop.mattel.com/products/monster-high-catty-noir-doll-hxh76' }} />);
  expect(screen.getByText('Официальное название')).toBeVisible();
  expect(screen.getByText(/Monster High Catty Noir Fashion Doll/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Открыть на Mattel' })).toHaveAttribute('href', expect.stringContaining('shop.mattel.com'));
});
```

- [ ] **Step 2: Run the renderer test and confirm it fails for missing official identity UI.**

Run: `npm.cmd --prefix apps/desktop test -- doll-identity-profile`

Expected: FAIL with missing label/link.

- [ ] **Step 3: Implement the smallest Card extension.**

Add one full-width `dt/dd` after the identity facts for `Официальное название` and a compact `Button asChild size="sm" variant="outline"` with `ExternalLinkIcon` only when `mattelUrl` is present. Use `target="_blank" rel="noreferrer"`; the existing Electron external-link handler remains the sole navigation integration.

- [ ] **Step 4: Run the renderer test and confirm it passes.**

Run: `npm.cmd --prefix apps/desktop test -- doll-identity-profile`

Expected: PASS.

- [ ] **Step 5: Commit the detail UI.**

```powershell
git add apps/desktop/src/renderer/features/dolls/doll-identity-profile.tsx apps/desktop/tests/renderer/doll-identity-profile.test.tsx
git commit -m "feat: show official Mattel doll identity"
```

### Task 4: Full verification and release

**Files:**
- Modify: `apps/desktop/package.json` for the next patch release only after tests are green.

- [ ] **Step 1: Run all tests, lint and typecheck.**

Run: `npm.cmd --prefix apps/desktop test; npm.cmd --prefix apps/desktop run lint; npm.cmd --prefix apps/desktop run typecheck`

Expected: complete suite passes with no lint or type errors.

- [ ] **Step 2: Run Electron visual QA.**

Open a seeded doll at 1080×720, 1280×800 and 1440×900. Verify expanded/collapsed sidebar, long English official title, absent legacy source, manual/Mattel thumbnails, no overflow into Amazon regions, and working external Mattel link.

- [ ] **Step 3: Package and validate the Windows app.**

Run: `npm.cmd --prefix apps/desktop run package; $env:GITHUB_REF_NAME='v1.0.25'; npm.cmd --prefix apps/desktop run release:verify-version`

Expected: package succeeds, embedded Chromium manifest/executable exists and release version matches tag.

- [ ] **Step 4: Commit, push and publish the next tagged release.**

```powershell
git add apps/desktop/package.json
git commit -m "chore: release v1.0.25"
git push origin main
git tag v1.0.25
git push origin v1.0.25
```

Use the GitHub workflow results to confirm `RELEASES`, `SHA256SUMS.txt`, `VetkaDesktopSetup.exe` and `vetka_desktop-1.0.25-full.nupkg` before reporting availability.
