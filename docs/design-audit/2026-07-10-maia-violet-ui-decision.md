# UI DECISION — Vetka Desktop Maia/Violet migration

## Screen or surface type

Desktop operational workspace with a persistent navigation shell, compact lists, price detail, order detail, and bounded settings/forms.

## Primary user job

Violet needs to inspect current Amazon prices, keep a focused working list of dolls, and turn a verified offer into a correctly calculated customer order without losing context.

## Primary action

`Добавить куклу` from the shell/list context; `Создать заказ` from a doll with a verified offer.

## Existing local pattern

The renderer already uses shadcn Radix primitives, React Query feature modules, route-level pages, `FieldGroup` forms, basic Tables, Charts, and a collapsible Sidebar. It does not yet have stable product compositions and uses an oversized Card-first layout.

## Registry candidates reviewed

- Official shadcn `dashboard-01`: compact operational hierarchy of sidebar, toolbar, data table, and chart.
- Official Sidebar primitives with `variant="inset"` and `collapsible="icon"`: separate desktop shell and icon rail contract.
- Official Chart/Table/Field primitives: price-history chart, working lists, and bounded forms without custom component-library code.
- shadcnblocks application-shell and dashboard/table references: composition only; no source code is copied.

## Selected pattern

Use a thin local product pattern layer over the existing official primitives: `AppShell`, `PageHeader`, `PageToolbar`, `TableSurface`, `StatCard`, `ChartCard`, `FormSection`, `EmptyState`, and `DetailSheet`. A small basic Table remains correct because current V0 lists do not provide sorting, pagination, selection, or server-side status filtering contracts.

## Component map

- SidebarProvider/Sidebar/SidebarInset/SidebarTrigger: AppShell.
- Button/Input/Select/Badge/Table: compact toolbars and list actions.
- Card: only summaries and chart calculation contexts.
- ChartContainer/Recharts: price history.
- FieldGroup/Field: settings, add-doll, and create-order inputs.
- Empty/Skeleton/Alert/Sonner: data and asynchronous states.

## Responsive strategy

Desktop-first at 1080×720, 1280×800, and 1440×900. Toolbars may wrap and tables own internal horizontal scrolling if required; the page itself must not scroll horizontally. Mobile/tablet layouts are not polished in this V0 scope.

## Required states

Loading, empty, populated, error, disabled/pending, long title/contact/seller content, and partial Amazon region data. Permission state is not applicable because V0 has no roles. Destructive confirmation is used only if an existing destructive action requires it.

## Necessary deviations

No new routes or data contracts. Product patterns own spacing and hierarchy only; all interactive behavior remains in official shadcn primitives and existing feature modules.
