# Vetka Desktop GitHub Releases and Auto-Updates Implementation Plan

> **For Codex:** Execute this plan inline with `superpowers:executing-plans`. Apply strict red-green-refactor TDD for application behavior and verify every release artifact before publishing.

**Goal:** Publish `tillwithered/vetka-desktop` as a public GitHub repository and make packaged Windows installations safely discover, download, and apply Squirrel.Windows releases.

**Architecture:** A dependency-injected `UpdateService` in Electron's main process owns the updater state machine and feed. Typed IPC exposes read/check/install operations and broadcasts immutable state to a shell-level shadcn notification. GitHub Actions verifies normal changes and publishes only version-matched semantic tags with Squirrel metadata, checksums, and provenance.

**Tech Stack:** Electron 43 `autoUpdater`, Electron Forge 7 Squirrel.Windows, React 19, TypeScript 5, Vitest, Testing Library, shadcn/ui, GitHub Actions, GitHub Releases.

---

## Task 1: Add typed update contracts and prove the state machine

**Files:**
- Create: `apps/desktop/tests/main/update-service.test.ts`
- Create: `apps/desktop/src/main/updates/service.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`

**Step 1: Write the failing state-machine tests**

Create a fake updater adapter with `on`, `setFeedURL`, `checkForUpdates`, and `quitAndInstall` spies. Cover:

- initial `idle` state and HTTPS feed configuration;
- `checking-for-update` -> `checking`;
- `update-available` -> `available` with version;
- `update-downloaded` -> `downloaded` with version;
- `update-not-available` -> `idle`;
- errors -> safe Russian `error` state without the source stack/message;
- duplicate checks while `checking` or `available` do not invoke Electron again;
- `restartAndInstall()` rejects before `downloaded` and invokes `quitAndInstall()` after it.

Run: `npm test -- --run tests/main/update-service.test.ts`

Expected: FAIL because the shared contract and `UpdateService` do not exist.

**Step 2: Add the shared contract**

In `src/shared/contracts.ts`, add the discriminated `UpdateState` union:

- `{ status: 'idle' }`
- `{ status: 'checking' }`
- `{ status: 'available'; version: string | null }`
- `{ status: 'downloaded'; version: string | null }`
- `{ status: 'error'; message: string }`

Add an `updates` group to `VetkaDesktopApi` with `getState`, `check`, `restartAndInstall`, and `onStateChanged`, all using the existing `ApiResult` envelope where a request is involved.

**Step 3: Implement the smallest service**

In `src/main/updates/service.ts`:

- define a narrow `UpdaterAdapter` instead of importing Electron in tests;
- inject `feedUrl`, `packaged`, `firstRun`, `schedule`, and `onStateChanged`;
- bind updater events once;
- make `start()` a no-op outside packaged builds, configure the exact HTTPS feed in packaged builds, and schedule a first check after 10 seconds for `--squirrel-firstrun` (otherwise after the window is ready with a short non-blocking delay);
- expose immutable state through `getState()`;
- suppress duplicate checks during `checking` and `available` (download in progress);
- allow `quitAndInstall()` only from `downloaded`;
- sanitize all updater failures to `Не удалось проверить обновления. Приложение продолжит работать.`.

Run: `npm test -- --run tests/main/update-service.test.ts`

Expected: PASS.

**Step 4: Refactor and typecheck**

Keep Electron-specific event payload shapes at the adapter boundary and never expose raw `Error` values to shared contracts.

Run: `npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/shared/contracts.ts apps/desktop/src/main/updates/service.ts apps/desktop/tests/main/update-service.test.ts
git commit -m "feat: add safe desktop update service"
```

## Task 2: Wire validated IPC and preload boundaries

**Files:**
- Create: `apps/desktop/tests/main/update-ipc.test.ts`
- Modify: `apps/desktop/src/shared/channels.ts`
- Modify: `apps/desktop/src/main/ipc/register-ipc.ts`
- Modify: `apps/desktop/src/preload.ts`

**Step 1: Write failing IPC tests**

Register handlers with a fake `UpdateService` and assert:

- `updatesGetState` returns the typed current state;
- `updatesCheck` delegates once and returns a successful result;
- `updatesRestartAndInstall` returns `UPDATE_NOT_READY` without invoking install before download;
- the handler invokes install only when the service reports `downloaded`;
- thrown updater details are converted to a safe envelope with no `stack` or feed URL.

Run: `npm test -- --run tests/main/update-ipc.test.ts`

Expected: FAIL because update channels and handlers are absent.

**Step 2: Add channels and dependency**

Add `updatesGetState`, `updatesCheck`, `updatesRestartAndInstall`, and `updatesStateChanged` to `src/shared/channels.ts`. Add an optional `updates` dependency to `registerIpcHandlers` so existing repository tests remain focused.

Use a dedicated safe failure mapping for `UPDATE_NOT_READY`; never route raw updater errors into the generic user response.

**Step 3: Expose the narrow preload API**

Implement the four typed functions under `window.vetka.updates`. `onStateChanged` must remove the exact listener and return an unsubscribe callback. Do not expose feed mutation, files, shell, or Electron objects.

Run: `npm test -- --run tests/main/update-ipc.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/desktop/src/shared/channels.ts apps/desktop/src/main/ipc/register-ipc.ts apps/desktop/src/preload.ts apps/desktop/tests/main/update-ipc.test.ts
git commit -m "feat: expose validated update IPC"
```

## Task 3: Integrate Electron autoUpdater in packaged startup

**Files:**
- Create: `apps/desktop/tests/main/update-bootstrap.test.ts`
- Create: `apps/desktop/src/main/updates/electron-adapter.ts`
- Modify: `apps/desktop/src/main.ts`

**Step 1: Write failing bootstrap tests**

Extract pure helpers where needed and test:

- feed URL is exactly `https://update.electronjs.org/tillwithered/vetka-desktop/win32-x64/<encoded-version>`;
- unsupported platforms return no feed;
- `--squirrel-firstrun` is detected from an injected argv;
- broadcasts target all current windows through the typed state channel.

Run: `npm test -- --run tests/main/update-bootstrap.test.ts`

Expected: FAIL because the adapter/bootstrap helpers do not exist.

**Step 2: Implement the Electron adapter and bootstrap**

Wrap Electron `autoUpdater` in `electron-adapter.ts`. In `main.ts`:

- instantiate `UpdateService` only with the exact repository feed;
- pass it into IPC registration;
- broadcast state through `BrowserWindow.getAllWindows()`;
- start it only after the main window reaches `ready-to-show`;
- skip update configuration in development and on unsupported platforms;
- preserve database, collector, and shutdown behavior.

Run: `npm test -- --run tests/main/update-bootstrap.test.ts`

Expected: PASS.

Run: `npm run typecheck && npm run lint`

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/desktop/src/main.ts apps/desktop/src/main/updates/electron-adapter.ts apps/desktop/tests/main/update-bootstrap.test.ts
git commit -m "feat: connect packaged app to GitHub updates"
```

## Task 4: Add the persistent shadcn update notification

**Files:**
- Create: `apps/desktop/tests/renderer/update-notification.test.tsx`
- Create: `apps/desktop/src/renderer/features/updates/update-notification.tsx`
- Modify: `apps/desktop/src/renderer/app.tsx`
- Modify: `apps/desktop/tests/renderer/app-shell.test.tsx`

**Step 1: Write failing renderer tests**

Mock `window.vetka.updates` and prove:

- no prompt is visible for `idle`, `checking`, or `available`;
- a `downloaded` event shows a persistent shadcn alert with version, `Перезапустить сейчас`, and `Позже`;
- `Позже` dismisses only the current prompt;
- a later downloaded event can show it again;
- `Перезапустить сейчас` calls only `restartAndInstall()`;
- an error uses a non-blocking Sonner toast and does not leak raw details;
- unmount calls the subscription cleanup exactly once.

Run: `npm test -- --run tests/renderer/update-notification.test.tsx`

Expected: FAIL because the component is absent.

**Step 2: Implement with installed shadcn primitives**

Compose the existing `Alert`, `Button`, and `Sonner` components. Mount one `UpdateNotification` next to the shell-level `Toaster`; do not introduce custom modal infrastructure or raw HTML controls.

Run: `npm test -- --run tests/renderer/update-notification.test.tsx tests/renderer/app-shell.test.tsx`

Expected: PASS.

Run: `npm run typecheck && npm run lint`

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/features/updates/update-notification.tsx apps/desktop/src/renderer/app.tsx apps/desktop/tests/renderer/update-notification.test.tsx apps/desktop/tests/renderer/app-shell.test.tsx
git commit -m "feat: show downloaded update prompt"
```

## Task 5: Add release validation and GitHub workflows

**Files:**
- Create: `apps/desktop/scripts/verify-release-version.mjs`
- Create: `apps/desktop/tests/release/verify-release-version.test.ts`
- Create: `.github/workflows/verify.yml`
- Create: `.github/workflows/release.yml`
- Create: `.github/dependabot.yml`
- Create: `README.md`
- Modify: `apps/desktop/package.json`

**Step 1: Test tag/package version validation**

Write tests around an exported pure function accepting tag and package version. Accept only exact `vMAJOR.MINOR.PATCH` equality; reject prereleases, malformed tags, and mismatches.

Run: `npm test -- --run tests/release/verify-release-version.test.ts`

Expected: FAIL because the script is absent.

**Step 2: Implement the version check and scripts**

Add a runnable `release:verify-version` package script that reads `GITHUB_REF_NAME` and the local package version, while keeping the validator importable by Vitest.

Run: `$env:GITHUB_REF_NAME='v1.0.0'; npm run release:verify-version`

Expected: PASS and print the verified version.

**Step 3: Add least-privilege verification workflow**

Create `.github/workflows/verify.yml` for pull requests and pushes to `main`:

- `permissions: contents: read`;
- `windows-latest`, Node 22, `npm ci` in `apps/desktop`;
- install Playwright Chromium required by packaging;
- run test, typecheck, lint, and package;
- use immutable action SHAs with version comments.

**Step 4: Add tag-gated release workflow**

Create `.github/workflows/release.yml` for `v*.*.*` tags. It must:

- grant only `contents: write`, `id-token: write`, and `attestations: write` to the release job;
- validate exact tag/package equality before building;
- run the complete suite and `npm run make` on `windows-latest` with Node 22;
- locate exactly one `RELEASES`, one full `.nupkg`, and `VetkaDesktopSetup.exe`;
- generate `SHA256SUMS.txt` with PowerShell;
- attest installer and package subjects;
- create the GitHub Release only after verification, packaging, checksum, and attestation succeed;
- upload `RELEASES`, `.nupkg`, installer, and checksums through `GITHUB_TOKEN` without a PAT.

**Step 5: Document operator and security behavior**

In `README.md`, document local-first storage, install/update behavior, release steps, unsigned-installer warning for V0, the exact files that never enter releases, and future code-signing work. Add Dependabot for monthly npm and GitHub Actions dependency updates.

**Step 6: Validate workflows and scan for placeholders**

Run workflow YAML parsing through an installed parser or a one-shot Node parser, then:

```bash
rg -n "TODO|FIXME|CHANGEME|OWNER/REPO|your-username|example\.com" .github README.md apps/desktop/scripts
```

Expected: no placeholders.

Run: `npm test -- --run tests/release/verify-release-version.test.ts && npm run typecheck && npm run lint`

Expected: PASS.

**Step 7: Commit**

```bash
git add .github README.md apps/desktop/package.json apps/desktop/scripts/verify-release-version.mjs apps/desktop/tests/release/verify-release-version.test.ts
git commit -m "ci: publish verified Windows releases"
```

## Task 6: Verify the complete local release candidate

**Files:**
- Modify only if verification reveals a defect.

**Step 1: Run the full application suite**

From `apps/desktop` run:

```bash
npm test
npm run typecheck
npm run lint
npm run package
npm run make
```

Expected: all commands exit 0.

**Step 2: Inspect Squirrel output**

Confirm `out/make/squirrel.windows/x64/` contains non-empty `RELEASES`, exactly one full `.nupkg`, and `VetkaDesktopSetup.exe`. Confirm the package version is `1.0.0` and the compiled main bundle includes the exact `tillwithered/vetka-desktop` update origin.

**Step 3: Run a packaged smoke test**

Launch the packaged executable, verify the app opens with the existing local workflow intact, and check that an unavailable/offline update feed does not block startup.

**Step 4: Review the diff and history**

Run:

```bash
git status --short
git diff --check
git log --oneline --decorate -8
```

Expected: clean diff checks, intentional commits only.

## Task 7: Create the public repository and publish v1.0.0

**Files:**
- No source changes unless GitHub verification reveals a defect.

**Step 1: Create repository**

Create public `tillwithered/vetka-desktop` with default branch `main`, without GitHub-generated README/license/gitignore because the local repository already owns its history.

**Step 2: Connect and publish main**

Rename the current local branch to `main` if needed, add `origin` as `https://github.com/tillwithered/vetka-desktop.git`, and push the complete local history. Confirm repository visibility and default branch through GitHub.

**Step 3: Observe verification**

Wait for `verify.yml` on `main`. If it fails, inspect the real job logs, make the smallest TDD-backed fix, rerun the full local checks, commit, and push. Do not tag until verification is green.

**Step 4: Publish initial release**

Create annotated tag `v1.0.0` at the verified `main` commit and push it. Wait for `release.yml` to complete.

**Step 5: Verify public acceptance**

Open the public release and confirm it contains non-empty:

- `RELEASES`
- one full `vetka_desktop-1.0.0-full.nupkg`
- `VetkaDesktopSetup.exe`
- `SHA256SUMS.txt`

Confirm the release has build provenance/attestation and the update endpoint resolves release metadata for Windows x64.

**Step 6: Install and record the V0 boundary**

Install `v1.0.0` once on the target Windows device. Because a true auto-update needs a higher version, record v1.0.0 as the installed baseline; the first real patch (`v1.0.1`) is the end-to-end update trial and must prove the same SQLite user-data directory survives restart.

## Final self-review checklist

- Every approved design section maps to a task above: repository model, update states, process boundary, IPC, renderer UX, workflows, security, versioning, acceptance, and failure handling.
- No test relies on live GitHub downloads or imports Electron into the pure state-machine suite.
- No update path can be controlled by renderer input.
- No secret, customer contact, SQLite file, browser profile, `out/`, or local data directory is staged.
- `rg` placeholder scan is empty before publication.
- All code, workflow, package, installer, and public-release claims are supported by fresh command or GitHub evidence.
