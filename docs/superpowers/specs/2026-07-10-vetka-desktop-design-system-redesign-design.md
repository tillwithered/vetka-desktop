# Vetka Desktop — Maia/Violet design system and frontend redesign

Date: 2026-07-10

Status: proposed for written approval

Scope: `apps/desktop` renderer UI only

## 1. Outcome

Replace the current loosely composed interface with one coherent desktop product system that makes Violet's daily Amazon-doll workflow compact, legible, and fast.

This redesign must:

- use the supplied Vetka design-system archive as the primary UI source of truth;
- use shadcn/ui only, with the locked Maia/Violet preset and official component APIs;
- remove oversized controls, oversized empty containers, and unstructured vertical Card stacks;
- establish reusable product-level patterns before screen-specific markup;
- preserve the existing routes, data model, Electron IPC, SQLite behavior, Amazon logic, and business calculations;
- work reliably at the real desktop window sizes used by the Electron application.

The redesign does not add new business features. It gives the existing V0 workflow a coherent shell and reusable visual language.

## 2. Sources and precedence

The implementation follows this precedence order:

1. Rules in the user-supplied `codex-shadcn-design-system.zip` archive.
2. Approved local product patterns in `apps/desktop/src/components/patterns/**`.
3. Existing Vetka compositions that already satisfy the new rules.
4. The closest complete official shadcn block.
5. A composition of official shadcn primitives.
6. A small local wrapper around official primitives.
7. Custom UI only where the preceding options cannot express the required behavior.

The official shadcn `dashboard-01` block is the minimum quality reference. Before implementation, the agent must inspect `dashboard-01` and at least two relevant official block candidates for the shell, tables, forms, or charts.

[shadcnblocks.com](https://shadcnblocks.com/) may inform hierarchy and composition, particularly its application-shell, dashboard, data-table, chart, product, order-history, and settings examples. Its Pro source code must not be copied.

## 3. Locked visual preset

The product preset is fixed:

| Setting | Value |
|---|---|
| shadcn style | Maia |
| theme and chart color | Violet |
| heading font | Inter |
| body font | Inter |
| icon library | Lucide |
| radius | Default |
| menu | Default / Solid |
| menu accent | Subtle |
| color mode | Light only for V0 |

The user's shadcn preset screenshot displays the code `b5wOkSNVY`. The implementation must verify that code with the current official shadcn CLI before applying it. If it does not resolve to the locked settings above, use the explicit settings rather than guessing or silently accepting a different preset.

The existing `radix-nova`/neutral/Geist setup is therefore intentionally replaced. The application must not mix incompatible Base and Radix component APIs during migration.

## 4. Design principles

### 4.1 Balanced desktop density

The interface uses moderate SaaS density: compact enough for daily operational work, but not a cramped spreadsheet clone.

- Toolbar, sidebar, table, and filter controls use the primitive's `sm` size.
- Forms and primary actions use the primitive's `default` size.
- `lg` controls are not used in normal product UI.
- Buttons are content-sized unless their composition explicitly requires equal widths.
- No local fixed heights or padding are introduced merely to make controls look larger.

### 4.2 Spacing rhythm

Use the following composition rhythm rather than arbitrary per-screen spacing:

- desktop page inset: 24 px;
- major section gap: 24 px;
- related component group: 12–16 px;
- compact inline group: 8 px.

Sidebar navigation must have an explicit, repeated vertical rhythm. A brand area, navigation group, quick action, and footer must not visually run into one another.

### 4.3 Content width

- simple forms: 640–672 px;
- settings and detail content: up to 896 px;
- reading content: up to 720 px;
- tables, charts, dashboards: full available content width.

A simple input must never stretch across the viewport just because its parent is wide. Numeric fields use a width appropriate to their expected value.

### 4.4 Typography

- page title: 20–24 px;
- section title: 16–18 px;
- body and controls: 14 px;
- metadata: 12–14 px.

Typography establishes hierarchy before borders and nested Cards do. Headings remain concise; supporting copy is muted and limited to text that helps Violet act.

### 4.5 Color, icons, and surfaces

- Use semantic theme tokens only; do not use raw Violet or neutral palette values in product components.
- Violet identifies primary action, selection, focus, and chart emphasis; it is not decorative background paint.
- Use Lucide icons only.
- Prefer page sections, separators, toolbars, and table surfaces over wrapping every block in a Card.
- Cards are reserved for grouped summaries, charts, and truly bounded concepts.

## 5. Product pattern layer

The redesign first creates or normalizes these shared patterns in `apps/desktop/src/components/patterns/**`:

### `AppShell`

Owns the expanded and collapsed sidebar compositions, main content frame, sidebar trigger, page context, and desktop overflow behavior. Expanded-only labels and brand text are absent from the collapsed DOM composition rather than clipped behind overflow.

### `PageHeader`

Provides title, optional short description, contextual metadata, and one compact action group. It replaces the empty 48 px top bar and oversized title areas.

### `PageToolbar`

Provides bounded search, filters, view actions, and secondary commands in one coherent row. It supports wrapping at the minimum desktop width without turning into a mobile layout.

### `FilterBar`

Provides repeatable filter groups, active-state clarity, reset behavior, and predictable `sm` sizing when a screen needs more than a simple toolbar filter.

### `DataTable` or `TableSurface`

Use the basic shadcn Table for straightforward display. Use a TanStack-backed DataTable only when the existing screen genuinely needs sorting, filtering, pagination, row selection, or comparable interaction. The wrapper owns density, empty rows, column alignment, long-content handling, and action placement.

### `StatCard`

A compact metric block with label, value, optional trend/context, and no decorative empty space. Metrics are used only when they help with the current workflow.

### `ChartCard`

A bounded chart composition with title, current value/context, time-range control when supported, loading/empty/error states, and accessible textual context.

### `FormSection`

Groups a heading, brief explanation, and `FieldGroup`/`Field` controls within the correct content width. It replaces arbitrary settings Cards and viewport-wide fields.

### `EmptyState`

A bounded, concise state with an optional Lucide icon, one explanation, and at most one primary action plus one secondary action. It must not consume the full remaining viewport by default.

### `DetailSheet`

A consistent side-sheet composition for entity details and focused edits where a route change is unnecessary. It owns header, scroll region, section rhythm, and footer actions.

### `ConfirmDialog`

Used only for destructive or irreversible actions that exist in the current product. It is not required for ordinary saves or navigation.

These patterns may compose official primitives but must not fork or restyle those primitives locally without a demonstrated gap.

## 6. Application shell

The shell is a quiet operational frame, not a dashboard hero.

### Expanded sidebar

- Compact Vetka mark/name; remove the large brand Card.
- A visible quick action, `Добавить куклу`, placed near the navigation rather than isolated in a large block.
- Navigation items use `sm` sizing, Lucide icons, subtle active accent, and explicit vertical spacing.
- Footer contains only genuinely useful secondary destinations/status.

### Collapsed sidebar

- A separate icon-only composition, not the expanded sidebar squeezed into a narrow width.
- No clipped `VETKA`, `рабочее место`, badges, or action labels.
- Icon buttons have accessible names and tooltips.
- Active state remains visible without relying on text.

Any clipping or horizontal overflow in the collapsed rail is a release-blocking defect.

### Main content

- Remove the current empty top bar used only for a sidebar trigger.
- Integrate the trigger with the page context/header.
- Use a 24 px desktop inset and a 24 px major-section rhythm.
- Avoid page-level horizontal scrolling at supported desktop widths; a wide table may own an internal scroll region if necessary.

## 7. Screen compositions

### 7.1 Favorites / home

The screen begins with a compact `PageHeader` and the action relevant to the current collection. A small metric strip follows only for useful counts or price freshness. The main working area is a table/list of favorite dolls and price status.

When empty, show a bounded `EmptyState` with one primary action to add or find a doll. Do not render large empty metric Cards above a viewport-sized empty panel.

### 7.2 Dolls catalog

- `PageHeader`: `Куклы` plus `Добавить куклу`.
- `PageToolbar`: bounded search, relevant filters, refresh/secondary action.
- Main area: table/list without an unnecessary outer Card.
- Row hierarchy prioritizes doll identity, Amazon region/availability, current price, freshness, and contextual actions already supported by the application.
- Long titles truncate or wrap intentionally without pushing actions off screen.

### 7.3 Orders

- Compact `PageHeader` with the existing create-order action where applicable.
- Toolbar combines client/contact search and status filtering.
- Table shows the Telegram contact as the client field, doll, financial summary, order status, relevant date, and contextual actions.
- Status uses semantic Badge variants and text; color alone never carries status meaning.
- Empty and filtered-empty states are distinct.

### 7.4 Doll detail

- Compact entity header with doll name, key metadata, and action group.
- Primary action: `Создать заказ`.
- Secondary action: price refresh.
- Main composition: price history chart in the wider column; current Amazon regions/prices in a narrower side column.
- Price freshness and source/region are visible near each value.
- Loading, no-price-history, partial-region, and refresh-error states occupy their respective sections rather than replacing the whole screen.

### 7.5 Order detail

- Header combines order identity, Telegram contact, and status.
- A compact financial summary presents the existing calculated values.
- Delivery information and order timeline/status history form the primary content hierarchy.
- Avoid representing each single value as an independent generic Card.

### 7.6 Settings

- Content width is capped at 896 px.
- Related settings are grouped with `FormSection`.
- Forms use `FieldGroup` and `Field`.
- Numeric inputs use natural, bounded widths.
- Save/reset actions form one coherent action bar and expose pending/success/error feedback supported by the application.

### 7.7 Dialogs and sheets

- Use shadcn Dialog/Sheet compositions and `FieldGroup` forms.
- Footer buttons remain content-sized.
- Primary action is visually clear but not oversized.
- Validation and async failure messages sit next to the affected form or action.

## 8. State and interaction contract

Each affected screen or pattern must handle every applicable state:

- loading;
- empty;
- populated;
- error;
- disabled/pending;
- long titles, long Telegram contacts, and long numeric values;
- partial Amazon-region data.

Permission states are out of scope because V0 has no role/auth model. Destructive confirmation is implemented only where an existing destructive action warrants it.

Keyboard focus must remain visible through semantic focus tokens. Icon-only controls require accessible names. Tooltips supplement collapsed navigation but do not replace accessible labels. Tables retain meaningful headers, and charts provide adjacent textual price/current-state context.

## 9. Desktop boundary

This is intentionally desktop-first. Mandatory visual QA sizes are:

- 1080 × 720 — minimum supported desktop window;
- 1280 × 800 — standard working size;
- 1440 × 900 — wide working size.

Mobile and tablet layouts are not designed or polished in this phase. The renderer should still avoid catastrophic page-level overflow, but the work does not add mobile navigation, mobile table replacements, or breakpoint-specific tablet compositions.

## 10. Migration strategy

1. Preserve a baseline screenshot set for current Favorites, Dolls, Orders, and Settings screens.
2. Verify the official preset and inspect the required official shadcn block candidates.
3. Add the archive's durable repository instructions and reference assets, merging rather than blindly overwriting existing project guidance.
4. Apply the locked Maia/Violet/Inter preset and reconcile generated primitive changes deliberately.
5. Build and test the product pattern layer.
6. Migrate the shell first, including both sidebar states.
7. Migrate list screens, then details, settings, dialogs, and sheets.
8. Verify relevant states and supported desktop sizes in the real Electron application.

Generated shadcn changes must be reviewed before acceptance. Existing business logic and data access must not be rewritten merely to make the visual migration easier.

## 11. Verification and acceptance

Before implementation begins, provide a concise `UI DECISION` report covering:

- the official blocks inspected;
- the selected product patterns and why they are sufficient;
- the primitive variants/sizes used;
- the expected state coverage;
- any justified custom composition.

Implementation is accepted only when:

- the app uses Maia/Violet/Inter/Lucide and light mode as specified;
- ordinary controls use official `sm`/`default` sizes and no unexplained local height hacks;
- the sidebar has a clear navigation rhythm and a non-clipping icon-only collapsed composition;
- page hierarchy is built from headers, toolbars, sections, tables, and charts rather than repeated generic Card stacks;
- simple forms and numeric inputs respect their width tiers;
- Favorites, Dolls, Orders, doll detail, order detail, Settings, and applicable dialogs/sheets follow the compositions above without changing their business behavior;
- loading, empty, populated, error, disabled/pending, long-content, and partial-data states are verified where applicable;
- the real Electron app is visually checked at 1080×720, 1280×800, and 1440×900 in both expanded and collapsed sidebar states;
- automated tests, type checks, lint/build checks, and packaging checks relevant to the changed frontend pass;
- visual comparison uses the stored baseline and the selected official/reference screenshots, not screenshots in isolation;
- the final handoff includes a `UI IMPLEMENTATION REPORT` listing changed patterns/screens, verification evidence, and any remaining limitations.

## 12. Explicit non-goals

- Mobile or tablet product design.
- New routes or new customer-facing functionality.
- Changes to Amazon parsing, data synchronization, SQLite schema, IPC contracts, price calculations, or updater behavior unless a compatibility fix is strictly required by the UI migration.
- Dark mode.
- A second component library.
- Copying shadcnblocks Pro implementation code.
- Premature abstraction for hypothetical future catalog or client features.
