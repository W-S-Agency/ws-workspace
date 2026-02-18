# Project Analysis (2026-02-17)

## Overview
- Monorepo on Bun + TypeScript.
- Main apps: `apps/electron`, `apps/viewer`.
- Shared packages: `packages/shared`, `packages/core`, `packages/ui`, `packages/codex-types`, `packages/mermaid`, `packages/bridge-mcp-server`, `packages/session-mcp-server`, `packages/session-tools-core`.
- Approximate scale (excluding `node_modules`/release):
  - Files in `apps + packages + scripts`: `1456`
  - TypeScript files (`.ts/.tsx`): `1168`
  - Test files (name/path pattern): `177`

## Architecture Assessment
- Decomposition is generally strong: UI, domain/shared logic, types, and integrations are split into dedicated packages.
- Electron app has clear process boundaries (`main`, `preload`, `renderer`).
- Shared domain logic in `packages/shared` looks central and reusable.

## Critical Findings

### 1) Broken root scripts (refer to missing files)
In `package.json` these scripts point to files/directories that are absent:
- `electron:dev:menu` -> `scripts/electron-dev.sh` (`package.json:30`)
- `electron:dev:logs` -> `scripts/tail-electron-logs.sh` (`package.json:31`)
- `sync-secrets` -> `scripts/sync-secrets.sh` (`package.json:32`)
- `fresh-start`/`fresh-start:token` -> `scripts/fresh-start.ts` (`package.json:33`, `package.json:34`)
- `build` -> `scripts/build.ts` (`package.json:47`)
- `release` -> `scripts/release.ts` (`package.json:48`)
- `check-version` -> `scripts/check-version.ts` (`package.json:49`)
- `oss:sync` -> `scripts/oss-sync.ts` (`package.json:50`)

These scripts currently cannot run as written.

### 2) Scripts target missing apps
Root scripts reference apps that do not exist:
- `marketing:*` scripts target `apps/marketing/*` (`package.json:43-45`)
- `docs:dev` targets `apps/online-docs` (`package.json:46`)

### 3) Electron local build pipeline likely broken
In `apps/electron/package.json`:
- `build:validate` calls `scripts/validate-assets.ts` (`apps/electron/package.json:24`)
- `build` depends on `build:validate` (`apps/electron/package.json:25`)

But `apps/electron/scripts/validate-assets.ts` is missing.

## Medium Findings

### 4) CI workflow scope is narrow
Only one workflow exists: `.github/workflows/build.yml`.
- Triggers: release publish + manual dispatch (`.github/workflows/build.yml:3`, `.github/workflows/build.yml:8`)
- Focus: packaging installers for Windows/macOS.

No dedicated PR/push quality-gate workflow for lint/typecheck/tests.

### 5) Root quality scripts do not cover full workspace
From root `package.json`:
- `lint` only runs `apps/electron` and `packages/shared` (`package.json:16-18`)
- `typecheck:all` only runs `packages/core` and `packages/shared` (`package.json:15`)

This leaves multiple packages/apps outside root-level gates.

### 6) Explicit TODOs in product code
Found unfinished implementation markers, e.g.:
- `apps/electron/src/renderer/components/app-shell/RightSidebar.tsx:30`
- `apps/electron/src/renderer/components/app-shell/RightSidebar.tsx:38`

## Positive Signals
- Good modular package boundaries.
- Existing automated tests across core/shared/electron/mermaid areas.
- Workspace package versions are synchronized (`0.6.9`).

## Risk Summary
- **High operational risk**: broken scripts can block development/release flows.
- **Medium quality risk**: incomplete CI and partial root quality checks can let regressions pass.
- **Medium product risk**: known TODO placeholders in user-visible areas.

## Recommended Actions (Priority)
1. Fix or remove invalid root scripts in `package.json`.
2. Restore missing build-time scripts (`scripts/build.ts`, `scripts/release.ts`, `apps/electron/scripts/validate-assets.ts`, etc.) or update commands to current locations.
3. Add CI for PR/push with at least:
   - lint
   - typecheck
   - unit tests
   - optional lightweight build smoke test
4. Expand root `lint`/`typecheck` coverage to all active workspaces.
5. Convert TODO placeholders in `RightSidebar` into tracked issues/tasks or implement.

## Scope / Method
- Static repo audit only (files/config/scripts/workflows).
- No runtime execution of tests/builds in this pass.
