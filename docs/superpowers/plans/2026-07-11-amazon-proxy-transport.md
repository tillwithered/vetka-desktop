# Amazon Proxy Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure, provider-neutral sticky residential proxy routing to Vetka's own official Store collector.

**Architecture:** Encrypted proxy routes live behind a main-process repository and expose only redacted metadata through a dedicated IPC surface. The collector control message carries an already-resolved route to the utility process; the browser creates an isolated persistent context for the route. Store collection retries once on a different route only for recognised network blocks.

**Tech Stack:** Electron safeStorage, SQLite settings table, TypeScript, Playwright Core, React, shadcn/ui, Vitest.

## Global Constraints

- Only official Monster High Amazon Store pages are collected.
- No proxy URL, username, password, or encrypted payload reaches renderer state, generic settings IPC, logs, or error text.
- Use native Playwright HTTP(S) proxy support; do not add browser stealth or provider SDK dependencies.
- A route is sticky for a region and rotates only after CAPTCHA, 429, or 5xx.
- Use existing Maia/Violet/shadcn primitives; settings stays within 896 px desktop width.
- Tests are written and observed failing before implementation changes.

---

### Task 1: Define private routes and public redacted state

**Files:**
- Create: `apps/desktop/src/main/collector/proxy-transport.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Test: `apps/desktop/tests/main/proxy-transport.test.ts`

**Interfaces:**
- Produces `ProxyRoute`, `AmazonProxyTransport`, `parseProxyRoute`, `redactProxyRoute`, and `ProxyRouteSelector`.
- Consumed by IPC registration and `CollectorClient`.

- [ ] **Step 1: Write failing tests** for valid `http://user:password@gateway:port`, malformed/unsupported values, redaction, sticky selection, and advancing a region to its next route.
- [ ] **Step 2: Run** `npm.cmd test -- --run tests/main/proxy-transport.test.ts` and confirm missing-module failure.
- [ ] **Step 3: Implement** URL validation for only `http:`/`https:`, a `ProxyRouteSelector` indexed by `AmazonRegion`, and a public state `{ mode, regions: Record<AmazonRegion, { configured, routeCount, labels }> }` with credentials removed.
- [ ] **Step 4: Re-run** the targeted test and confirm all assertions pass.
- [ ] **Step 5: Commit** the interface and tests.

### Task 2: Encrypt persistence and add isolated IPC

**Files:**
- Create: `apps/desktop/src/main/settings/proxy-transport-repository.ts`
- Modify: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/shared/channels.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `apps/desktop/src/preload.ts`
- Test: `apps/desktop/tests/main/proxy-transport-repository.test.ts`
- Test: `apps/desktop/tests/main/ipc-validation.test.ts`

**Interfaces:**
- Consumes `ProxyRoute` and public transport state from Task 1.
- Produces `getPublicState()`, `getResolvedRoutes()`, and `replaceRoutes(input)`.

- [ ] **Step 1: Write failing tests** proving encrypted values differ from the original URL, decrypted resolved routes restore credentials, `getAll()` has no secret key, and invalid proxy input returns validation error.
- [ ] **Step 2: Run** the two test files and confirm failures name the missing repository/channels.
- [ ] **Step 3: Implement** a repository backed by `safeStorage.encryptString/decryptString`, storing a base64 encrypted payload under a dedicated settings key and exposing dedicated get/set IPC handlers only.
- [ ] **Step 4: Re-run** targeted tests and confirm passing output.
- [ ] **Step 5: Commit** encrypted persistence and IPC changes.

### Task 3: Pass routes into the collector and create proxy-isolated contexts

**Files:**
- Modify: `apps/desktop/src/collector/contracts.ts`
- Modify: `apps/desktop/src/main/collector/client.ts`
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/src/collector/browser.ts`
- Test: `apps/desktop/tests/collector/browser.test.ts`
- Test: `apps/desktop/tests/main/collector-client.test.ts`

**Interfaces:**
- Consumes `AmazonProxyTransport` from Task 1/2.
- Produces `BrowserCollectorDriver` contexts configured with `{ server, username, password }` and a profile path keyed by region plus route identity.

- [ ] **Step 1: Write failing tests** for route-bearing control messages, proxy launch options, direct fallback, and distinct persistent profile paths after route changes.
- [ ] **Step 2: Run** browser/client tests and confirm missing route option failures.
- [ ] **Step 3: Implement** a transport provider passed to `CollectorClient`, private control-message transport payload, Playwright launch `proxy`, and context invalidation when the selected route changes.
- [ ] **Step 4: Re-run** targeted tests and confirm passing output.
- [ ] **Step 5: Commit** worker transport wiring.

### Task 4: Retry recognised Store blocks once using the next route

**Files:**
- Modify: `apps/desktop/src/collector/amazon/store-collect.ts`
- Modify: `apps/desktop/src/collector/worker.ts`
- Test: `apps/desktop/tests/collector/official-store-collect.test.ts`
- Test: `apps/desktop/tests/collector/store-error.test.ts`

**Interfaces:**
- Consumes `ProxyRouteSelector` and driver context reset from Task 3.
- Produces one bounded retry result with an opaque `proxy_route_exhausted` diagnostic.

- [ ] **Step 1: Write failing tests** where the first Store response is CAPTCHA and second route response contains a verified Store card; assert two calls, no third retry, and no proxy string in error.
- [ ] **Step 2: Run** collector tests and confirm the first attempt remains blocked.
- [ ] **Step 3: Implement** one route advance on CAPTCHA/429/5xx only, closing the affected context before retry; preserve the final block status if all routes fail.
- [ ] **Step 4: Re-run** collector tests and confirm passing output.
- [ ] **Step 5: Commit** bounded retry behavior.

### Task 5: Add the compact Amazon collector settings section

**Files:**
- Modify: `apps/desktop/src/renderer/features/settings/settings-page.tsx`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `apps/desktop/src/preload.ts`
- Test: `apps/desktop/tests/renderer/settings-page.test.tsx`

**Interfaces:**
- Consumes public proxy transport state and dedicated `window.vetka.collectorTransport.get/set` methods.
- Produces a Direct/Proxy mode, one-line-per-route input per region, save state, redacted configuration state, and validation feedback.

- [ ] **Step 1: Write failing renderer tests** for Direct default, proxy switch, disabled Save while saving, redacted configured labels, and validation feedback.
- [ ] **Step 2: Run** `npm.cmd test -- --run tests/renderer/settings-page.test.tsx` and confirm missing control expectations.
- [ ] **Step 3: Implement** the new `FormSection` using existing `Switch`, `Textarea`, `Field`, `Badge`, `Alert`, and `Button`; keep it in the current 896 px settings form and never render saved passwords.
- [ ] **Step 4: Re-run** renderer tests and inspect settings at 1080x720, 1280x800, and 1440x900.
- [ ] **Step 5: Commit** UI and tests.

### Task 6: Verify, package, and run the live probe

**Files:**
- Modify: `apps/desktop/package.json` only if a release version is approved.

- [ ] **Step 1: Run** `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run typecheck` from `apps/desktop`; require zero failures.
- [ ] **Step 2: Run** `npm.cmd run package`; inspect the packaged Electron app for startup and renderer health.
- [ ] **Step 3: Configure supplied residential proxy routes for UK, ES, and IT through Settings; invoke a Store refresh and record only region/status/count/price evidence.
- [ ] **Step 4: Confirm** no proxy secret appears in SQLite generic settings output, renderer state, console, or collector errors.
- [ ] **Step 5: Commit and publish** only after all automated checks and live region probe pass.
