# Doll profile and confirmed prices design

## Goal

Show verified Amazon prices immediately in the operational catalog and turn the doll detail page into a useful profile without hiding the regional offer list.

## Confirmed-price rule

The catalog collector already accepts an offer only after its fact-triangle decision is `verified`. That deterministic result must create a `confirmed` Amazon listing with `confirmationSource: 'deterministic_match'`. A generic manual doll refresh retains the existing `candidate` flow for title-only review candidates. `PriceRepository.current()` deliberately reads confirmed listings, so this transition makes verified catalog prices visible in the table, detail page, and order form.

## Doll detail composition

The page keeps one title and the existing compact actions. Below it:

1. A two-column desktop grid places the new **About the doll** section on the left and the existing **Amazon regions** section on the right.
2. About the doll contains a 144px thumbnail or a neutral image placeholder, followed by character, series, generation, Mattel SKU, and UPC/EAN. Missing values render as an em dash, never as empty controls.
3. The existing **Price history** chart moves below that grid and spans the content width. The regional list is unchanged and remains the primary current-price surface.

## States and constraints

- Manual `imagePath` and Amazon thumbnail use the already persisted `Doll.imagePath`; no image mutation is introduced by the page.
- Use only existing shadcn primitives: `Card`, `Badge`, `Separator`, and Lucide `ImageIcon`.
- Maintain the Maia/Violet desktop density: 24px section gap, 12–16px grouped gaps, no tabs, no oversized controls.
- Tests cover deterministic confirmation, screenshot-independent identity content, thumbnail, placeholder, and unchanged regional offer surface.
