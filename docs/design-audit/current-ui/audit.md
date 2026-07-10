# Vetka Desktop Frontend Audit

Audit date: 2026-07-10

Evidence:

1. `01-favorites.png` — Favorites dashboard and empty working list.
2. `02-dolls.png` — Doll catalog empty state.
3. `03-orders.png` — Orders empty state.
4. `04-settings.png` — Exchange rates, shipping defaults, and local-data settings.

## Overall verdict

The application uses shadcn/ui primitives, but it does not yet have a product-level design system. Component geometry comes from the `radix-nova` preset while page spacing, widths, hierarchy, empty states, and action placement are decided independently in each route. The result is technically consistent at the primitive level but visually inconsistent at the screen level.

## Step 1 — Favorites

Health: needs structural revision.

- The empty 48 px top bar reserves a full horizontal band for one sidebar trigger and weakens the page hierarchy.
- Three equally weighted metric cards dominate the first viewport even when every value is zero.
- The primary `Добавить куклу` action appears twice in the same empty state.
- The working-list card is much taller than its content and creates a large inactive surface.
- The page has no stable content grid or bounded working width; cards simply expand to the available desktop canvas.

## Step 2 — Dolls

Health: needs a proper list toolbar and empty composition.

- Search is embedded inside a large card header instead of behaving as a compact table/list toolbar.
- The page-level add action is absent even though adding a doll is the main recovery action for an empty catalog.
- The empty state is a single line centered inside a wide card, with no useful next action.
- Header, toolbar, results, and empty state do not form one clear working surface.

## Step 3 — Orders

Health: understandable but oversized.

- Search, count, and the empty-state explanation occupy one broad card with excessive unused width and height.
- The empty state explains the dependency on a confirmed doll price, but offers no direct supporting action or contextual link.
- The composition repeats the Dolls screen instead of using order-specific status filters and workflow cues.

## Step 4 — Settings

Health: functional, but form sizing and actions need rules.

- Inputs expand to roughly 500 px even for short numeric values such as exchange rates and weight.
- Two cards share the row but have different information density, leaving unbalanced empty space.
- The save action floats below the cards instead of belonging to a consistent form action bar.
- Local-data information is styled as another card although it is supporting context rather than an editable section.

## Cross-screen findings

- Sidebar navigation items have no explicit vertical rhythm between destinations.
- The large brand card competes with navigation and consumes valuable vertical space.
- Page padding is consistently 24 px, but internal gaps alternate between 16 and 24 px without semantic rules.
- Button and input size come from primitives, while page-specific overrides create inconsistent perceived scale.
- Repeated `Card` containers substitute for screen composition; there are no shared page header, toolbar, KPI, split-pane, form-section, or action-bar recipes.
- Dark neutral styling provides little product identity and does not match the requested Maia + Violet direction.

## Accessibility evidence limits

Screenshots reveal several muted-text contrast risks and small icon-only controls, but they are not enough to verify keyboard order, focus visibility, screen-reader labels, or full WCAG contrast. These require interaction and automated checks after the redesign.
