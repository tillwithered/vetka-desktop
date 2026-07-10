---
name: product-ui
description: Use for any task that creates, changes, reviews, or fixes Vetka Desktop application UI, layouts, dashboards, navigation, forms, tables, charts, responsive states, or visual styling.
---

# Vetka Product UI implementation system

## Objective

Build production UI at or above official shadcn `dashboard-01` quality using the locked Maia/Violet/Inter/Lucide/Default-Radius/Solid-Menu/Subtle-Accent preset. Keep balanced SaaS density: compact operational controls without turning the product into a spreadsheet.

Before page-level work inspect `assets/dashboard-01-reference.png` as a positive reference and `assets/sidebar-collapse-bug-reference.png` as an anti-reference.

## Required workflow

1. Read `apps/desktop/components.json`, nearby screens, `components/patterns/**`, theme tokens, test infrastructure, and this skill.
2. Write a UI DECISION containing surface type, user job, primary action, existing pattern, registry candidates, selected pattern, component map, desktop strategy, states, and deviations.
3. Inspect at least three plausible official shadcn candidates for page-level work; use `view` or `--dry-run` before adding components.
4. Choose in this order: local pattern, existing composition, official block, official primitives, small product wrapper, custom UI only if all earlier options fail.
5. Test behavior first, then implement the smallest composition that passes.

## Composition rules

- Use existing `components/ui/**` primitives; do not build a parallel design system.
- Put reusable product compositions in `components/patterns/**`: AppShell, PageHeader, PageToolbar, FilterBar, TableSurface, StatCard, ChartCard, FormSection, EmptyState, DetailSheet, and ConfirmDialog when required.
- Use built-in variants and size props. `sm` is for table/sidebar/toolbar/filter controls; `default` is for forms/primary actions; `lg` is prohibited in ordinary product UI.
- Do not add local `h-*`, `min-h-*`, or oversized padding to controls. Buttons are content-sized. Search inputs are bounded.
- Use page inset and major section gap of 24 px, related groups at 12–16 px, inline groups at 8 px.
- Constrain forms to 640–672 px and settings/details to 896 px. Tables and charts may fill available width.
- Use one page title, at most one useful description, and one primary action per visual region. Remove filler copy.
- Prefer sections, separators, and table surfaces over nested Card stacks. A Card represents a genuinely bounded concept.
- Use semantic tokens, Lucide icons, visible focus styles, and accessible names for all controls. Tooltip supplements icon rails but never carries sole critical meaning.

## Interaction and state rules

- Use Table for static data; use a TanStack DataTable only for sorting, filtering, pagination, row selection, visibility, reordering, or bulk actions.
- Use Badge for actual status/category, Empty for empty collections, Skeleton for loading structure, Alert for persistent errors, Sonner for transient feedback, and AlertDialog for destructive confirmation.
- Forms use FieldGroup and Field; every input is labelled and errors remain near the affected field.
- Collapsed sidebar is an icon-only composition: hide expanded-only content, preserve accessible names/tooltips, never use overflow clipping as a fix.
- Cover loading, empty, populated, error, disabled/pending, long-content, and partial-region states when applicable.

## Visual quality gate

Run tests, lint, typecheck, package, and visual QA in Electron at 1080×720, 1280×800, and 1440×900. Inspect sidebar expanded/collapsed, long text, empty/loading/error states, page-level overflow, component density, radius consistency, token use, and compare against both reference images. Reject UI containing oversized/full-width desktop actions, clipping, raw palette colors, unnecessary cards, mixed APIs/icon families, or only ideal populated states.
