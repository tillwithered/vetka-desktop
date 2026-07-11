# Amazon proxy transport design

## Goal

Make Vetka's own official Monster High Store collector able to use residential proxy routes without buying price data from an API. A route stays sticky for one Amazon region and rotates only after a CAPTCHA, a block, or a transient request failure.

## Scope

- The collector continues to parse only official Monster High Store pages and their verified product fallbacks.
- The app stores one or more HTTP(S) proxy URLs per Amazon region.
- URLs contain credentials, but credentials must never reach the renderer, `settings.getAll`, logs, error messages, or diagnostics.
- On Windows, secrets are encrypted with Electron `safeStorage`; metadata visible to the renderer is only `configured`, `routeCount`, and redacted host labels.
- Direct transport remains the zero-configuration fallback.
- Each region has an active route index. The index is sticky while requests succeed. A region advances to the next route only after a known blocked/transient result. If every route failed, the result remains blocked; no request loop is created.
- A new persistent browser context is launched when its route changes, so cookies never cross proxy identities.

## Out of scope

- CAPTCHA-solving services, account login, free/Tor proxies, hidden anti-detection packages, third-party price APIs, proxy-provider-specific APIs, and automatic purchase of proxy service.
- Claiming live Amazon success without user-supplied residential proxy routes and an end-to-end probe.

## Architecture

`ProxyTransportRepository` owns encrypted database values and redacted public state. `CollectorClient` obtains a resolved per-region route only in the Electron main process and embeds it in the private worker control message. The utility-process worker passes the route to `BrowserCollectorDriver`; the driver uses Playwright's native `proxy` launch option and maintains an isolated profile directory for `(region, route index)`.

The Store collection loop reports an explicit retryable transport result. For a route that receives a CAPTCHA, 429, or 5xx response, the worker closes its browser context, advances its in-memory route index once, and retries the same Store request. It never publishes proxy URL, credentials, or provider response text.

## UI

Settings gains a bounded `Amazon collector` FormSection below currencies and above application updates. It has a Direct / Proxy switch, five compact textareas (one for each Amazon region; one URL per line), a terse explanation of sticky routing, redacted saved-state labels, and Save. Empty regions use Direct mode rather than a broken proxy. The existing Maia/Violet/shadcn components remain the only UI primitives.

## Verification

- Unit tests prove URL parsing/redaction, encrypted secret storage, stable selection, one-step rotation, and no secret exposure through generic settings IPC.
- Browser tests prove a selected route becomes Playwright's proxy option and route change produces a fresh profile/context.
- Collector tests prove a Store CAPTCHA switches route exactly once and then persists a verified Store card.
- Renderer tests cover Direct, configured Proxy, empty-region fallback, validation error, and saving state.
- Final verification includes lint, all tests, typecheck, package inspection, and one live UK/ES/IT Store probe using supplied residential routes.
