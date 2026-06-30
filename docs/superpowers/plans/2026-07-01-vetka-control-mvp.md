# Vetka Control MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить закрытую внутреннюю систему Vetka Control для ведения каталога Monster High, ручных источников, цен, лотов и расчётов себестоимости.

**Architecture:** Next.js App Router использует Supabase SSR для сессий, Server Components для чтения и Server Actions для мутаций. Postgres хранит нормализованные сущности вокруг Product, Storage — фотографии, а RLS разрешает работу только авторизованным пользователям. Интерфейс строится на shadcn/ui preset `b1FjPsUBU`.

**Tech Stack:** Next.js, TypeScript, React, shadcn/ui, Tailwind CSS, Supabase Auth/Postgres/Storage, Zod, Vitest, Testing Library.

---

## Карта файлов

- `app/(auth)/login/page.tsx` — закрытый вход.
- `app/(control)/layout.tsx` — защищённый layout с sidebar.
- `app/(control)/page.tsx` — Dashboard.
- `app/(control)/products/**` — каталог, создание, редактирование и карточка товара.
- `app/(control)/lots/page.tsx` — общий список лотов.
- `app/(control)/calculator/page.tsx` — отдельный калькулятор.
- `components/app-sidebar.tsx` и `components/page-header.tsx` — общая оболочка.
- `components/products/**` — сфокусированные UI-блоки товара.
- `lib/supabase/**` — browser/server clients и middleware session refresh.
- `lib/products/**` — типы, схемы, запросы и actions каталога.
- `lib/calculations/**` — чистые формулы и валидация расчёта.
- `supabase/migrations/0001_vetka_control.sql` — схема, индексы, RLS и Storage policies.
- `tests/**` — unit и component tests.

### Task 1: Scaffold Next.js and shadcn/ui

**Files:**
- Create: `package.json`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `components.json`
- Create: `.env.example`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Initialize the requested preset**

Run:

```powershell
pnpm dlx shadcn@latest init --preset b1FjPsUBU --template next
```

Expected: a Next.js project with `components.json`, Tailwind styles, and shadcn dependencies.

- [ ] **Step 2: Add the required shadcn components**

Run:

```powershell
pnpm dlx shadcn@latest add alert alert-dialog avatar badge breadcrumb button card checkbox command dialog dropdown-menu field input label popover select separator sheet sidebar skeleton sonner table tabs textarea
```

Expected: component files appear under `components/ui/`.

- [ ] **Step 3: Install runtime and test dependencies**

Run:

```powershell
pnpm add @supabase/ssr @supabase/supabase-js zod lucide-react
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Expected: dependencies are recorded in `package.json`.

- [ ] **Step 4: Configure environment and Vitest**

Create `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Configure `vitest.config.ts` with the React plugin, jsdom, `@/` alias, and `tests/setup.ts`; import `@testing-library/jest-dom/vitest` from setup.

- [ ] **Step 5: Verify and commit**

Run: `pnpm lint && pnpm build`

Expected: both commands exit 0.

Commit: `chore: scaffold Next.js and shadcn app`

### Task 2: Create the Supabase schema and clients

**Files:**
- Create: `supabase/migrations/0001_vetka_control.sql`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`
- Create: `lib/database.types.ts`

- [ ] **Step 1: Write schema contract tests**

Create `tests/schema/migration.test.ts` that reads the migration and asserts it contains all seven tables, `enable row level security`, authenticated policies, the `product-images` bucket, Storage policies, product search indexes, and update timestamp triggers.

- [ ] **Step 2: Run the schema test and confirm failure**

Run: `pnpm vitest run tests/schema/migration.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the SQL migration**

Define enums for product status, condition, rarity, source type, lot status, and currency. Create `products`, `product_images`, `product_sources`, `product_prices`, `lots`, `shipping_profiles`, and `product_calculations` with UUID keys, numeric money/weight fields, foreign keys with cascade deletion, indexes for filtering, and `updated_at` triggers.

Create RLS policies using:

```sql
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated')
```

Insert the private `product-images` bucket and allow authenticated select/insert/update/delete on `storage.objects` where `bucket_id = 'product-images'`.

- [ ] **Step 4: Implement Supabase SSR clients**

`lib/supabase/client.ts` exports `createBrowserClient`; `lib/supabase/server.ts` exports an async cookie-aware server client; `lib/supabase/middleware.ts` refreshes the auth session. Root `middleware.ts` excludes static assets and image optimizer routes.

- [ ] **Step 5: Generate or maintain database types**

Represent tables, inserts, updates, and enums in `lib/database.types.ts`; Supabase clients use `Database` as their generic type.

- [ ] **Step 6: Verify and commit**

Run: `pnpm vitest run tests/schema/migration.test.ts && pnpm typecheck`

Expected: PASS and exit 0.

Commit: `feat: add Supabase schema and clients`

### Task 3: Implement protected authentication and app shell

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/actions.ts`
- Create: `app/(control)/layout.tsx`
- Create: `components/app-sidebar.tsx`
- Create: `components/page-header.tsx`
- Create: `components/logout-button.tsx`
- Create: `tests/auth/login-actions.test.ts`

- [ ] **Step 1: Write failing auth action tests**

Test that missing/invalid credentials return field-safe errors, Supabase login failure returns a Russian message, success redirects to `/`, and logout redirects to `/login`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run tests/auth/login-actions.test.ts`

Expected: FAIL because auth actions are missing.

- [ ] **Step 3: Implement login and logout actions**

Validate email/password with Zod, call `signInWithPassword`, return `{ error }` for expected failures, and use `redirect` only on success. Do not add sign-up.

- [ ] **Step 4: Build the login and protected shell**

Build the login screen from Card, Field, Input, Button, Alert, and Sonner. In the protected layout call `auth.getUser()` and redirect anonymous requests. Use shadcn Sidebar with links for Dashboard, Catalog, Lots, and Calculator.

- [ ] **Step 5: Verify and commit**

Run: `pnpm vitest run tests/auth/login-actions.test.ts && pnpm lint && pnpm build`

Expected: all commands exit 0.

Commit: `feat: add closed authentication and app shell`

### Task 4: Implement calculation domain and calculator page

**Files:**
- Create: `lib/calculations/schema.ts`
- Create: `lib/calculations/calculate.ts`
- Create: `components/calculator/cost-calculator.tsx`
- Create: `app/(control)/calculator/page.tsx`
- Create: `tests/calculations/calculate.test.ts`

- [ ] **Step 1: Write failing formula tests**

Cover calculated international shipping, manually overridden shipping, total cost, profit, profit percentage, decimal rounding, and zero-cost behavior.

Example assertion:

```ts
expect(calculateCost({
  buyPriceUsd: 40,
  localShippingUsd: 5,
  weightKg: 1.2,
  pricePerKgUsd: 12,
  usdToKztRate: 520,
  extraCostsKzt: 1000,
  salePriceKzt: 40000,
})).toEqual({
  internationalShippingUsd: 14.4,
  totalCostKzt: 31888,
  profitKzt: 8112,
  profitPercent: 25.44,
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run tests/calculations/calculate.test.ts`

Expected: FAIL because `calculateCost` is missing.

- [ ] **Step 3: Implement validation and pure formulas**

Use Zod coercion for non-negative numeric inputs. Round USD/KZT output deterministically and return `profitPercent: null` when total cost is zero.

- [ ] **Step 4: Build the calculator**

Use shadcn Card, Field, Input, Select, Separator, and Badge. Recalculate instantly in the client and show себестоимость, международную доставку, прибыль, and margin. The standalone page does not save a product calculation.

- [ ] **Step 5: Verify and commit**

Run: `pnpm vitest run tests/calculations/calculate.test.ts && pnpm lint`

Expected: PASS.

Commit: `feat: add cost and profit calculator`

### Task 5: Implement product queries, actions, image upload, and forms

**Files:**
- Create: `lib/products/schema.ts`
- Create: `lib/products/queries.ts`
- Create: `lib/products/actions.ts`
- Create: `lib/products/images.ts`
- Create: `components/products/product-form.tsx`
- Create: `components/products/image-uploader.tsx`
- Create: `app/(control)/products/new/page.tsx`
- Create: `app/(control)/products/[id]/edit/page.tsx`
- Create: `tests/products/schema.test.ts`
- Create: `tests/products/actions.test.ts`

- [ ] **Step 1: Write failing product validation tests**

Assert required name, character, line, main image, and positive default weight; validate year range, dimensions, allowed enum values, and optional text fields.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run tests/products/schema.test.ts tests/products/actions.test.ts`

Expected: FAIL because product modules are missing.

- [ ] **Step 3: Implement schemas and testable actions**

Create `productSchema`, `createProduct`, `updateProduct`, and `deleteProduct`. Inject or wrap the Supabase client so tests can assert database calls. Return structured field errors, revalidate relevant routes, and redirect to `/products/{id}` after creation.

- [ ] **Step 4: Implement safe image handling**

Accept JPEG, PNG, and WebP up to 8 MB. Upload to `product-images/{productId}/{uuid}.{ext}` and store paths, not public URLs. Generate signed URLs for display. If product creation fails after upload, delete the uploaded object.

- [ ] **Step 5: Build create/edit forms**

Use shadcn Field, Input, Select, Textarea, Card, Tabs, Button, Alert, and Dialog. Organize fields into “Основное”, “Размеры и вес”, and “Описание”. Editing loads existing values; destructive deletion uses AlertDialog.

- [ ] **Step 6: Verify and commit**

Run: `pnpm vitest run tests/products && pnpm lint && pnpm build`

Expected: PASS.

Commit: `feat: add product creation editing and images`

### Task 6: Implement catalog search and filters

**Files:**
- Create: `app/(control)/products/page.tsx`
- Create: `components/products/product-grid.tsx`
- Create: `components/products/product-card.tsx`
- Create: `components/products/catalog-filters.tsx`
- Create: `components/products/catalog-empty-state.tsx`
- Create: `tests/products/catalog-query.test.ts`

- [ ] **Step 1: Write failing catalog query tests**

Test text search over name/character/line/keywords, each enum filter, `has_price`, `has_lots`, pagination ordering, and safe handling of unknown URL parameters.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run tests/products/catalog-query.test.ts`

Expected: FAIL because the catalog query is missing.

- [ ] **Step 3: Implement catalog query**

Parse `searchParams` with Zod, apply filters server-side, include the latest price, latest calculation, lot existence, and signed main image URL. Default sort is `updated_at desc`.

- [ ] **Step 4: Build catalog UI**

Use Input/Command for search, Select/Popover/Checkbox for filters, and responsive Card grid. Each card shows image, identity, badges, latest purchase price, recommended sale price, profit, and status. Empty state links to product creation.

- [ ] **Step 5: Verify and commit**

Run: `pnpm vitest run tests/products/catalog-query.test.ts && pnpm lint && pnpm build`

Expected: PASS.

Commit: `feat: add searchable product catalog`

### Task 7: Implement product details and related records

**Files:**
- Create: `app/(control)/products/[id]/page.tsx`
- Create: `app/(control)/products/[id]/not-found.tsx`
- Create: `components/products/product-overview.tsx`
- Create: `components/products/product-gallery.tsx`
- Create: `components/products/source-list.tsx`
- Create: `components/products/price-history.tsx`
- Create: `components/products/lot-list.tsx`
- Create: `components/products/calculation-panel.tsx`
- Create: `lib/products/related-actions.ts`
- Create: `tests/products/related-actions.test.ts`

- [ ] **Step 1: Write failing related-action tests**

Cover authenticated create/update/delete for sources, prices, lots, gallery images, and calculations; reject invalid URLs, negative prices, unsupported currencies/statuses, and records for missing products.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run tests/products/related-actions.test.ts`

Expected: FAIL because related actions are missing.

- [ ] **Step 3: Implement related actions**

Create one focused Zod schema and action set per related entity. Recalculate saved financial outputs server-side instead of trusting client totals. Revalidate the product, catalog, lots, and dashboard routes as appropriate.

- [ ] **Step 4: Build the product detail route**

Load product and all relations in parallel. Use a top Card for photo and identity, Tabs for “Обзор”, “Цены”, “Лоты”, and “Расчёт”, and Dialog/Sheet forms for one-click additions. Show dimensions and weights with units; format dates and currencies consistently.

- [ ] **Step 5: Handle missing and error states**

Call `notFound()` for an unknown UUID. Each empty relation block includes its add action. External links use `target="_blank" rel="noreferrer noopener"`.

- [ ] **Step 6: Verify and commit**

Run: `pnpm vitest run tests/products/related-actions.test.ts && pnpm lint && pnpm build`

Expected: PASS.

Commit: `feat: add complete product workspace`

### Task 8: Implement Dashboard and global lot list

**Files:**
- Create: `lib/dashboard/queries.ts`
- Create: `app/(control)/page.tsx`
- Create: `app/(control)/lots/page.tsx`
- Create: `components/dashboard/stat-card.tsx`
- Create: `components/dashboard/recent-products.tsx`
- Create: `components/dashboard/recent-prices.tsx`
- Create: `components/lots/lot-filters.tsx`
- Create: `components/lots/lot-table.tsx`
- Create: `tests/dashboard/queries.test.ts`
- Create: `tests/lots/query.test.ts`

- [ ] **Step 1: Write failing aggregate query tests**

Verify product total, `looking` total, `good_price_found` total, latest products, latest prices, and lot filtering by marketplace/status/staleness.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run tests/dashboard tests/lots`

Expected: FAIL because aggregate queries are missing.

- [ ] **Step 3: Implement dashboard and lot queries**

Use count-only Supabase queries for stats, limited ordered queries for recent activity, and URL-param validation for lot filters. Define stale lots as `checked_at` older than 14 days.

- [ ] **Step 4: Build Dashboard**

Use Card stats, recent product cards, recent price Table, Skeletons, and CTA buttons. Keep the main “Добавить куклу” action visible above the fold.

- [ ] **Step 5: Build global lot list**

Use responsive Table/Card treatment with product image, product link, marketplace, price plus shipping, condition, status badge, checked date, and external listing action.

- [ ] **Step 6: Verify and commit**

Run: `pnpm vitest run tests/dashboard tests/lots && pnpm lint && pnpm build`

Expected: PASS.

Commit: `feat: add dashboard and global lots`

### Task 9: Add loading, error, and responsive states

**Files:**
- Create: `app/(control)/loading.tsx`
- Create: `app/(control)/error.tsx`
- Create: `app/(control)/products/loading.tsx`
- Create: `app/(control)/products/[id]/loading.tsx`
- Modify: `components/**/*.tsx`
- Create: `tests/ui/smoke.test.tsx`

- [ ] **Step 1: Write failing smoke tests**

Render page headers, empty states, form errors, cards without images, and calculator zero values; assert accessible names and no runtime errors.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm vitest run tests/ui/smoke.test.tsx`

Expected: FAIL until states are implemented.

- [ ] **Step 3: Add states using shadcn components**

Use Skeleton for loading, Alert for errors, Card for empty states, and Sonner for success notifications. Ensure dialogs are keyboard navigable and all form controls have labels and descriptions.

- [ ] **Step 4: Verify responsive behavior**

At 375 px, forms stack, cards use one column, tables expose a compact card fallback, and the sidebar becomes a Sheet. At 1440 px, catalog uses at least three columns and details avoid excessively wide text.

- [ ] **Step 5: Verify and commit**

Run: `pnpm vitest run tests/ui/smoke.test.tsx && pnpm lint && pnpm build`

Expected: PASS.

Commit: `fix: complete loading error and responsive states`

### Task 10: Final requirement audit and operator documentation

**Files:**
- Create: `README.md`
- Create: `docs/setup-supabase.md`
- Create: `tests/requirements.test.ts`

- [ ] **Step 1: Write a requirement-level smoke test**

Assert route modules exist for login, dashboard, catalog, create/edit/details, lots, and calculator; assert migration includes every required table and Storage policy; assert excluded terms such as Telegram parser routes are absent.

- [ ] **Step 2: Document setup**

Document creating a Supabase project, running the migration, setting the two environment variables, creating the first Auth user in Supabase Dashboard, installing dependencies, and running dev/test/build commands. Do not include real credentials.

- [ ] **Step 3: Run the complete verification suite**

Run:

```powershell
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: every command exits 0.

- [ ] **Step 4: Manually verify the core workflow**

With a configured Supabase project: log in; create a product with photo; add source, price, lot, and calculation; find it through catalog search; confirm Dashboard and Lots update; edit the product; confirm anonymous access redirects to login.

- [ ] **Step 5: Commit**

Commit: `docs: add setup guide and complete MVP audit`

## Self-review result

The plan covers Supabase Auth, Postgres, Storage, Dashboard, catalog, product CRUD/details, manual sources/prices/lots, cost/profit calculations, search/filters, RLS, error states, responsive behavior, tests, and setup. It explicitly excludes orders, CRM, Telegram, parsers, Amazon automation, AI generation, and complex roles. No implementation placeholders remain.
