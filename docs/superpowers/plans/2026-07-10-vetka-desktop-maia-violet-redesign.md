# Vetka Desktop Maia/Violet Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Vetka Desktop renderer around the agreed light Maia/Violet/Inter product system while preserving all V0 Amazon, order, IPC, and database behavior.

**Architecture:** Keep the feature boundaries and React Query data access intact. First migrate the shadcn preset and create a small local pattern layer, then compose that layer into the shell, list pages, detail pages, and forms. All layout verification runs against the actual Electron renderer at desktop window sizes, while unit tests continue to verify observable behavior and semantics.

**Tech Stack:** Electron Forge, React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Radix primitives, Lucide, React Query, Recharts, Vitest, Testing Library, Playwright.

## Global Constraints

- Scope is `apps/desktop` renderer UI only; preserve routes, Electron IPC, SQLite, Amazon collection, calculations, updater behavior, and data contracts.
- Use shadcn/ui only. Do not add a second UI library or mix Base and Radix component APIs.
- Locked preset: Maia, Violet, Inter, Lucide, Default Radius, Default/Solid Menu, Subtle Accent, light mode only.
- Verify shadcn preset code `b5wOkSNVY` with the official CLI before applying; use explicit locked settings if the code does not resolve correctly.
- Use primitive `sm` controls for sidebar/table/toolbar/filter UI and `default` controls for forms/primary actions. Do not use `lg` in normal product UI.
- Use semantic tokens only; do not introduce raw palette color classes in product components.
- Respect 24 px page inset, 24 px major-section gap, 12–16 px component group gap, and 8 px compact inline gap.
- Use content width tiers: forms 640–672 px, settings/detail 896 px, reading 720 px, tables/charts/dashboard full available width.
- Desktop QA is mandatory at 1080×720, 1280×800, and 1440×900. Mobile/tablet polishing is explicitly out of scope.
- Expanded and collapsed sidebar compositions are separate. Clipped sidebar text, bad overflow, or inaccessible icon rail controls block release.
- Handle applicable loading, empty, populated, error, disabled/pending, long-content, and partial-Amazon-region states.
- Do not copy shadcnblocks Pro source. Use it only as a visual composition reference.
- Use the design specification at `docs/superpowers/specs/2026-07-10-vetka-desktop-design-system-redesign-design.md` as the acceptance source.

---

## File Structure

| File | Responsibility |
|---|---|
| `AGENTS.md` | Durable repository rules for shadcn product UI work, copied/merged from the supplied archive. |
| `.agents/skills/product-ui/SKILL.md` | Local product-ui skill supplied by the user; copied unchanged for future UI tasks. |
| `.agents/skills/product-ui/assets/*` | Positive dashboard and sidebar anti-reference assets from the archive. |
| `apps/desktop/components.json` | Official shadcn preset declaration. |
| `apps/desktop/package.json` / `package-lock.json` | Inter font dependency. |
| `apps/desktop/src/index.css` | Maia/Violet/Inter semantic tokens and light-only base styling. |
| `apps/desktop/src/renderer.tsx` | Removes forced dark-mode class. |
| `apps/desktop/src/components/patterns/*.tsx` | Reusable AppShell, header, toolbar, table surface, stat, chart, form, empty, and detail compositions. |
| `apps/desktop/src/renderer/app.tsx` | Shell and navigation integration. |
| `apps/desktop/src/renderer/features/**` | Screen-level compositions; no data-contract changes. |
| `apps/desktop/tests/renderer/*.test.tsx` | Observable UI behavior, accessibility labels, states, and regression coverage. |
| `apps/desktop/tests/visual/maia-violet-desktop.spec.ts` | Electron visual regression scenarios using the supplied Playwright template as a starting point. |
| `docs/design-audit/2026-07-10-maia-violet-ui-decision.md` | Mandatory UI DECISION report created before visual code changes. |
| `docs/design-audit/visual-qa/` | Captured post-migration evidence at the three agreed desktop sizes. |

## Task 1: Establish the UI migration guardrails and inspect official sources

**Files:**
- Create: `AGENTS.md`
- Create: `.agents/skills/product-ui/SKILL.md`
- Create: `.agents/skills/product-ui/assets/dashboard-01-reference.png`
- Create: `.agents/skills/product-ui/assets/sidebar-collapse-bug-reference.png`
- Create: `docs/design-audit/2026-07-10-maia-violet-ui-decision.md`
- Create: `apps/desktop/tests/visual/maia-violet-desktop.spec.ts`

**Interfaces:**
- Consumes: the user attachment `codex-shadcn-design-system.zip`, `docs/design-audit/current-ui/*`, and the approved design specification.
- Produces: durable instructions, a written UI decision, and a reusable Electron visual-QA entry point used by Tasks 2–8.

- [ ] **Step 1: Copy the user-provided guidance without overwriting unrelated repository instructions**

Extract `C:\Users\xClean\.codex\codex-remote-attachments\019f49fa-de2e-7b90-8f00-65a49f848445\D3926F34-ACAC-4D31-AEE1-7DC6F203F523\1-codex-shadcn-design-system.zip` into a temporary directory. Compare any archive `AGENTS.md` with the repository root. Merge its UI-specific rules into root `AGENTS.md`; copy `.agents/skills/product-ui/**` unchanged. Do not replace existing non-UI instructions.

- [ ] **Step 2: Inspect official shadcn blocks and record the decision before changing UI code**

Open the official shadcn `dashboard-01` block plus two current official candidates covering sidebar/application shell and chart/table/form composition. Write `docs/design-audit/2026-07-10-maia-violet-ui-decision.md` using this exact structure:

```markdown
# UI DECISION — Vetka Desktop Maia/Violet migration

## Sources inspected
- `dashboard-01`: compact sidebar, toolbar, table and chart hierarchy.
- `<official shell block name>`: separate collapsed rail and inset content behavior.
- `<official table/chart/form block name>`: toolbar and bounded content composition.

## Chosen local patterns
- `AppShell`: expanded and icon-only collapsed sidebar compositions.
- `PageHeader` and `PageToolbar`: compact page hierarchy and bounded search/filter actions.
- `TableSurface`, `StatCard`, `ChartCard`, `FormSection`, `EmptyState`, `DetailSheet`: product-level wrappers around official primitives.

## Primitive policy
- `sm`: sidebar, table, toolbar, filters.
- `default`: form and primary action controls.
- Semantic Violet tokens and Lucide only; no raw palette utility classes.

## State coverage
- Loading, empty, populated, error, disabled/pending, long content, and partial Amazon-region data are covered by the affected feature compositions.

## Custom code justification
- Local patterns own Vetka-specific composition and state placement only; all interactive primitives remain official shadcn components.
```

- [ ] **Step 3: Add an Electron visual-QA skeleton derived from the supplied template**

Create `apps/desktop/tests/visual/maia-violet-desktop.spec.ts` with the following executable scenario skeleton, adapting only the app-launch helper to the repository's Electron Forge start command:

```ts
import { expect, test } from '@playwright/test';

const desktopViewports = [
  { name: 'minimum', width: 1080, height: 720 },
  { name: 'standard', width: 1280, height: 800 },
  { name: 'wide', width: 1440, height: 900 },
] as const;

for (const viewport of desktopViewports) {
  test(`Vetka shell has no page overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('http://127.0.0.1:5173/#/');
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.locator('html')).toEvaluate((html) => html.scrollWidth <= html.clientWidth);
    await expect(page).toHaveScreenshot(`vetka-${viewport.name}-expanded.png`, { fullPage: true });
  });
}
```

If the renderer is not directly reachable over Vite in the real Electron run, replace `page.goto` with the template's Electron window acquisition rather than reducing coverage.

- [ ] **Step 4: Run the new visual test once to confirm the harness fails for the expected missing launch/snapshot setup**

Run: `cd apps/desktop; npx playwright test tests/visual/maia-violet-desktop.spec.ts`

Expected: FAIL because the Electron/renderer launch wiring or baseline snapshots have not yet been configured. Record the actual failure in the task commit message or plan execution log; do not accept a skipped test as coverage.

- [ ] **Step 5: Commit the guardrails**

```powershell
git add AGENTS.md .agents/skills/product-ui docs/design-audit/2026-07-10-maia-violet-ui-decision.md apps/desktop/tests/visual/maia-violet-desktop.spec.ts
git commit -m "docs: add Vetka product UI guardrails"
```

## Task 2: Apply and test the Maia/Violet/Inter foundation

**Files:**
- Modify: `apps/desktop/components.json`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/package-lock.json`
- Modify: `apps/desktop/src/index.css`
- Modify: `apps/desktop/src/renderer.tsx`
- Create: `apps/desktop/tests/renderer/theme-foundation.test.tsx`

**Interfaces:**
- Consumes: Task 1 UI decision and the current official shadcn CLI.
- Produces: light-only semantic Violet token system and Inter typography consumed by all primitives and features.

- [ ] **Step 1: Write the failing renderer foundation test**

Create `apps/desktop/tests/renderer/theme-foundation.test.tsx`:

```tsx
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRendererFile = (file: string) => readFileSync(resolve(import.meta.dirname, '../../src', file), 'utf8');

describe('Maia/Violet renderer foundation', () => {
  it('uses Inter, semantic Violet chart tokens, and does not force dark mode', () => {
    const css = readRendererFile('index.css');
    const bootstrap = readRendererFile('renderer.tsx');

    expect(css).toContain('@fontsource-variable/inter');
    expect(css).toContain('--chart-1:');
    expect(css).toContain('--sidebar-primary:');
    expect(bootstrap).not.toContain("classList.add('dark')");
  });
});
```

- [ ] **Step 2: Run the foundation test and verify it fails**

Run: `cd apps/desktop; npm test -- tests/renderer/theme-foundation.test.tsx`

Expected: FAIL because Geist is imported and `renderer.tsx` forces the `dark` class.

- [ ] **Step 3: Verify and apply the official preset, then reconcile generated files deliberately**

Run the official command first:

```powershell
cd apps/desktop
npx shadcn@latest apply --preset b5wOkSNVY --dry-run
```

If that exact preset does not resolve to Maia/Violet/Inter/Lucide/Default Radius/Default-Solid Menu/Subtle Accent, use the official CLI's explicit selection flow to generate those settings. Update `components.json` to declare the resulting Maia configuration, replace the Geist dependency with `@fontsource-variable/inter`, regenerate `index.css` token definitions using the official output, preserve only necessary project-level Tailwind imports, and remove `document.documentElement.classList.add('dark')` from `renderer.tsx`.

The final CSS must import:

```css
@import "@fontsource-variable/inter";

@theme inline {
  --font-sans: "Inter Variable", sans-serif;
  --font-heading: "Inter Variable", sans-serif;
}
```

Do not retain a `.dark` token block or runtime dark-mode class in V0.

- [ ] **Step 4: Run the focused foundation test and typecheck**

Run:

```powershell
cd apps/desktop
npm test -- tests/renderer/theme-foundation.test.tsx
npm run typecheck
```

Expected: the foundation test passes and TypeScript exits 0.

- [ ] **Step 5: Commit the foundation**

```powershell
git add apps/desktop/components.json apps/desktop/package.json apps/desktop/package-lock.json apps/desktop/src/index.css apps/desktop/src/renderer.tsx apps/desktop/tests/renderer/theme-foundation.test.tsx
git commit -m "feat(ui): apply Maia Violet Inter foundation"
```

## Task 3: Build the reusable desktop pattern layer

**Files:**
- Create: `apps/desktop/src/components/patterns/page-header.tsx`
- Create: `apps/desktop/src/components/patterns/page-toolbar.tsx`
- Create: `apps/desktop/src/components/patterns/table-surface.tsx`
- Create: `apps/desktop/src/components/patterns/stat-card.tsx`
- Create: `apps/desktop/src/components/patterns/chart-card.tsx`
- Create: `apps/desktop/src/components/patterns/form-section.tsx`
- Create: `apps/desktop/src/components/patterns/empty-state.tsx`
- Create: `apps/desktop/src/components/patterns/detail-sheet.tsx`
- Create: `apps/desktop/tests/renderer/product-patterns.test.tsx`

**Interfaces:**
- Consumes: the official `Button`, `Card`, `Field`, `Sheet`, `Table`, `Empty`, and Lucide primitives after Task 2.
- Produces: named, typed compositions reused by Tasks 4–8 without owning feature data or mutations.

- [ ] **Step 1: Write failing semantic tests for the public pattern contracts**

Create `apps/desktop/tests/renderer/product-patterns.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { PlusIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '@/components/patterns/empty-state';
import { FormSection } from '@/components/patterns/form-section';
import { PageHeader } from '@/components/patterns/page-header';
import { PageToolbar } from '@/components/patterns/page-toolbar';

describe('product UI patterns', () => {
  it('renders a compact page header with a content-sized action', () => {
    render(<PageHeader title="Куклы" description="Рабочий список" actions={<button type="button">Добавить куклу</button>} />);
    expect(screen.getByRole('heading', { name: 'Куклы' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить куклу' })).toBeInTheDocument();
  });

  it('keeps toolbar controls and bounded empty-state action semantic', () => {
    render(<><PageToolbar><input aria-label="Поиск" /></PageToolbar><EmptyState icon={PlusIcon} title="Пока пусто" description="Добавьте первую куклу" action={<button type="button">Добавить куклу</button>} /></>);
    expect(screen.getByRole('textbox', { name: 'Поиск' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Пока пусто' })).toBeInTheDocument();
  });

  it('groups a short settings form under one labelled section', () => {
    render(<FormSection title="Доставка" description="Значения для нового заказа"><input aria-label="Вес" /></FormSection>);
    expect(screen.getByRole('heading', { name: 'Доставка' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Вес' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify the imports fail**

Run: `cd apps/desktop; npm test -- tests/renderer/product-patterns.test.tsx`

Expected: FAIL with unresolved `@/components/patterns/*` modules.

- [ ] **Step 3: Implement the minimal typed pattern contracts**

Create patterns with these public APIs:

```tsx
// page-header.tsx
export function PageHeader({ title, description, actions, meta }: {
  title: string; description?: string; actions?: React.ReactNode; meta?: React.ReactNode;
}): React.ReactElement

// page-toolbar.tsx
export function PageToolbar({ children, className }: React.ComponentProps<'div'>): React.ReactElement

// table-surface.tsx
export function TableSurface({ children, className }: React.ComponentProps<'div'>): React.ReactElement

// stat-card.tsx
export function StatCard({ label, value, icon: Icon, detail }: {
  label: string; value: React.ReactNode; icon?: LucideIcon; detail?: React.ReactNode;
}): React.ReactElement

// chart-card.tsx
export function ChartCard({ title, description, actions, children }: {
  title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode;
}): React.ReactElement

// form-section.tsx
export function FormSection({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}): React.ReactElement

// empty-state.tsx
export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode;
}): React.ReactElement

// detail-sheet.tsx
export function DetailSheet({ title, description, children, footer, ...props }: {
  title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode;
} & React.ComponentProps<typeof Sheet>): React.ReactElement
```

Use only semantic token utility classes and the spacing tiers from the specification. `TableSurface` must provide an internal horizontal scroll region for wide tables; no wrapper may set a fixed control height. `EmptyState` must use the existing shadcn `Empty` primitives but omit viewport-filling minimum heights. `FormSection` must constrain the form content to `max-w-2xl` or equivalent 672 px tier.

- [ ] **Step 4: Run pattern tests and the complete existing renderer suite**

Run:

```powershell
cd apps/desktop
npm test -- tests/renderer/product-patterns.test.tsx
npm test -- tests/renderer
```

Expected: all focused and existing renderer tests pass.

- [ ] **Step 5: Commit patterns**

```powershell
git add apps/desktop/src/components/patterns apps/desktop/tests/renderer/product-patterns.test.tsx
git commit -m "feat(ui): add shared desktop product patterns"
```

## Task 4: Rebuild the app shell and both sidebar states

**Files:**
- Create: `apps/desktop/src/components/patterns/app-shell.tsx`
- Modify: `apps/desktop/src/renderer/app.tsx`
- Modify: `apps/desktop/tests/renderer/app-shell.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` conventions and existing React Router routes.
- Produces: the single AppShell used for all routes, with non-clipping expanded and collapsed navigation.

- [ ] **Step 1: Replace the shell regression test with state-aware checks**

Replace `apps/desktop/tests/renderer/app-shell.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '@/renderer/app';

describe('App shell', () => {
  it('renders the four destinations, quick add action, and accessible collapse control', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const destination of ['Избранное', 'Куклы', 'Заказы', 'Настройки']) {
      expect(screen.getByRole('link', { name: destination })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Добавить куклу' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sidebar/i }));
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the shell test to verify it fails against the old header/sidebar**

Run: `cd apps/desktop; npm test -- tests/renderer/app-shell.test.tsx`

Expected: FAIL because the existing shell has no compact quick-add action and retains an empty top bar composition.

- [ ] **Step 3: Implement `AppShell` and migrate `app.tsx`**

`AppShell` must accept `children: React.ReactNode`, render `<SidebarProvider>`, an expanded sidebar with compact brand, quick `AddDollDialog`, and grouped navigation, plus a separate icon-only collapsed behavior supplied by the official Sidebar primitive. Preserve links exactly:

```ts
const destinations = [
  { label: 'Избранное', href: '/', icon: HeartIcon },
  { label: 'Куклы', href: '/dolls', icon: PackageSearchIcon },
  { label: 'Заказы', href: '/orders', icon: CalculatorIcon },
  { label: 'Настройки', href: '/settings', icon: SettingsIcon },
] as const;
```

Put the sidebar trigger in a compact content-context row, not a 48 px empty sticky bar. The collapsed rail must hide brand/quick-action text without clipping and retain `tooltip`/accessible labels for every icon-only action. Keep `Routes` and `UpdateNotification` unchanged.

- [ ] **Step 4: Run the shell regression test and inspect expanded/collapsed state manually**

Run: `cd apps/desktop; npm test -- tests/renderer/app-shell.test.tsx`

Expected: PASS. Then launch `npm start`, collapse the sidebar, and verify there is no clipped label, horizontal page overflow, or missing tooltip/accessibility label.

- [ ] **Step 5: Commit the shell**

```powershell
git add apps/desktop/src/components/patterns/app-shell.tsx apps/desktop/src/renderer/app.tsx apps/desktop/tests/renderer/app-shell.test.tsx
git commit -m "feat(ui): rebuild desktop application shell"
```

## Task 5: Migrate Favorites, Dolls, and Orders into working table compositions

**Files:**
- Modify: `apps/desktop/src/renderer/features/home/home-page.tsx`
- Modify: `apps/desktop/src/renderer/features/home/favorite-price-table.tsx`
- Modify: `apps/desktop/src/renderer/features/dolls/dolls-page.tsx`
- Modify: `apps/desktop/src/renderer/features/dolls/doll-table.tsx`
- Modify: `apps/desktop/src/renderer/features/orders/orders-page.tsx`
- Modify: `apps/desktop/tests/renderer/home-page.test.tsx`
- Modify: `apps/desktop/tests/renderer/doll-table.test.tsx`
- Modify: `apps/desktop/tests/renderer/orders-page.test.tsx`

**Interfaces:**
- Consumes: Task 3 pattern layer and existing feature query/mutation APIs unchanged.
- Produces: compact headers, toolbars, table surfaces, empty/loading/error presentation, and preserved row actions.

- [ ] **Step 1: Expand the existing list-page tests to assert toolbar and empty-state semantics**

Add these assertions:

```tsx
// home-page.test.tsx
expect(screen.getByRole('heading', { name: 'Рабочий список' })).toBeInTheDocument();
expect(screen.getByText('Избранное пока пусто')).toBeInTheDocument();

// doll-table.test.tsx
expect(screen.getByRole('link', { name: 'Draculaura' })).toHaveAttribute('href', '/dolls/d1');
expect(screen.getByRole('button', { name: 'Убрать из избранного' })).toBeInTheDocument();

// orders-page.test.tsx
expect(screen.getByRole('textbox', { name: 'Поиск заказов' })).toBeInTheDocument();
expect(screen.getByText('Заказов пока нет')).toBeInTheDocument();
```

- [ ] **Step 2: Run the three list tests to verify failures**

Run: `cd apps/desktop; npm test -- tests/renderer/home-page.test.tsx tests/renderer/doll-table.test.tsx tests/renderer/orders-page.test.tsx`

Expected: FAIL because the old page implementations lack the new labelled toolbar/query controls or revised semantic hierarchy.

- [ ] **Step 3: Implement compact list-page compositions without changing data behavior**

Apply the following exact composition rules:

- `HomePage`: `PageHeader`, a small `StatCard` strip only for favorites/freshness/review values already available, then a `TableSurface` headed `Рабочий список`. Use `EmptyState` with `AddDollDialog`; preserve favorite mutation and refresh actions.
- `DollsPage`: `PageHeader` with `AddDollDialog`; `PageToolbar` with an `Input aria-label="Поиск кукол"` constrained with `max-w-md`; direct `TableSurface` without outer `Card`; use `EmptyState` for no query results.
- `OrdersPage`: `PageHeader`; `PageToolbar` with `Input aria-label="Поиск заказов"` and the existing search query behavior; direct `TableSurface`; use semantic `Badge` statuses containing text; distinguish no orders from no matching orders using the current `query` state.
- Tables: preserve all current link paths, favorite actions, Amazon-region columns, formatters, and mutations. Put wide table scrolling only inside `TableSurface`; keep actions in a fixed right-aligned table cell.
- Do not add a status filter until a status parameter is supported by the existing orders query; this migration must not fabricate a client-side data contract.

- [ ] **Step 4: Run focused tests and exercise the populated table state**

Run:

```powershell
cd apps/desktop
npm test -- tests/renderer/home-page.test.tsx tests/renderer/doll-table.test.tsx tests/renderer/orders-page.test.tsx
npm run typecheck
```

Expected: PASS. In the running Electron app, add a doll, mark it favorite, navigate to Favorites, and confirm its price columns and refresh/favorite actions still work.

- [ ] **Step 5: Commit list-screen migration**

```powershell
git add apps/desktop/src/renderer/features/home apps/desktop/src/renderer/features/dolls/dolls-page.tsx apps/desktop/src/renderer/features/dolls/doll-table.tsx apps/desktop/src/renderer/features/orders/orders-page.tsx apps/desktop/tests/renderer/home-page.test.tsx apps/desktop/tests/renderer/doll-table.test.tsx apps/desktop/tests/renderer/orders-page.test.tsx
git commit -m "feat(ui): compose operational list screens"
```

## Task 6: Migrate doll and order detail workspaces

**Files:**
- Modify: `apps/desktop/src/renderer/features/dolls/doll-detail-page.tsx`
- Modify: `apps/desktop/src/renderer/features/prices/price-history-chart.tsx`
- Modify: `apps/desktop/src/renderer/features/prices/regional-offer-list.tsx`
- Modify: `apps/desktop/src/renderer/features/orders/order-detail-page.tsx`
- Modify: `apps/desktop/tests/renderer/doll-detail.test.tsx`
- Modify: `apps/desktop/tests/renderer/price-history-chart.test.tsx`
- Create: `apps/desktop/tests/renderer/order-detail.test.tsx`

**Interfaces:**
- Consumes: existing price/history/order React Query APIs, `ChartCard`, `PageHeader`, and `TableSurface` pattern conventions.
- Produces: detail headers, chart/region composition, compact financial summary, delivery form, and timeline without changing mutations.

- [ ] **Step 1: Write the failing detail-workspace tests**

Add these observable assertions:

```tsx
// doll-detail.test.tsx (keep the existing all-five-regions assertion)
expect(screen.getByText('Нет подтверждённой цены')).toBeInTheDocument();

// price-history-chart.test.tsx
expect(screen.getByText('История появится после первой успешной проверки')).toBeInTheDocument();

// order-detail.test.tsx
render(<MemoryRouter initialEntries={['/orders/o1']}><Routes><Route path="/orders/:id" element={<OrderDetailPage />} /></Routes></MemoryRouter>);
expect(await screen.findByRole('heading', { name: '@violet' })).toBeInTheDocument();
expect(screen.getByLabelText('Трек-номер')).toBeInTheDocument();
expect(screen.getByText('История статусов')).toBeInTheDocument();
```

Mock `window.vetka.orders.get` in `order-detail.test.tsx` with one `new` order having `customerContact: '@violet'`, a source price, totals, delivery values, and one event. The test must use the existing `VetkaDesktopApi` response shape from `tests/setup.ts`.

- [ ] **Step 2: Run the detail tests to verify the new test fails**

Run: `cd apps/desktop; npm test -- tests/renderer/doll-detail.test.tsx tests/renderer/price-history-chart.test.tsx tests/renderer/order-detail.test.tsx`

Expected: FAIL because `order-detail.test.tsx` does not exist and the current detail hierarchy does not expose all required semantics.

- [ ] **Step 3: Implement the detail compositions**

- `DollDetailPage`: replace the large entity `Card` with a compact `PageHeader`/entity row; keep back link, favorite, refresh, CAPTCHA, and `CreateOrderSheet` behaviors. Place `ChartCard` in the wide column and regional offers in the narrow column with a `minmax(320px, 1fr)` desktop-safe width.
- `PriceHistoryChart`: keep the range state and Recharts data mapping. Move range controls into the card action slot; replace the fixed 256 px empty box with `EmptyState`-style bounded content. Keep textual empty-state copy and chart accessibility layer.
- `RegionalOfferList`: preserve all five regions, freshness logic, links, and status badges. Use semantic status presentation and intentional truncation for seller text.
- `OrderDetailPage`: use a compact header with contact, doll, source ASIN, status Badge, and next-status action. Replace three generic Cards with a financial summary section, a bounded delivery `FormSection`, and a clear event timeline. Preserve `transition` and `updateTracking` mutations.

- [ ] **Step 4: Run detail tests and manually verify partial-region/CAPTCHA states**

Run:

```powershell
cd apps/desktop
npm test -- tests/renderer/doll-detail.test.tsx tests/renderer/price-history-chart.test.tsx tests/renderer/order-detail.test.tsx
npm run typecheck
```

Expected: PASS. In Electron, inspect a doll with no history and with fewer than five verified price regions; trigger or mock CAPTCHA progress and confirm it remains visible in-context without displacing the rest of the detail screen.

- [ ] **Step 5: Commit detail workspaces**

```powershell
git add apps/desktop/src/renderer/features/dolls/doll-detail-page.tsx apps/desktop/src/renderer/features/prices apps/desktop/src/renderer/features/orders/order-detail-page.tsx apps/desktop/tests/renderer/doll-detail.test.tsx apps/desktop/tests/renderer/price-history-chart.test.tsx apps/desktop/tests/renderer/order-detail.test.tsx
git commit -m "feat(ui): redesign doll and order detail workspaces"
```

## Task 7: Migrate settings and create-order forms to bounded field compositions

**Files:**
- Modify: `apps/desktop/src/renderer/features/settings/settings-page.tsx`
- Modify: `apps/desktop/src/renderer/features/orders/create-order-sheet.tsx`
- Modify: `apps/desktop/src/renderer/features/dolls/add-doll-dialog.tsx`
- Modify: `apps/desktop/tests/renderer/settings-page.test.tsx`
- Modify: `apps/desktop/tests/renderer/create-order-sheet.test.tsx`
- Modify: `apps/desktop/tests/renderer/add-doll-dialog.test.tsx`

**Interfaces:**
- Consumes: `FormSection`, `DetailSheet`, `FieldGroup`, existing calculation/query/mutation functions.
- Produces: form layouts that preserve all submission payloads, validation, and API calls with natural input widths.

- [ ] **Step 1: Add failing tests for bounded form semantics and preserved payload inputs**

Extend tests with:

```tsx
// settings-page.test.tsx
expect(screen.getByRole('heading', { name: 'Курсы валют' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Сохранить настройки' })).toBeInTheDocument();

// create-order-sheet.test.tsx
expect(screen.getByRole('heading', { name: 'Расчёт' })).toBeInTheDocument();
expect(screen.getByLabelText('Контакт клиента')).toHaveAttribute('placeholder', '@username или имя');

// add-doll-dialog.test.tsx
expect(screen.getByLabelText('Название')).toBeInTheDocument();
expect(screen.getByLabelText('Ссылка Amazon')).toBeInTheDocument();
```

- [ ] **Step 2: Run form tests to verify failures**

Run: `cd apps/desktop; npm test -- tests/renderer/settings-page.test.tsx tests/renderer/create-order-sheet.test.tsx tests/renderer/add-doll-dialog.test.tsx`

Expected: FAIL for the newly asserted headings/labels where the old generic Card or Dialog markup does not expose the finalized form structure.

- [ ] **Step 3: Implement the form migration without altering submitted field names**

- `SettingsPage`: use `PageHeader` and one `max-w-4xl` form. Place exchange rates and delivery defaults in `FormSection` groups; keep field names `USD`, `EUR`, `GBP`, `weight`, and `tariff`. Give numeric inputs natural widths (`w-40` to `w-56`) instead of full-column width. Put the save button in a single coherent action row.
- `CreateOrderSheet`: replace the fixed `sm:max-w-3xl` form composition with `DetailSheet`; keep all `FormData` names exactly unchanged: `contact`, `weight`, `tariff`, `local`, `extra`, `customer`, `notes`. Keep the calculation panel visible as a bounded aside at desktop widths and below/after fields when constrained; preserve the selected Amazon offer and profit calculation.
- `AddDollDialog`: retain quick/details tabs and all names (`name`, `url`, `characterName`, `lineName`, `generation`, `mattelSku`, `upcEan`, `notes`). Use `FieldGroup` only, `default` controls, and content-sized dialog footer actions. Preserve current URL validation and errors next to affected fields.

- [ ] **Step 4: Run form tests and verify a full create-order calculation flow**

Run:

```powershell
cd apps/desktop
npm test -- tests/renderer/settings-page.test.tsx tests/renderer/create-order-sheet.test.tsx tests/renderer/add-doll-dialog.test.tsx
npm run typecheck
```

Expected: PASS. In Electron, open a doll with a price, enter `@violet`, modify a delivery input, verify recalculated values, submit an order, and verify it appears in Orders.

- [ ] **Step 5: Commit forms**

```powershell
git add apps/desktop/src/renderer/features/settings/settings-page.tsx apps/desktop/src/renderer/features/orders/create-order-sheet.tsx apps/desktop/src/renderer/features/dolls/add-doll-dialog.tsx apps/desktop/tests/renderer/settings-page.test.tsx apps/desktop/tests/renderer/create-order-sheet.test.tsx apps/desktop/tests/renderer/add-doll-dialog.test.tsx
git commit -m "feat(ui): compose settings and order forms"
```

## Task 8: Complete visual QA, release verification, and implementation report

**Files:**
- Modify: `apps/desktop/tests/visual/maia-violet-desktop.spec.ts`
- Create: `docs/design-audit/visual-qa/README.md`
- Create: `docs/design-audit/visual-qa/1080x720-expanded.png`
- Create: `docs/design-audit/visual-qa/1080x720-collapsed.png`
- Create: `docs/design-audit/visual-qa/1280x800-expanded.png`
- Create: `docs/design-audit/visual-qa/1280x800-collapsed.png`
- Create: `docs/design-audit/visual-qa/1440x900-expanded.png`
- Create: `docs/design-audit/visual-qa/1440x900-collapsed.png`
- Create: `docs/design-audit/2026-07-10-maia-violet-ui-implementation-report.md`

**Interfaces:**
- Consumes: all migrated renderer screens, Task 1 baseline/reference evidence, and the actual Electron package.
- Produces: deterministic visual-QA evidence, release verification results, and the mandatory UI IMPLEMENTATION REPORT.

- [ ] **Step 1: Finish the visual test with populated and collapsed navigation scenarios**

Extend the Task 1 Playwright scenario to navigate to `#/`, `#/dolls`, `#/orders`, and `#/settings` at each desktop viewport. For every size, test expanded and collapsed sidebar states. Include this assertion after collapsing:

```ts
await page.getByRole('button', { name: /sidebar/i }).click();
await expect(page.locator('[data-sidebar="sidebar"]')).toHaveAttribute('data-state', 'collapsed');
await expect(page.locator('html')).toEvaluate((html) => html.scrollWidth <= html.clientWidth);
await expect(page).toHaveScreenshot(`vetka-${viewport.name}-collapsed.png`, { fullPage: true });
```

Use a fixture or the existing Electron local database setup to exercise at least one populated Dolls/Favorites/Orders state. Do not silently convert screenshot checks to snapshots that are never reviewed.

- [ ] **Step 2: Run visual tests and inspect comparisons against the stored evidence**

Run: `cd apps/desktop; npx playwright test tests/visual/maia-violet-desktop.spec.ts --update-snapshots`

Expected: PASS only after actual Electron/renderer launch wiring works. Compare the captured screenshots side-by-side with `docs/design-audit/current-ui/*`, `.agents/skills/product-ui/assets/dashboard-01-reference.png`, and the stored shadcnblocks reference images. Inspect for oversized controls, empty space, crop/clipping, inconsistent radii, raw colors, incorrect Inter rendering, and sidebar overflow.

- [ ] **Step 3: Run the complete automated verification suite**

Run:

```powershell
cd apps/desktop
npm test
npm run lint
npm run typecheck
npm run package
npm run release:verify-version
```

Expected: all commands exit 0. If any fail, use `superpowers:systematic-debugging` before changing implementation code.

- [ ] **Step 4: Write the required implementation report**

Create `docs/design-audit/2026-07-10-maia-violet-ui-implementation-report.md`:

```markdown
# UI IMPLEMENTATION REPORT — Vetka Desktop Maia/Violet

## Design system applied
- Maia / Violet / Inter / Lucide / Default Radius / Default-Solid Menu / Subtle Accent / light-only mode.

## Shared patterns
- AppShell, PageHeader, PageToolbar, TableSurface, StatCard, ChartCard, FormSection, EmptyState, DetailSheet.

## Screens migrated
- Favorites, Dolls, Orders, doll detail, order detail, Settings, Add Doll dialog, Create Order sheet.

## Verification evidence
- Unit tests: `<actual command and result>`.
- Lint/typecheck/package/release verification: `<actual command and result>`.
- Visual QA: 1080×720, 1280×800, and 1440×900 in expanded and collapsed sidebar states; screenshots stored in `docs/design-audit/visual-qa/`.

## Known limitations
- Mobile and tablet layouts are intentionally not polished in V0.
- `<only genuine remaining limitations; otherwise write “None.”>`
```

- [ ] **Step 5: Commit final UI evidence**

```powershell
git add apps/desktop/tests/visual docs/design-audit/visual-qa docs/design-audit/2026-07-10-maia-violet-ui-implementation-report.md
git commit -m "test(ui): verify Maia Violet desktop redesign"
```

## Plan self-review

### Spec coverage

- Locked Maia/Violet/Inter/Lucide/light foundation: Task 2.
- Archive rules, official block inspection, and UI DECISION report: Task 1.
- Reusable product-level patterns: Task 3.
- Expanded/collapsed non-clipping shell: Task 4 and Task 8.
- Favorites, Dolls, and Orders compositions: Task 5.
- Doll detail, chart, regions, and order detail: Task 6.
- Settings, add-doll dialog, create-order sheet: Task 7.
- Loading/empty/populated/error/pending/long-content/partial-data checks: Tasks 5–8.
- Required desktop visual QA, Electron package, and final UI IMPLEMENTATION REPORT: Task 8.
- No business logic, route, IPC, SQLite, collector, calculation, or updater changes: repeated global constraint and preserved feature interfaces in Tasks 4–7.

### Placeholder scan

The plan contains no deferred implementation markers. Angle-bracket values occur only in the pre-code UI DECISION/IMPLEMENTATION report templates where an execution agent records the actual official block names and command outputs; they are not implementation work.

### Type consistency

- Pattern exports in Task 3 are the names consumed by Tasks 4–7.
- Existing `window.vetka` API calls, FormData field names, route paths, and shared contract types remain unchanged.
- Visual test lives under `apps/desktop/tests/visual`, matching the app-local test structure and the Task 1/8 paths.
