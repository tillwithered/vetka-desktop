# Vetka Desktop instructions

## Product UI

For every visible UI task, read `.agents/skills/product-ui/SKILL.md` before planning or editing code.

The visual preset is locked to Maia, Violet, Inter, Lucide, Default Radius, Default/Solid Menu, and Subtle Accent. Do not add another UI library or mix Base and Radix APIs. Use official shadcn primitives from `apps/desktop/src/components/ui/**` and compose stable product-level patterns in `apps/desktop/src/components/patterns/**`.

Use this choice order: approved local pattern, existing composition, complete official shadcn block, official primitives, a small product wrapper, then custom UI only when necessary. The official shadcn `dashboard-01` block is the quality floor.

Use `sm` controls for sidebars, tables, toolbars, filters, and secondary actions; use `default` for forms and primary actions. Do not use `lg` in ordinary application UI. Buttons are content-sized and simple fields have bounded content widths. Use semantic tokens and Lucide only; do not introduce raw palette colors or one-off component height overrides.

Desktop composition targets: 24 px page inset and major sections, 12–16 px related groups, 8 px inline groups. Forms are 640–672 px, settings/details 896 px, and tables/charts use available width. Light mode is the only V0 color mode.

Collapsed sidebars are a separate icon-rail composition. Expanded-only text, brand cards, badges, descriptions, and wide controls must not be clipped or merely hidden by overflow. Icon-only controls require accessible names and desktop tooltips.

Every data-driven surface supports applicable loading, empty, populated, error, disabled/pending, long-content, and partial-data states. Before completion, check expanded and collapsed sidebar states plus Electron at 1080×720, 1280×800, and 1440×900. Mobile/tablet polishing is intentionally out of scope for this V0 redesign.

Do not modify business routes, IPC contracts, SQLite, Amazon collection, calculations, or updater behavior for UI-only work. Final UI handoff must include local/registry patterns inspected, design-system deviations, widths and states checked, and test/lint/typecheck/visual checks.
