# Vetka Desktop GitHub Releases and Auto-Updates Design

## Goal

Publish the existing Vetka Desktop application in a public GitHub repository and let an installed Windows copy discover, download, and apply later releases without requiring Violetta to download another installer manually.

## Scope

This change covers the public source repository, Windows release automation, the Squirrel.Windows update feed, update state in the Electron main process, a narrow preload API, and a shadcn/ui notification in the renderer.

It does not add forced updates, an update server, private GitHub authentication, automatic database migrations outside the existing migration runner, Windows code signing, or macOS/Linux releases. Windows code signing remains a compatible future hardening step.

## Repository and Release Model

- Repository name: `vetka-desktop`.
- Owner: the GitHub account authenticated during repository creation.
- Visibility: public.
- Default branch: `main`.
- Application source, documentation, tests, and release workflow live in this repository.
- A release is created only from a semantic version tag matching `vMAJOR.MINOR.PATCH`.
- `apps/desktop/package.json` version must equal the tag without its leading `v`.
- Each release publishes the Squirrel.Windows artifacts required by Electron: `RELEASES`, the full `.nupkg`, and `VetkaDesktopSetup.exe`.
- Ordinary branch pushes and pull requests run verification but never publish releases.

## Application Update Flow

1. Vetka Desktop starts and finishes opening the local database and renderer.
2. In a packaged build only, the main process configures Electron `autoUpdater` with the public GitHub update endpoint.
3. If the process has `--squirrel-firstrun`, the first check waits ten seconds so Squirrel can release its installation lock. Other packaged launches check shortly after the window becomes ready.
4. The main process emits a typed update state: `idle`, `checking`, `available`, `downloaded`, or `error`.
5. Squirrel downloads an available update in the background.
6. When download completes, the renderer shows a persistent shadcn notification with `Перезапустить сейчас` and `Позже`.
7. `Перезапустить сейчас` invokes a validated IPC method that calls `autoUpdater.quitAndInstall()` only when an update has actually been downloaded.
8. `Позже` hides the notification. Squirrel applies the downloaded update on the next normal application start.

Update failures never block startup, local data, order work, or Amazon price checks. Errors are reduced to a safe Russian message and are not shown as raw stacks or access tokens.

## Process Boundaries

### Main process

`UpdateService` owns Electron `autoUpdater`, the feed URL, lifecycle listeners, check scheduling, downloaded-state validation, and renderer broadcasts. It exposes `start()`, `getState()`, `check()`, and `restartAndInstall()`.

The service receives an updater adapter and environment values through its constructor. This keeps the state machine testable without downloading an update or importing Electron in unit tests.

### Preload and IPC

The preload exposes only:

- `updates.getState()`
- `updates.check()`
- `updates.restartAndInstall()`
- `updates.onStateChanged(listener)` returning an unsubscribe callback

Inputs and responses use the existing validated IPC result envelope. The renderer cannot set a feed URL, pass filesystem paths, execute a release, or call arbitrary Electron APIs.

### Renderer

A small `UpdateNotification` component subscribes once at application-shell level. It composes the installed shadcn `Alert`, `Button`, and `Sonner` primitives. Checking and no-update states stay unobtrusive. Only a downloaded update produces a persistent action prompt.

## GitHub Actions

Two workflows are used:

### Verification

Runs on pull requests and pushes to `main`:

- install Node 22 and dependencies from the lockfile;
- run tests, typecheck, lint, and package;
- use read-only repository permissions.

### Release

Runs only for `v*.*.*` tags:

- verifies tag/package version equality;
- runs the complete verification suite;
- builds the Squirrel.Windows artifacts on `windows-latest`;
- generates SHA-256 checksums;
- creates a GitHub Release and attaches the update artifacts;
- creates GitHub artifact provenance for the installer and package;
- grants `contents: write`, `id-token: write`, and `attestations: write` only to the release job.

Third-party actions are pinned to immutable commit SHAs where practical. No personal access token is stored in the repository or application; release publication uses the short-lived workflow `GITHUB_TOKEN`.

## Security and Future Hardening

- Local SQLite data, Amazon browser profiles, orders, customer contacts, and settings remain outside the repository and release artifacts.
- Existing Electron sandbox, context isolation, disabled Node integration, ASAR integrity, and restricted preload API remain mandatory.
- The application accepts update metadata only from the configured HTTPS endpoint for the exact public repository.
- Release creation is tag-gated and uses least-privilege workflow permissions.
- Artifact attestations provide build provenance for published binaries.
- A future Windows code-signing certificate can be added to the same release workflow through protected environment secrets. The updater protocol and installed user experience do not change.
- If source code later becomes private, releases can move to a separate public update repository without changing the `UpdateService` interface.

## Versioning and Operator Workflow

For each patch:

1. Merge the tested change to `main`.
2. Change the package version, for example from `1.0.0` to `1.0.1`.
3. Commit the version change.
4. Create and push tag `v1.0.1`.
5. GitHub Actions publishes the release.
6. Existing installations download it during their next online launch.

The first public release is `v1.0.0` and uses the already completed V0 application.

## Testing and Acceptance

- Unit tests drive the update state machine through available, no-update, downloaded, and error events.
- IPC tests prove that restart is rejected before download and allowed afterward.
- Renderer tests prove the downloaded notification, later dismissal, and restart action.
- Packaging verification confirms the updater code is present only in the packaged main process and the Squirrel artifacts exist.
- Workflow syntax is validated locally before push.
- Repository acceptance requires a successful public `v1.0.0` release containing all three update artifacts.
- End-to-end acceptance installs `v1.0.0`, publishes a higher patch version, launches the installed application, observes the downloaded prompt, restarts, and verifies the new version while preserving the same SQLite database.

## Failure Handling

- Offline, rate-limited, or unavailable GitHub: record `error`, keep the app usable, and retry only on the next manual check or later launch.
- No update: return to `idle` without a modal.
- Duplicate check request: ignore while a check or download is active.
- Downloaded update: never call `quitAndInstall()` without an explicit renderer action or a later normal restart.
- Release workflow failure: do not create or mutate a GitHub Release until verification and packaging succeed.
