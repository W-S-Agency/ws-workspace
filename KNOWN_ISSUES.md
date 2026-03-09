# Known Issues - WS Workspace v0.7.1 Fork

**Last updated:** 2026-03-09
**Branch:** `merge-upstream-v0.7.1`
**Base:** upstream `lukilabs/craft-agents-oss` v0.7.1

---

## Architecture Overview

```
ws-workspace-product/          (monorepo root, dev repo)
  app/                         (git submodule -> W-S-Agency/ws-workspace)
    apps/electron/             (Electron app)
    packages/shared/           (shared agent logic, options, pi-agent)
    packages/ui/               (React UI components)
    packages/server-core/      (headless server)
    packages/pi-agent-server/  (Pi SDK subprocess)
    scripts/                   (build scripts)
```

**Repos:**
- Dev: `W-S-Agency/ws-workspace-product` (this repo)
- App: `W-S-Agency/ws-workspace` (submodule, fork of craft-agents-oss)
- Upstream: `lukilabs/craft-agents-oss`

---

## Windows Fixes Applied

### 1. Bun -> Node.js Switch (CRITICAL)

**Problem:** Upstream uses Bun for SDK subprocess. Bun's libuv on Windows has a bug
(oven-sh/bun#23432, #23520) where `fs.open()` fails with `ENOTCONN: socket is not
connected`. This breaks Read, Write, Bash tools — the app is completely unusable.

Additionally, Bun's `fs.existsSync` fails on paths with spaces (e.g., `C:\Program Files\Git\bin\bash.exe`),
causing SDK to crash with "unable to find CLAUDE_CODE_GIT_BASH_PATH".

**Fix:** `packages/shared/src/agent/options.ts`
- On Windows: use `process.execPath` (Electron's embedded Node.js 22.x) with `ELECTRON_RUN_AS_NODE=1`
- Load `cjs-compat-preload.cjs` via `--require` (polyfills `global.require` for ESM bundles)
- Patch SDK `package.json` to remove `"type": "module"` (so Node.js treats cli.js as CJS)
- Auto-detect `CLAUDE_CODE_GIT_BASH_PATH` and Git PATH dirs
- Set `ComSpec` to `cmd.exe`, remove MSYS-style `SHELL` env var
- Non-Windows continues to use Bun as before

**Files:**
- `packages/shared/src/agent/options.ts` — main fix
- `packages/shared/src/cjs-compat-preload.cjs` — `global.require = require` polyfill
- `packages/shared/src/agent/backend/internal/runtime-resolver.ts` — SDK package.json patch
- `apps/electron/scripts/afterPack.cjs` — production build SDK patch
- `apps/electron/scripts/copy-assets.ts` — asset copying for interceptor/preload
- `apps/electron/electron-builder.yml` — includes `cjs-compat-preload.cjs` in package

**Commit:** `611c6bd` (cherry-picked from `42b123f` on `merge-upstream-v0.6.0`)

### 2. ENOTCONN Session Recovery (Defense-in-Depth)

**Problem:** Even with the Bun->Node.js fix, subprocess pipe errors can occur in edge cases.
When a session is restored after app restart, the SDK subprocess may not be ready, causing
ENOTCONN/EPIPE errors that silently break the session.

**Fix:** Three-layer recovery:
1. `pi-agent.ts` — `send()` throws instead of silently returning when stdin not writable
2. `claude-agent.ts` — Inner catch detects pipe errors (ENOTCONN/EPIPE/ECONNRESET/stdin not writable),
   clears session, and retries with fresh subprocess
3. `sessions.ts` — Outer catch in `sendMessage()` destroys broken agent and recreates from scratch

**Files:**
- `packages/shared/src/agent/pi-agent.ts`
- `packages/shared/src/agent/claude-agent.ts`
- `apps/electron/src/main/sessions.ts`

**Commit:** `ec1f870` (cherry-picked from `43bcbd2` on `merge-upstream-v0.6.0`)

### 3. Electron Dev Mode Crashes

**Problem:** Several packages crash at module scope when bundled by esbuild:
- `@sentry/electron` / `@sentry/electron/main` — calls `app.getAppPath()` at require time
- `electron-updater` — calls `app.getVersion()` at require time
- `electron-log` — accesses Electron internals at require time
- `sharp` — native module, unavailable on Windows dev setup

**Fix:** Add to esbuild `external` array in build scripts.
v0.7.1 already has a lazy `sentry.ts` wrapper (no need for inline dynamic require).

**Files:**
- `scripts/electron-build-main.ts` — externals: `@sentry/electron`, `electron-updater`, `electron-log`, `sharp`, `@mariozechner/pi-ai`
- `scripts/electron-dev.ts` — same externals in both build contexts

**Commit:** `c50328f` (cherry-picked from `f721046` on `merge-upstream-v0.6.0`)

---

## Build Issues

### Pi Agent Server (Non-Fatal)

**Problem:** Missing native dependencies on Windows:
- `@sinclair/typebox`, `turndown`, `node-html-parser`, `pdfjs-dist` (in pi-agent-server)
- `@mariozechner/pi-ai`, `glob` (in shared)
- `gray-matter` (in shared/config/validators)

**Fix:** Build failure is non-fatal (warns and continues). Pi Agent is a macOS/Linux
feature and not needed on Windows.

### Renderer Build

**Problem:** v0.7.1 added new dependencies (`@tiptap/extension-task-list`, `@tiptap/extension-mathematics`,
`@tiptap/extension-file-handler`, `@tiptap/extension-image`, `@tiptap/markdown`, `@tiptap/suggestion`)
that must be properly installed.

**Fix:** Run `bun install` from the **root** workspace (`ws-workspace-product/`), not from `app/`.
The monorepo hoists packages to `ws-workspace-product/node_modules/.bun/` and symlinks them into `app/node_modules/`.

### PDF.js Worker

**Problem:** Vite cannot resolve `pdfjs-dist/build/pdf.worker.min.mjs?url` from Bun's `.bun/` directory.

**Workaround:** CDN worker URL in `packages/ui/src/components/overlay/PDFPreviewOverlay.tsx`:
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
```

---

## Build Instructions (Windows)

```powershell
# 1. Install from ROOT (not app/)
cd D:\Claude\ws-workspace-product
bun install

# 2. Build
cd app
bun run electron:build

# 3. Dev mode
bun run electron:dev

# 4. Production package (.exe)
bun run electron:dist:win
```

**Important:**
- Always `bun install` from root workspace (esbuild, vite are root deps)
- Pi Agent Server failure is expected on Windows (non-fatal)
- `tsconfig.base.json` warning is cosmetic (non-blocking)

---

## Environment Requirements

- **Node.js:** v22.x (via nvm4w)
- **Bun:** v1.3.9+
- **Git:** 2.53+ with `bash.exe` in `Git\bin\`
- **Electron:** v39.x (installed via npm)
- **Python:** 3.x (for Pi agent server, optional on Windows)
- **Env variable:** `CLAUDE_CODE_GIT_BASH_PATH` (set by app, no manual config needed in fork)

---

## Upstream Bugs to Report

1. **Missing dependencies in v0.7.1** — multiple packages not declared in package.json
2. **Windows: Bun ENOTCONN** — `fs.open()` fails, making app unusable
3. **Windows: Git Bash path with spaces** — `fs.existsSync` fails for `C:\Program Files\...`
4. **Windows: SHELL env override** — MSYS-style `/usr/bin/bash` breaks Bun's execSync

---

## Commit History

```
611c6bd fix: switch Windows SDK subprocess from Bun to Node.js (ENOTCONN root cause)
ec1f870 fix: add ENOTCONN session recovery for restored sessions
c50328f fix: resolve Electron dev mode runtime crashes
675ba49 docs: add KNOWN_ISSUES.md for upstream merge
3dedbf1 fix: add missing upstream dependencies and build workarounds
5d086ab chore: apply WS Workspace branding
609d6e6 merge: upstream v0.7.1 from lukilabs/craft-agents-oss
56fdf95 v0.7.1
```
