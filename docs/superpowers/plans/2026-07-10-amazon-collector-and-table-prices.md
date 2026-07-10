# Amazon Collector and Table Prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect Amazon prices invisibly and present current regional prices in the dolls table.

**Architecture:** The collector owns an isolated packaged Playwright Chromium and recreates closed contexts before a single retry. A batch price-summary IPC endpoint supplies the table once; a shadcn Collapsible exposes regional details per row.

**Tech Stack:** Electron Forge, Playwright, SQLite, React, TanStack Query, shadcn/ui.

## Global Constraints

- Windows x64 desktop only; preserve Maia/Violet/Inter/Lucide design system.
- Do not use the user's Chrome profile or show a browser except for CAPTCHA.
- Persist only verified New/in-stock offers; batch price lookup must avoid per-row IPC calls.

---

### Task 1: Hidden resilient collector

**Files:**
- Modify: `apps/desktop/src/collector/browser.ts`
- Modify: `apps/desktop/forge.config.ts`, `.github/workflows/release.yml`
- Test: `apps/desktop/tests/collector/browser.test.ts`

- [ ] Write failing tests for a closed context and an aborted navigation; expect one new context and one retry.
- [ ] Add browser-runtime lookup from Electron resources, launch isolated Chromium headless, and retain a visible page only for CAPTCHA.
- [ ] Recreate a closed context and retry one transient `ERR_ABORTED`/detached-frame navigation; return the second failure.
- [ ] Run `npm.cmd test -- tests/collector/browser.test.ts` and commit `fix: run Amazon collection in hidden Chromium`.

### Task 2: Batch current-price contract

**Files:**
- Modify: `apps/desktop/src/main/prices/repository.ts`, `apps/desktop/src/main/ipc/register-ipc.ts`, `apps/desktop/src/preload.ts`, `apps/desktop/src/shared/contracts.ts`
- Test: `apps/desktop/tests/main/prices-repository.test.ts`, `apps/desktop/tests/main/ipc-validation.test.ts`

- [ ] Write failing repository and IPC tests for `currentForDolls(dollIds)` returning grouped verified offers.
- [ ] Implement one SQL query keyed by doll id and expose `window.vetka.prices.currentForDolls(ids)`.
- [ ] Run the two focused tests and commit `feat: expose batch current prices`.

### Task 3: Expandable table prices

**Files:**
- Create: `apps/desktop/src/components/ui/collapsible.tsx`
- Modify: `apps/desktop/src/renderer/features/dolls/dolls-page.tsx`, `apps/desktop/src/renderer/features/dolls/doll-table.tsx`
- Test: `apps/desktop/tests/renderer/doll-table.test.tsx`

- [ ] Inspect and add the official shadcn Collapsible primitive.
- [ ] Write renderer tests for compact price, empty price, and expanded regional offers.
- [ ] Fetch the batch summary once in `DollsPage`; render a compact `Цены` column and a colSpan expanded row with region, amount, KZT, freshness and link.
- [ ] Run focused renderer tests and commit `feat: show expandable regional prices in catalog`.

### Task 4: Release verification

- [ ] Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, and `npm.cmd run package` from `apps/desktop`.
- [ ] Inspect Electron at 1080×720, 1280×800 and 1440×900; verify no visible browser on normal scanning and no horizontal table breakage.
- [ ] Bump patch version, commit, push tag, and verify release assets include Chromium runtime.
