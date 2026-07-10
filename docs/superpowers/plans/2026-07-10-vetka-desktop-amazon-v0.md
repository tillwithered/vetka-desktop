# Vetka Desktop Amazon V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать устанавливаемое Windows-приложение, которое офлайн хранит рабочий список кукол, корректно проверяет новые предложения Amazon US/UK/DE/ES/IT, сохраняет историю цен и формирует заказы с расчётом себестоимости.

**Architecture:** Новый Electron-проект живёт в `apps/desktop`. Renderer содержит React/shadcn-интерфейс, main process владеет SQLite и IPC, а отдельный collector worker управляет постоянными браузерными профилями и возвращает только типизированные результаты. Подтверждённые снимки цен и неудачные проверки хранятся раздельно; заказ копирует использованное предложение и расчёт.

**Tech Stack:** Electron 43, Electron Forge, Vite, React, TypeScript, Node `node:sqlite`, Playwright Core, Zod, shadcn/ui, Tailwind CSS, TanStack Query, React Hook Form, Recharts 3, Vitest, Testing Library, Playwright Test.

## Global Constraints

- Target platform for V0: Windows 10/11 x64.
- V0 works on one device and has no synchronization, server database, authentication, public website, CRM, eBay, Mattel, inventory, or automatic purchasing.
- Supported Amazon regions are exactly `amazon_us`, `amazon_uk`, `amazon_de`, `amazon_es`, and `amazon_it`.
- Only condition `New` can become a verified current offer.
- A failed, blocked, conflicting, or ambiguous check never replaces the last verified price.
- A price is fresh for 60 minutes and stale after 24 hours.
- Money is stored as integer minor units; exchange rates are stored as integer micros.
- Every order stores an immutable copy of the selected offer and calculation inputs.
- The renderer runs with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
- All interactive and visual primitives come from shadcn/ui; custom components only compose shadcn primitives and ordinary layout containers.
- Before editing UI, run `pnpm dlx shadcn@latest info --json` and use `pnpm dlx shadcn@latest docs <component>` or the shadcn MCP for the exact installed API.
- Russian copy is concise and operational. No public marketing copy is added.
- Follow TDD: failing focused test, minimal implementation, passing focused test, then broader verification.

---

## File Structure

```text
apps/desktop/
├── forge.config.ts                    # Electron packaging and Vite entries
├── vite.main.config.ts                # main-process bundle
├── vite.preload.config.ts             # preload bundle
├── vite.renderer.config.ts            # React renderer bundle
├── src/
│   ├── main.ts                         # Electron lifecycle and secure window
│   ├── preload.ts                      # typed contextBridge API
│   ├── shared/
│   │   ├── contracts.ts                # domain and IPC contracts
│   │   ├── channels.ts                 # IPC channel constants
│   │   └── money.ts                    # minor-unit helpers
│   ├── main/
│   │   ├── ipc/register-ipc.ts         # validated IPC handlers
│   │   ├── db/database.ts              # node:sqlite connection
│   │   ├── db/migrate.ts               # ordered migrations
│   │   ├── db/backup.ts                # rotating local backups
│   │   ├── db/migrations/0001_v0.sql   # complete V0 schema
│   │   ├── dolls/repository.ts          # doll CRUD
│   │   ├── prices/repository.ts         # listings/checks/snapshots/history
│   │   ├── orders/repository.ts         # immutable order snapshots and status events
│   │   ├── settings/repository.ts       # local settings and cached rates
│   │   └── collector/client.ts          # utilityProcess lifecycle and messages
│   ├── collector/
│   │   ├── worker.ts                    # worker entry point
│   │   ├── contracts.ts                 # worker message envelopes
│   │   ├── browser.ts                   # persistent regional contexts
│   │   ├── queue.ts                     # serial in-memory queue
│   │   └── amazon/
│   │       ├── regions.ts               # region domains/locales/currencies
│   │       ├── url.ts                   # URL and ASIN normalization
│   │       ├── search.ts                # search term and candidate extraction
│   │       ├── matching.ts              # deterministic identity matching
│   │       ├── money.ts                 # localized money parsing
│   │       ├── product-page.ts          # offer extraction and validation
│   │       └── collect.ts               # discover/verify orchestration
│   ├── domain/
│   │   ├── calculations.ts              # cost/profit formulas
│   │   ├── freshness.ts                 # fresh/aging/stale labels
│   │   └── price-history.ts              # chart aggregation
│   └── renderer/
│       ├── index.tsx                    # React root and query provider
│       ├── app.tsx                      # routes and shell
│       ├── components/app-sidebar.tsx   # shadcn Sidebar composition
│       ├── features/home/               # chosen workbench layout
│       ├── features/dolls/              # list, manual add, detail, review
│       ├── features/prices/             # region rows and shadcn charts
│       ├── features/orders/             # create/list/detail/status
│       └── features/settings/           # profiles, rates, delivery defaults
├── tests/
│   ├── fixtures/amazon/                 # sanitized five-region HTML fixtures
│   ├── main/                            # database and IPC tests
│   ├── collector/                       # URL/matching/parser/queue tests
│   ├── domain/                          # formulas/freshness/history tests
│   └── renderer/                        # shadcn UI component tests
└── e2e/desktop.spec.ts                  # packaged desktop smoke
```

### Task 1: Scaffold the secure Electron and shadcn application shell

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `apps/desktop/**` through the official Electron Forge Vite TypeScript template
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/forge.config.ts`
- Modify: `apps/desktop/src/main.ts`
- Create: `apps/desktop/src/preload.ts`
- Create: `apps/desktop/src/shared/channels.ts`
- Create: `apps/desktop/src/shared/contracts.ts`
- Create: `apps/desktop/src/renderer/index.tsx`
- Create: `apps/desktop/src/renderer/app.tsx`
- Test: `apps/desktop/tests/main/security.test.ts`
- Test: `apps/desktop/tests/renderer/app-shell.test.tsx`

**Interfaces:**
- Produces: `window.vetka: VetkaDesktopApi` and a running secure Electron window.
- Produces: root renderer with `QueryClientProvider`, shadcn `SidebarProvider`, and React Router.

- [ ] **Step 1: Scaffold the official Vite TypeScript template and workspace**

Run from the repository root:

```powershell
pnpm dlx create-electron-app@latest apps/desktop --template=vite-typescript
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
```

Expected: `apps/desktop` contains Electron Forge main, preload, renderer, and Vite configuration.

- [ ] **Step 2: Install runtime and test dependencies**

Run:

```powershell
pnpm --dir apps/desktop add react react-dom react-router-dom zod @tanstack/react-query react-hook-form @hookform/resolvers date-fns lucide-react playwright-core cheerio
pnpm --dir apps/desktop add -D electron@43.1.0 typescript eslint prettier vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test tsup
pnpm --dir apps/desktop dlx shadcn@latest init -d --base radix
pnpm --dir apps/desktop dlx shadcn@latest add alert alert-dialog badge button card chart command dialog empty field input input-group label select separator sheet sidebar skeleton sonner table tabs textarea tooltip
```

Expected: `components.json`, Tailwind styles, shadcn sources, Recharts 3, and test dependencies are installed.

- [ ] **Step 3: Write failing security and shell tests**

Create `tests/main/security.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { secureWebPreferences } from "../../src/main"

describe("secureWebPreferences", () => {
  it("isolates the renderer from Node", () => {
    expect(secureWebPreferences).toMatchObject({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    })
  })
})
```

Create `tests/renderer/app-shell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "../../src/renderer/app"

describe("App", () => {
  it("renders the four V0 destinations", () => {
    render(<App />)
    expect(screen.getByText("Избранное")).toBeInTheDocument()
    expect(screen.getByText("Куклы")).toBeInTheDocument()
    expect(screen.getByText("Заказы")).toBeInTheDocument()
    expect(screen.getByText("Настройки")).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run the focused tests and confirm failure**

Run:

```powershell
pnpm --dir apps/desktop vitest run tests/main/security.test.ts tests/renderer/app-shell.test.tsx
```

Expected: FAIL because `secureWebPreferences` and `App` do not exist at the expected paths.

- [ ] **Step 5: Implement the secure window, preload contract, and shadcn shell**

Add to `src/main.ts`:

```ts
import path from "node:path"
import { app, BrowserWindow } from "electron"

export const secureWebPreferences = {
  preload: path.join(__dirname, "preload.js"),
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
} as const

export function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    backgroundColor: "#09090b",
    webPreferences: secureWebPreferences,
  })
  window.once("ready-to-show", () => window.show())
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
  return window
}

app.whenReady().then(createWindow)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
```

Create `src/shared/contracts.ts`:

```ts
export type VetkaDesktopApi = {
  health(): Promise<{ ok: true; version: string }>
}

declare global {
  interface Window {
    vetka: VetkaDesktopApi
  }
}
```

Create `src/shared/channels.ts`:

```ts
export const channels = {
  health: "vetka:health",
} as const
```

Create `src/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron"
import { channels } from "./shared/channels"
import type { VetkaDesktopApi } from "./shared/contracts"

const api: VetkaDesktopApi = {
  health: () => ipcRenderer.invoke(channels.health),
}

contextBridge.exposeInMainWorld("vetka", api)
```

Create `src/renderer/app.tsx` by composing shadcn `Sidebar`, `SidebarMenuButton`, `SidebarInset`, and `Outlet`. Use routes `/`, `/dolls`, `/orders`, and `/settings`; the initial route heading is `Избранное`.

- [ ] **Step 6: Configure tests and verification scripts**

Add scripts to `apps/desktop/package.json`:

```json
{
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

Configure Vitest with `jsdom`, React plugin, `@/` alias to `src`, and `tests/setup.ts` importing `@testing-library/jest-dom/vitest`.

Run:

```powershell
pnpm --dir apps/desktop test
pnpm --dir apps/desktop typecheck
pnpm --dir apps/desktop lint
pnpm --dir apps/desktop package
```

Expected: all commands exit 0 and `.vite` package output is created.

- [ ] **Step 7: Commit**

```powershell
git add pnpm-workspace.yaml apps/desktop
git commit -m "chore: scaffold Vetka Desktop shell"
```

### Task 2: Add the SQLite schema, migrations, and rotating backups

**Files:**
- Create: `apps/desktop/src/main/db/migrations/0001_v0.sql`
- Create: `apps/desktop/src/main/db/database.ts`
- Create: `apps/desktop/src/main/db/migrate.ts`
- Create: `apps/desktop/src/main/db/backup.ts`
- Test: `apps/desktop/tests/main/database.test.ts`
- Test: `apps/desktop/tests/main/backup.test.ts`

**Interfaces:**
- Produces: `openDatabase(path: string): DatabaseSync`.
- Produces: `runMigrations(db: DatabaseSync): void`.
- Produces: `rotateBackups(db, backupDir, keep = 7): Promise<string>`.

- [ ] **Step 1: Write failing database tests**

Create `tests/main/database.test.ts`:

```ts
import { DatabaseSync } from "node:sqlite"
import { describe, expect, it } from "vitest"
import { runMigrations } from "../../src/main/db/migrate"

describe("V0 migration", () => {
  it("creates every V0 table and enables foreign keys", () => {
    const db = new DatabaseSync(":memory:")
    runMigrations(db)
    const names = db.prepare(
      "select name from sqlite_master where type = 'table' order by name"
    ).all().map((row) => String(row.name))
    expect(names).toEqual(expect.arrayContaining([
      "amazon_listings", "dolls", "order_status_events", "orders",
      "price_checks", "price_snapshots", "schema_migrations", "settings"
    ]))
    expect(db.prepare("pragma foreign_keys").get()).toEqual({ foreign_keys: 1 })
  })
})
```

Create `tests/main/backup.test.ts` with a temporary file database, call `rotateBackups`, insert a row, and assert the backup opens and keeps no more than seven `.sqlite` files.

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
pnpm --dir apps/desktop vitest run tests/main/database.test.ts tests/main/backup.test.ts
```

Expected: FAIL because database modules are missing.

- [ ] **Step 3: Create the complete V0 migration**

Create `src/main/db/migrations/0001_v0.sql` with `STRICT` tables. The required columns and constraints are:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS dolls (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  character_name TEXT,
  line_name TEXT,
  generation TEXT,
  mattel_sku TEXT,
  upc_ean TEXT,
  image_path TEXT,
  notes TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS amazon_listings (
  id TEXT PRIMARY KEY,
  doll_id TEXT NOT NULL REFERENCES dolls(id) ON DELETE CASCADE,
  region TEXT NOT NULL CHECK (region IN ('amazon_us','amazon_uk','amazon_de','amazon_es','amazon_it')),
  asin TEXT NOT NULL CHECK (length(asin) = 10),
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('candidate','confirmed','rejected','frozen')),
  confirmation_source TEXT CHECK (confirmation_source IN ('exact_id','deterministic_match','manual')),
  match_score INTEGER NOT NULL DEFAULT 0 CHECK (match_score BETWEEN 0 AND 100),
  match_reasons_json TEXT NOT NULL DEFAULT '[]',
  last_checked_at TEXT,
  last_verified_at TEXT,
  last_check_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(doll_id, region, asin)
) STRICT;

CREATE TABLE IF NOT EXISTS price_checks (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES amazon_listings(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('verified','out_of_stock','no_price','needs_review','captcha_required','blocked','parser_changed','identity_mismatch','network_error','conflict')),
  adapter_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  diagnostic_json TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE TABLE IF NOT EXISTS price_snapshots (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL UNIQUE REFERENCES price_checks(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES amazon_listings(id) ON DELETE CASCADE,
  offer_kind TEXT NOT NULL CHECK (offer_kind IN ('regular','prime','subscription')),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD','GBP','EUR')),
  shipping_minor INTEGER CHECK (shipping_minor IS NULL OR shipping_minor >= 0),
  seller_name TEXT,
  fulfilled_by_amazon INTEGER NOT NULL CHECK (fulfilled_by_amazon IN (0, 1)),
  availability TEXT NOT NULL CHECK (availability IN ('in_stock','preorder')),
  condition TEXT NOT NULL CHECK (condition = 'New'),
  coupon_text TEXT,
  rate_to_kzt_micros INTEGER NOT NULL CHECK (rate_to_kzt_micros > 0),
  price_kzt_minor INTEGER NOT NULL CHECK (price_kzt_minor >= 0),
  checked_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_contact TEXT NOT NULL CHECK (length(trim(customer_contact)) > 0),
  doll_id TEXT NOT NULL REFERENCES dolls(id),
  source_snapshot_id TEXT NOT NULL REFERENCES price_snapshots(id),
  source_region TEXT NOT NULL,
  source_asin TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_seller TEXT,
  source_price_minor INTEGER NOT NULL,
  source_currency TEXT NOT NULL,
  source_rate_to_kzt_micros INTEGER NOT NULL,
  source_price_kzt_minor INTEGER NOT NULL,
  local_shipping_minor INTEGER NOT NULL DEFAULT 0,
  local_shipping_currency TEXT NOT NULL,
  local_shipping_rate_to_kzt_micros INTEGER NOT NULL,
  weight_grams INTEGER NOT NULL CHECK (weight_grams > 0),
  international_rate_minor_per_kg INTEGER NOT NULL,
  international_rate_currency TEXT NOT NULL,
  international_rate_to_kzt_micros INTEGER NOT NULL,
  international_shipping_kzt_minor INTEGER NOT NULL,
  extra_costs_kzt_minor INTEGER NOT NULL DEFAULT 0,
  total_cost_kzt_minor INTEGER NOT NULL,
  customer_price_kzt_minor INTEGER NOT NULL,
  profit_kzt_minor INTEGER NOT NULL,
  margin_basis_points INTEGER,
  status TEXT NOT NULL CHECK (status IN ('new','awaiting_payment','ordered','shipped','warehouse','in_transit','received','delivered')),
  tracking_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS order_status_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS listings_doll_region_idx ON amazon_listings(doll_id, region, status);
CREATE INDEX IF NOT EXISTS snapshots_listing_checked_idx ON price_snapshots(listing_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS checks_listing_finished_idx ON price_checks(listing_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_updated_idx ON orders(status, updated_at DESC);
```

- [ ] **Step 4: Implement database opening, migration, and backups**

`database.ts` uses `DatabaseSync`, `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, and `PRAGMA busy_timeout = 5000`.

`migrate.ts` reads the bundled SQL, starts `BEGIN IMMEDIATE`, executes it, records version `1`, and rolls back on any error.

`backup.ts` uses `backup()` from `node:sqlite`, creates `vetka-YYYY-MM-DDTHH-mm-ss.sqlite`, sorts backups descending, and deletes entries after index six. It never deletes outside the supplied absolute backup directory.

- [ ] **Step 5: Run tests and commit**

```powershell
pnpm --dir apps/desktop vitest run tests/main/database.test.ts tests/main/backup.test.ts
pnpm --dir apps/desktop typecheck
git add apps/desktop/src/main/db apps/desktop/tests/main
git commit -m "feat: add local SQLite foundation"
```

Expected: tests pass, an in-memory database migrates, and rotating backup tests retain seven files.

### Task 3: Implement doll CRUD, settings, and validated IPC

**Files:**
- Create: `apps/desktop/src/main/dolls/repository.ts`
- Create: `apps/desktop/src/main/settings/repository.ts`
- Create: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `apps/desktop/src/shared/channels.ts`
- Modify: `apps/desktop/src/preload.ts`
- Modify: `apps/desktop/src/main.ts`
- Test: `apps/desktop/tests/main/dolls-repository.test.ts`
- Test: `apps/desktop/tests/main/ipc-validation.test.ts`

**Interfaces:**
- Produces: `DollRepository.create`, `get`, `list`, `update`, `setFavorite`.
- Produces: `SettingsRepository.get<T>`, `set<T>`, and `getAll`.
- Produces renderer API: `dolls.*` and `settings.*`.

- [ ] **Step 1: Add shared schemas and failing repository tests**

Define in `shared/contracts.ts`:

```ts
import { z } from "zod"

export const amazonRegionSchema = z.enum([
  "amazon_us", "amazon_uk", "amazon_de", "amazon_es", "amazon_it"
])

export const dollInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  characterName: z.string().trim().max(100).nullable().default(null),
  lineName: z.string().trim().max(100).nullable().default(null),
  generation: z.string().trim().max(40).nullable().default(null),
  mattelSku: z.string().trim().max(40).nullable().default(null),
  upcEan: z.string().trim().regex(/^\d{8,14}$/).nullable().default(null),
  imagePath: z.string().trim().nullable().default(null),
  notes: z.string().trim().max(2000).nullable().default(null),
})

export type DollInput = z.infer<typeof dollInputSchema>
export type Doll = DollInput & {
  id: string
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}
```

Tests must assert creation, search by name/SKU, favorites-only filtering, update, missing ID, and rejection of empty names and malformed UPC/EAN.

- [ ] **Step 2: Run focused tests and confirm failure**

```powershell
pnpm --dir apps/desktop vitest run tests/main/dolls-repository.test.ts tests/main/ipc-validation.test.ts
```

Expected: FAIL because repositories and handlers do not exist.

- [ ] **Step 3: Implement repositories and typed IPC**

Implement parameterized statements only. `DollRepository.list` accepts:

```ts
type DollListFilter = {
  query?: string
  favoritesOnly?: boolean
}
```

Search uses `lower(name) LIKE`, `lower(character_name) LIKE`, exact `mattel_sku`, and exact `upc_ean`. Map SQLite `0/1` to boolean at the repository boundary.

Register exact channels:

```ts
export const channels = {
  health: "vetka:health",
  dollsList: "vetka:dolls:list",
  dollsGet: "vetka:dolls:get",
  dollsCreate: "vetka:dolls:create",
  dollsUpdate: "vetka:dolls:update",
  dollsFavorite: "vetka:dolls:favorite",
  settingsGetAll: "vetka:settings:get-all",
  settingsSet: "vetka:settings:set",
} as const
```

Every IPC input is parsed with Zod before a repository call. Return `{ ok: true, data }` or `{ ok: false, error: { code, message } }`; never send raw stack traces to renderer.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm --dir apps/desktop vitest run tests/main/dolls-repository.test.ts tests/main/ipc-validation.test.ts
pnpm --dir apps/desktop test
pnpm --dir apps/desktop typecheck
git add apps/desktop/src apps/desktop/tests/main
git commit -m "feat: add local doll workspace contracts"
```

### Task 4: Build deterministic Amazon URL, identity, and offer parsers

**Files:**
- Create: `apps/desktop/src/collector/amazon/regions.ts`
- Create: `apps/desktop/src/collector/amazon/url.ts`
- Create: `apps/desktop/src/collector/amazon/money.ts`
- Create: `apps/desktop/src/collector/amazon/matching.ts`
- Create: `apps/desktop/src/collector/amazon/search.ts`
- Create: `apps/desktop/src/collector/amazon/product-page.ts`
- Create: `apps/desktop/tests/fixtures/amazon/*.html`
- Test: `apps/desktop/tests/collector/amazon-url.test.ts`
- Test: `apps/desktop/tests/collector/amazon-money.test.ts`
- Test: `apps/desktop/tests/collector/amazon-matching.test.ts`
- Test: `apps/desktop/tests/collector/amazon-product-page.test.ts`
- Test: `apps/desktop/tests/collector/amazon-search.test.ts`

**Interfaces:**
- Produces: `normalizeAmazonUrl(url): { region, asin, canonicalUrl }`.
- Produces: `matchAmazonProduct(doll, candidate): MatchDecision`.
- Produces: `parseAmazonProductPage(html, context): AmazonPageResult`.
- Produces: `parseAmazonSearchResults(html, region): AmazonCandidate[]`.

- [ ] **Step 1: Define regions and failing URL/money tests**

`regions.ts` exports exact configuration:

```ts
export const amazonRegions = {
  amazon_us: { host: "www.amazon.com", currency: "USD", locale: "en-US" },
  amazon_uk: { host: "www.amazon.co.uk", currency: "GBP", locale: "en-GB" },
  amazon_de: { host: "www.amazon.de", currency: "EUR", locale: "de-DE" },
  amazon_es: { host: "www.amazon.es", currency: "EUR", locale: "es-ES" },
  amazon_it: { host: "www.amazon.it", currency: "EUR", locale: "it-IT" },
} as const
```

URL tests cover `/dp/B0CXYZ1234`, `/gp/product/B0CXYZ1234`, query and affiliate parameters, lowercase ASIN normalization, unsupported hosts, and malformed ASINs.

Money tests cover `$1,299.99`, `£29.99`, `31,20 €`, `EUR 42,90`, non-breaking spaces, price-per-unit text, and rejection of ambiguous strings containing two different amounts.

- [ ] **Step 2: Write failing matching and parser tests with sanitized fixtures**

Create one small fixture per region containing only title, ASIN, main Buy Box price, seller, availability, and merchant text. Use exact expected values:

```ts
const expectations = [
  ["amazon_us", 2499, "USD", "Amazon.com"],
  ["amazon_uk", 2999, "GBP", "Amazon.co.uk"],
  ["amazon_de", 3120, "EUR", "Amazon.de"],
  ["amazon_es", 3190, "EUR", "Amazon.es"],
  ["amazon_it", 3099, "EUR", "Amazon.it"],
] as const
```

Add fixtures for CAPTCHA, out of stock, conflicting structured/visible prices, accessory title, Prime-only offer, coupon text, and changed markup.

Tests assert:

- exact Mattel SKU or UPC/EAN returns `verified`;
- manually confirmed ASIN returns `verified`;
- accessory keywords return `rejected` even with character overlap;
- title-only similarity returns `needs_review`, not `verified`;
- conflicting prices return `conflict` with no accepted price;
- CAPTCHA returns `captcha_required`;
- missing recognized Buy Box returns `parser_changed` or `no_price`, never a random amount.

- [ ] **Step 3: Run tests and confirm failure**

```powershell
pnpm --dir apps/desktop vitest run tests/collector/amazon-url.test.ts tests/collector/amazon-money.test.ts tests/collector/amazon-matching.test.ts tests/collector/amazon-product-page.test.ts tests/collector/amazon-search.test.ts
```

Expected: FAIL because parser modules are missing.

- [ ] **Step 4: Implement deterministic parsing**

`normalizeAmazonUrl` accepts only configured hosts and extracts a ten-character alphanumeric ASIN from known URL shapes.

`matchAmazonProduct` uses this exact precedence:

```ts
if (negativeAccessoryPattern.test(candidateText)) return rejected("non_doll")
if (exact(candidate.modelNumber, doll.mattelSku)) return verified(100, "mattel_sku")
if (exact(candidate.upcEan, doll.upcEan)) return verified(100, "upc_ean")
if (candidate.manuallyConfirmed) return verified(100, "manual")

const score = brand(20) + character(20) + line(15) + generation(10) + titleOverlap(35)
return score >= 85 ? needsReview(score) : rejected("insufficient_identity")
```

`parseAmazonProductPage` reads recognized Buy Box selectors, JSON-LD/embedded offer data, and accessibility price text. It accepts one recognized Buy Box price or two agreeing sources; any difference above one minor unit is `conflict`. It separately returns `regularPrice`, `primePrice`, `subscriptionPrice`, and `couponText`.

`parseAmazonSearchResults` reads `div[data-asin]`, canonical product link, title, visible result price, and image. These values create candidates only and never a verified snapshot.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --dir apps/desktop vitest run tests/collector
pnpm --dir apps/desktop typecheck
git add apps/desktop/src/collector/amazon apps/desktop/tests/collector apps/desktop/tests/fixtures/amazon
git commit -m "feat: add strict Amazon parsing contracts"
```

### Task 5: Implement the isolated collector worker and persistent regional browser profiles

**Files:**
- Create: `apps/desktop/src/collector/contracts.ts`
- Create: `apps/desktop/src/collector/browser.ts`
- Create: `apps/desktop/src/collector/queue.ts`
- Create: `apps/desktop/src/collector/amazon/collect.ts`
- Create: `apps/desktop/src/collector/worker.ts`
- Create: `apps/desktop/src/main/collector/client.ts`
- Modify: `apps/desktop/forge.config.ts`
- Modify: `apps/desktop/package.json`
- Test: `apps/desktop/tests/collector/queue.test.ts`
- Test: `apps/desktop/tests/collector/collect.test.ts`
- Test: `apps/desktop/tests/main/collector-client.test.ts`

**Interfaces:**
- Consumes: parser functions from Task 4.
- Produces: `CollectorClient.refreshDoll(request): Promise<CollectorDollResult>`.
- Produces: progress events `queued`, `searching`, `checking`, `captcha_required`, `completed`, `failed`.

- [ ] **Step 1: Define message contracts and failing queue/client tests**

Use discriminated messages:

```ts
export type CollectorRequest = {
  type: "refresh-doll"
  requestId: string
  dataDir: string
  doll: CollectorDollIdentity
  knownListings: KnownAmazonListing[]
  regions: AmazonRegion[]
}

export type CollectorResponse =
  | { type: "progress"; requestId: string; stage: CollectorStage; region?: AmazonRegion }
  | { type: "result"; requestId: string; result: CollectorDollResult }
  | { type: "error"; requestId: string; code: string; message: string }
```

Queue tests enqueue three jobs, assert strict serial execution, cancellation of a queued request, and continued processing after one rejection.

Client tests mock `utilityProcess.fork`, assert one worker is reused, response correlation by `requestId`, a 90-second request timeout, and worker restart after exit.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
pnpm --dir apps/desktop vitest run tests/collector/queue.test.ts tests/collector/collect.test.ts tests/main/collector-client.test.ts
```

Expected: FAIL because worker modules are missing.

- [ ] **Step 3: Implement browser discovery and persistent profiles**

`browser.ts` checks these executable paths in order and returns the first existing file:

```ts
const candidates = [
  join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
  join(process.env["PROGRAMFILES(X86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
  join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
  join(process.env.PROGRAMFILES ?? "", "Microsoft/Edge/Application/msedge.exe"),
]
```

If none exists, return error code `browser_not_found` with Russian guidance. Launch with `chromium.launchPersistentContext(profileDir, { executablePath, headless: false, locale, viewport: { width: 1365, height: 900 } })`. Profile directory is `<userData>/amazon-profiles/<region>`.

Only one page and one region are active at a time. Close pages after each job but preserve context/profile. Do not log cookies, storage state, full HTML, or request headers.

- [ ] **Step 4: Implement collect orchestration and worker transport**

For each requested region:

1. verify confirmed known listings first;
2. if no verified current result exists, run up to three search terms: SKU, UPC/EAN, and official/name title;
3. inspect at most five unique candidates;
4. stop after the first verified listing or return review candidates;
5. emit one result per region.

CAPTCHA detection emits progress and leaves the regional window visible. The worker waits for explicit `resume-region` or `cancel-request`; it does not attempt automated CAPTCHA solving.

Bundle `worker.ts` with tsup and make every Electron entry command rebuild it. Add these exact scripts to `apps/desktop/package.json`:

```json
{
  "scripts": {
    "build:collector": "tsup src/collector/worker.ts --format cjs --platform node --external electron --external playwright-core --out-dir .vite/build --out-extension .js=.cjs",
    "prestart": "pnpm build:collector",
    "prepackage": "pnpm build:collector",
    "premake": "pnpm build:collector"
  }
}
```

`CollectorClient` starts the resulting file with `utilityProcess.fork(path.join(__dirname, "worker.cjs"))`.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --dir apps/desktop vitest run tests/collector tests/main/collector-client.test.ts
pnpm --dir apps/desktop typecheck
pnpm --dir apps/desktop package
git add apps/desktop
git commit -m "feat: add local Amazon collector worker"
```

Expected: unit tests pass and the packaged app contains `.vite/build/worker.cjs`.

### Task 6: Persist checks, verified snapshots, freshness, and price history

**Files:**
- Create: `apps/desktop/src/main/prices/repository.ts`
- Create: `apps/desktop/src/main/prices/service.ts`
- Create: `apps/desktop/src/domain/freshness.ts`
- Create: `apps/desktop/src/domain/price-history.ts`
- Modify: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/preload.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Test: `apps/desktop/tests/main/prices-repository.test.ts`
- Test: `apps/desktop/tests/main/price-service.test.ts`
- Test: `apps/desktop/tests/domain/freshness.test.ts`
- Test: `apps/desktop/tests/domain/price-history.test.ts`

**Interfaces:**
- Consumes: `CollectorDollResult` from Task 5.
- Produces: `PriceService.refreshDoll(dollId, regions)`.
- Produces renderer API: `amazon.refreshDoll`, `amazon.reviewCandidate`, `prices.current`, `prices.history`.

- [ ] **Step 1: Write failing persistence and freshness tests**

Cover these exact cases:

- verified result inserts `price_checks` and `price_snapshots` in one transaction;
- `captcha_required`, `conflict`, and `parser_changed` insert checks but no snapshots;
- later failure leaves previous verified snapshot current;
- manual rejection changes listing to `rejected` and never deletes history;
- manual confirmation sets `status = confirmed`, `confirmation_source = manual`;
- `freshnessAt(checkedAt, now)` returns `fresh` through 60 minutes, `aging` through 24 hours, then `stale`;
- graph aggregation returns gaps for out-of-stock intervals and never zero-price points.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
pnpm --dir apps/desktop vitest run tests/main/prices-repository.test.ts tests/main/price-service.test.ts tests/domain/freshness.test.ts tests/domain/price-history.test.ts
```

Expected: FAIL because price modules are missing.

- [ ] **Step 3: Implement atomic result application**

Use one `BEGIN IMMEDIATE` transaction per region result. Always insert a check. Insert a snapshot only when status is `verified`, condition is `New`, price is non-negative, currency matches the region, and `rateToKztMicros > 0`.

Select current prices with a lateral-equivalent correlated query:

```sql
SELECT s.*
FROM price_snapshots s
JOIN amazon_listings l ON l.id = s.listing_id
WHERE l.doll_id = ? AND l.status = 'confirmed'
  AND s.checked_at = (
    SELECT MAX(s2.checked_at)
    FROM price_snapshots s2
    WHERE s2.listing_id = s.listing_id
  )
ORDER BY l.region;
```

Join the latest `price_checks` separately so the UI can show a new CAPTCHA/error alongside an older verified price.

- [ ] **Step 4: Implement history and IPC**

History returns native minor units and saved KZT minor units for `7d`, `30d`, `90d`, or `all`. It groups by listing/region and orders ascending by `checked_at`. The domain function calculates min, max, arithmetic mean, and 7/30-day percent change only from verified points.

Progress events reach renderer through `webContents.send("vetka:collector:progress", event)`. Preload exposes a subscribe function that returns an unsubscribe callback.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --dir apps/desktop vitest run tests/main/prices-repository.test.ts tests/main/price-service.test.ts tests/domain
pnpm --dir apps/desktop test
pnpm --dir apps/desktop typecheck
git add apps/desktop
git commit -m "feat: persist trustworthy Amazon price history"
```

### Task 7: Build the shadcn workbench, doll list, and manual-add workflow

**Files:**
- Create: `apps/desktop/src/renderer/components/app-sidebar.tsx`
- Create: `apps/desktop/src/renderer/features/home/home-page.tsx`
- Create: `apps/desktop/src/renderer/features/home/favorite-price-table.tsx`
- Create: `apps/desktop/src/renderer/features/dolls/dolls-page.tsx`
- Create: `apps/desktop/src/renderer/features/dolls/doll-table.tsx`
- Create: `apps/desktop/src/renderer/features/dolls/add-doll-dialog.tsx`
- Create: `apps/desktop/src/renderer/features/dolls/doll-form.tsx`
- Create: `apps/desktop/src/renderer/lib/ipc-query.ts`
- Modify: `apps/desktop/src/renderer/app.tsx`
- Test: `apps/desktop/tests/renderer/home-page.test.tsx`
- Test: `apps/desktop/tests/renderer/add-doll-dialog.test.tsx`
- Test: `apps/desktop/tests/renderer/doll-table.test.tsx`

**Interfaces:**
- Consumes: `window.vetka.dolls.*`, current price summaries, and collector progress.
- Produces: chosen layout A with manual add, favorite toggle, and refresh actions.

- [ ] **Step 1: Inspect installed shadcn APIs and write failing UI tests**

Run:

```powershell
pnpm --dir apps/desktop dlx shadcn@latest info --json
pnpm --dir apps/desktop dlx shadcn@latest docs sidebar
pnpm --dir apps/desktop dlx shadcn@latest docs table
pnpm --dir apps/desktop dlx shadcn@latest docs field
pnpm --dir apps/desktop dlx shadcn@latest docs dialog
```

Tests assert:

- home opens with heading `Избранное`;
- stat cards show favorites, price drops, and review count;
- each row shows region values, freshness, and actions `Проверить`/`Создать заказ`;
- empty state offers `Добавить куклу`;
- quick add requires name and a supported Amazon URL;
- advanced add accepts identifiers and optional image;
- invalid URL remains in the form and shows a field error;
- successful add invalidates doll queries and closes the dialog.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
pnpm --dir apps/desktop vitest run tests/renderer/home-page.test.tsx tests/renderer/add-doll-dialog.test.tsx tests/renderer/doll-table.test.tsx
```

Expected: FAIL because renderer feature components are missing.

- [ ] **Step 3: Implement the chosen dense workbench**

Compose:

- `Sidebar` for `Избранное`, `Куклы`, `Заказы`, `Настройки`;
- three `Card`s for counts;
- shadcn `Table` for favorite rows;
- `Badge` for freshness/review/error;
- `Button` for refresh, favorite, add, and create order;
- `Skeleton`, `Alert`, `Empty`, and `Sonner` for states.

The default route is favorites. Do not add a card-grid catalog or custom primitive components.

- [ ] **Step 4: Implement manual add and local image copy**

The quick form has `Название` and `Ссылка Amazon`. The advanced collapsible section has character, line, generation, SKU, UPC/EAN, notes, and image.

Add a main-process `images.import` IPC method using Electron `dialog.showOpenDialog`, accept JPEG/PNG/WebP up to 8 MB, copy to `<userData>/images/<uuid>.<ext>`, and return the local path. Reject unsupported extensions and oversized files before copy.

After creating a doll with a URL, normalize the URL, create a candidate listing, and offer `Проверить сейчас`.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --dir apps/desktop vitest run tests/renderer/home-page.test.tsx tests/renderer/add-doll-dialog.test.tsx tests/renderer/doll-table.test.tsx
pnpm --dir apps/desktop lint
pnpm --dir apps/desktop typecheck
git add apps/desktop
git commit -m "feat: add Vetka operational workbench"
```

### Task 8: Build doll detail, regional offers, review queue, and shadcn price charts

**Files:**
- Create: `apps/desktop/src/renderer/features/dolls/doll-detail-page.tsx`
- Create: `apps/desktop/src/renderer/features/prices/regional-offer-list.tsx`
- Create: `apps/desktop/src/renderer/features/prices/price-history-chart.tsx`
- Create: `apps/desktop/src/renderer/features/prices/price-summary.tsx`
- Create: `apps/desktop/src/renderer/features/prices/review-candidates.tsx`
- Modify: `apps/desktop/src/renderer/app.tsx`
- Test: `apps/desktop/tests/renderer/doll-detail.test.tsx`
- Test: `apps/desktop/tests/renderer/price-history-chart.test.tsx`
- Test: `apps/desktop/tests/renderer/review-candidates.test.tsx`

**Interfaces:**
- Consumes: current/history/review APIs from Task 6.
- Produces: approved detail layout with chart left, region list right, and manual approve/reject.

- [ ] **Step 1: Inspect shadcn Chart and write failing tests**

Run:

```powershell
pnpm --dir apps/desktop dlx shadcn@latest docs chart
pnpm --dir apps/desktop dlx shadcn@latest docs tabs
pnpm --dir apps/desktop dlx shadcn@latest docs alert-dialog
```

Tests assert:

- five regions are always represented, including unavailable states;
- verified offers show source currency, KZT, seller, fulfillment, and freshness;
- stale values are labeled and visually muted;
- range controls switch `7d/30d/90d/Всё`;
- native mode renders one region in source currency;
- compare mode renders all enabled regions in saved KZT;
- tooltip contains timestamp, seller, source amount, and KZT;
- out-of-stock creates no zero-value point;
- candidate approval requires confirmation; rejection removes it from active review.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
pnpm --dir apps/desktop vitest run tests/renderer/doll-detail.test.tsx tests/renderer/price-history-chart.test.tsx tests/renderer/review-candidates.test.tsx
```

Expected: FAIL because components are missing.

- [ ] **Step 3: Implement the approved detail layout**

Compose a header `Card` with image, passport, `Обновить цены`, and `Создать заказ`. Below it, use a two-column desktop grid:

- left `Card`: `ChartContainer`, `LineChart accessibilityLayer`, `ChartTooltip`, `ChartLegend`, range `ToggleGroup`, summary metrics;
- right `Card`: five regional offer rows using `Badge`, `Tooltip`, and action buttons.

Use theme chart variables `--chart-1` through `--chart-5`; do not introduce a separate chart theme.

- [ ] **Step 4: Implement candidate review and collector states**

Use `Alert` for CAPTCHA/parser errors, `Dialog` for candidate details, and `AlertDialog` for rejection. Approval calls `amazon.reviewCandidate({ listingId, decision: "confirm" })`; rejection passes `"reject"`.

When progress is `captcha_required`, show `Открыть Amazon и продолжить`; this sends `resume-region` only after the user has completed the visible browser check.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --dir apps/desktop vitest run tests/renderer/doll-detail.test.tsx tests/renderer/price-history-chart.test.tsx tests/renderer/review-candidates.test.tsx
pnpm --dir apps/desktop lint
pnpm --dir apps/desktop typecheck
git add apps/desktop
git commit -m "feat: add regional Amazon price workspace"
```

### Task 9: Implement calculations and immutable order creation

**Files:**
- Create: `apps/desktop/src/domain/calculations.ts`
- Create: `apps/desktop/src/main/orders/repository.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/preload.ts`
- Test: `apps/desktop/tests/domain/calculations.test.ts`
- Test: `apps/desktop/tests/main/orders-repository.test.ts`

**Interfaces:**
- Produces: `calculateOrder(input): OrderCalculation`.
- Produces: `OrderRepository.create`, `list`, `get`, `transition`, `updateTracking`.
- Produces renderer API `orders.*`.

- [ ] **Step 1: Write failing formula tests**

Use integer inputs:

```ts
expect(calculateOrder({
  sourcePriceMinor: 2499,
  sourceRateToKztMicros: 514_200_000,
  localShippingMinor: 0,
  localShippingRateToKztMicros: 514_200_000,
  weightGrams: 720,
  internationalRateMinorPerKg: 1200,
  internationalRateToKztMicros: 514_200_000,
  extraCostsKztMinor: 80_000,
  customerPriceKztMinor: 2_490_000,
})).toEqual({
  sourcePriceKztMinor: 1_284_986,
  localShippingKztMinor: 0,
  internationalShippingKztMinor: 444_269,
  totalCostKztMinor: 1_809_255,
  profitKztMinor: 680_745,
  marginBasisPoints: 2734,
})
```

Also cover GBP/EUR source rates, nonzero local shipping in source currency, manually different international currency, rounding half up, zero customer price, and negative-input rejection.

- [ ] **Step 2: Write failing order repository tests**

Assert that creation:

- requires nonempty `customerContact`;
- loads the selected snapshot inside the transaction;
- copies region, ASIN, URL, seller, source price, currency, and rate;
- recalculates server-side/main-process instead of trusting renderer totals;
- creates initial `new` status event;
- remains unchanged after later snapshots are inserted;
- transitions append events and preserve history;
- tracking number updates do not rewrite calculation fields.

- [ ] **Step 3: Run tests and confirm failure**

```powershell
pnpm --dir apps/desktop vitest run tests/domain/calculations.test.ts tests/main/orders-repository.test.ts
```

Expected: FAIL because calculation and order modules are missing.

- [ ] **Step 4: Implement exact integer calculations and repository**

Use helpers:

```ts
const convertMinorToKzt = (minor: number, rateMicros: number) =>
  Math.round((minor * rateMicros) / 1_000_000)

const shippingMinor = Math.round(
  (weightGrams * internationalRateMinorPerKg) / 1000
)

const marginBasisPoints = customerPriceKztMinor === 0
  ? null
  : Math.round((profitKztMinor * 10_000) / customerPriceKztMinor)
```

Validate safe integers and nonnegative costs before calculating. `create` starts `BEGIN IMMEDIATE`, loads snapshot/listing/doll, calculates, inserts order and first event, and commits.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --dir apps/desktop vitest run tests/domain/calculations.test.ts tests/main/orders-repository.test.ts
pnpm --dir apps/desktop test
pnpm --dir apps/desktop typecheck
git add apps/desktop
git commit -m "feat: add immutable order calculations"
```

### Task 10: Build order creation, tracking, and status workflows

**Files:**
- Create: `apps/desktop/src/renderer/features/orders/create-order-sheet.tsx`
- Create: `apps/desktop/src/renderer/features/orders/order-cost-summary.tsx`
- Create: `apps/desktop/src/renderer/features/orders/orders-page.tsx`
- Create: `apps/desktop/src/renderer/features/orders/order-detail-page.tsx`
- Create: `apps/desktop/src/renderer/features/orders/order-status-control.tsx`
- Test: `apps/desktop/tests/renderer/create-order-sheet.test.tsx`
- Test: `apps/desktop/tests/renderer/orders-page.test.tsx`
- Test: `apps/desktop/tests/renderer/order-status-control.test.tsx`

**Interfaces:**
- Consumes: `orders.*`, selected verified snapshot, and settings defaults.
- Produces: approved one-screen order form and order tracking workspace.

- [ ] **Step 1: Inspect shadcn form/sheet APIs and write failing tests**

Run:

```powershell
pnpm --dir apps/desktop dlx shadcn@latest docs sheet
pnpm --dir apps/desktop dlx shadcn@latest docs field
pnpm --dir apps/desktop dlx shadcn@latest docs input-group
pnpm --dir apps/desktop dlx shadcn@latest docs select
```

Tests assert:

- selected offer is visible and read-only;
- `Контакт клиента` is a plain required Input accepting `@username` or free text;
- defaults populate weight, tariff, rates, and local shipping;
- changing an input updates preview immediately;
- submit passes only inputs and snapshot ID, not renderer-computed totals;
- list filters by status and searches contact, doll, or tracking number;
- status transitions append timeline entries;
- tracking number remains editable;
- completed order still shows its original Amazon snapshot.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
pnpm --dir apps/desktop vitest run tests/renderer/create-order-sheet.test.tsx tests/renderer/orders-page.test.tsx tests/renderer/order-status-control.test.tsx
```

Expected: FAIL because order UI is missing.

- [ ] **Step 3: Implement the approved one-screen Sheet**

Compose the left form from `Field`, `Input`, `InputGroup`, and `Select`. Compose the sticky right summary from `Card`, `Separator`, and `Badge`. Use React Hook Form with Zod and `useWatch` for preview.

Fields are contact, source price read-only, local shipping, weight, international tariff, applicable rates, extra costs, customer price, and notes. On submit, call `orders.create`; show `Sonner` success and navigate to the order detail.

- [ ] **Step 4: Implement order list, detail, and timeline**

Use shadcn `Table` with status filters, `Badge`, and row actions. Detail uses `Card`s for calculation, source offer, tracking, and status history. Only allowed next statuses appear as buttons, but returning to an earlier status is available through a confirmed dropdown action and creates another event.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --dir apps/desktop vitest run tests/renderer/create-order-sheet.test.tsx tests/renderer/orders-page.test.tsx tests/renderer/order-status-control.test.tsx
pnpm --dir apps/desktop lint
pnpm --dir apps/desktop typecheck
git add apps/desktop
git commit -m "feat: add order and tracking workflow"
```

### Task 11: Add settings, seed import, offline recovery, and Windows packaging

**Files:**
- Create: `apps/desktop/src/renderer/features/settings/settings-page.tsx`
- Create: `apps/desktop/src/main/settings/exchange-rates.ts`
- Create: `apps/desktop/src/main/import/import-vetka-export.ts`
- Create: `apps/desktop/tests/fixtures/vetka-export.json`
- Create: `apps/desktop/tests/main/import-vetka-export.test.ts`
- Create: `apps/desktop/tests/main/exchange-rates.test.ts`
- Create: `apps/desktop/e2e/desktop.spec.ts`
- Modify: `apps/desktop/forge.config.ts`
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/README.md`
- Create: `docs/vetka-desktop-operator-guide.md`

**Interfaces:**
- Produces: region address/locale settings, delivery defaults, cached rates, import, backup restore, logs, and `.exe` installer.

- [ ] **Step 1: Write failing settings/import/offline tests**

The import fixture schema is exact:

```json
{
  "dolls": [
    {
      "name": "Draculaura Core Refresh",
      "characterName": "Draculaura",
      "lineName": "Core Refresh",
      "generation": "G3",
      "mattelSku": "HRP64",
      "upcEan": null,
      "imagePath": null,
      "amazonUrls": {
        "amazon_us": "https://www.amazon.com/dp/B0CXYZ1234"
      }
    }
  ]
}
```

Tests assert import creates dolls and candidate listings but no price snapshots, duplicate SKU/ASIN imports are idempotent, cached rates work offline with dates, invalid rate responses keep prior cached values, and backup restore validates the SQLite file before replacement.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
pnpm --dir apps/desktop vitest run tests/main/import-vetka-export.test.ts tests/main/exchange-rates.test.ts
```

Expected: FAIL because import and rate services are missing.

- [ ] **Step 3: Implement settings and one-time import**

Settings sections:

- Amazon address/locale for each of five regions;
- default weight and international tariff/currency;
- cached USD/EUR/GBP to KZT values with source/date and manual override;
- database path, last backup, `Создать резервную копию`, `Восстановить`, and `Открыть журнал`.

The import service parses the exact schema with Zod, creates or updates a doll by `mattelSku` then `upcEan` then name, creates candidate listings from supported URLs, and never imports external price fields.

- [ ] **Step 4: Configure Windows installer and desktop smoke**

Configure Electron Forge Squirrel maker with:

```ts
{
  name: "@electron-forge/maker-squirrel",
  config: {
    name: "vetka_desktop",
    authors: "Vetka Dolls",
    description: "Локальная рабочая система Vetka Dolls",
    setupExe: "VetkaDesktopSetup.exe",
  },
}
```

Desktop smoke launches the packaged app with a temporary `userData` directory and asserts:

1. app starts without network;
2. manual doll creation persists after restart;
3. seeded verified snapshot renders a chart;
4. creating an order stores immutable calculations;
5. status and tracking persist after restart.

- [ ] **Step 5: Write operator documentation**

`docs/vetka-desktop-operator-guide.md` documents installation, first-run settings, manual add, price refresh, CAPTCHA continuation, candidate confirmation, history, order creation, statuses, backup, restore, and local data paths. It explicitly states that stale or failed checks are not current prices.

- [ ] **Step 6: Run full release verification**

```powershell
pnpm --dir apps/desktop test
pnpm --dir apps/desktop lint
pnpm --dir apps/desktop typecheck
pnpm --dir apps/desktop package
pnpm --dir apps/desktop make
pnpm --dir apps/desktop playwright test e2e/desktop.spec.ts
```

Expected: every command exits 0 and `apps/desktop/out/make/squirrel.windows/x64/VetkaDesktopSetup.exe` exists.

- [ ] **Step 7: Perform live Amazon acceptance**

On a Windows machine with Chrome or Edge:

1. configure addresses for US/UK/DE/ES/IT;
2. add three known dolls by SKU and Amazon URL;
3. compare every displayed source price, seller, condition, availability, and ASIN against the visible Amazon page;
4. trigger or simulate CAPTCHA and confirm no price is written;
5. confirm a candidate manually and refresh it;
6. create an order from a verified snapshot;
7. disconnect network, restart, and complete local order/status work;
8. restore from a generated backup.

Expected: all twelve design-spec readiness criteria are satisfied.

- [ ] **Step 8: Commit**

```powershell
git add apps/desktop docs/vetka-desktop-operator-guide.md
git commit -m "feat: package Vetka Desktop Amazon V0"
```

## Plan Self-Review

- Spec coverage: Electron isolation, local SQLite, five Amazon regions, strict identity and offer verification, manual add, favorites-first UI, immutable price history, shadcn charts, calculator, Telegram contact, order statuses, backups, offline behavior, fixtures, and Windows installer each map to a task above.
- Scope: synchronization, server infrastructure, public client tracking, eBay, Mattel, inventory, and automated purchasing remain excluded.
- Type consistency: region IDs, price/check statuses, money units, rate micros, collector messages, and order statuses are defined once in shared contracts and consumed by later tasks.
- Placeholder scan: the plan contains no deferred implementation markers; production seed data is supplied through a fully specified import contract rather than embedded unknown records.
