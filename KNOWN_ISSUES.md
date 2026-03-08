# Known Issues - Upstream Merge v0.7.1

**Date:** 2026-03-08
**Branch:** `merge-upstream-v0.7.1`
**Status:** Partial Success (Main process ✅, Renderer ❌)

---

## ✅ What Works

- **Merge completed:** upstream v0.7.1 successfully merged
- **Branding updated:** All WS Workspace branding applied
- **Main process:** Builds successfully (35.2 MB)
- **Preload scripts:** Build successfully
- **Session MCP server:** Builds successfully (4.1 MB)
- **Pi Agent server:** Builds successfully (15.26 MB) after dependency fixes
- **Interceptor:** Builds successfully

## ❌ What Doesn't Work

### Renderer Build Failure

**Error:** Vite cannot resolve imports from workspace packages when using Bun

**Affected imports:**
- `@tiptap/core` and all `@tiptap/*` extensions
- Any package imported from `@craft-agent/ui` workspace package

**Root cause:**
- Bun stores packages in `.bun/package@version/node_modules/package/`
- Vite expects packages in `node_modules/package/`
- Workspace package imports (`@craft-agent/ui`) cannot resolve their dependencies

---

## 🐛 Upstream Bugs Fixed

The following dependencies were **missing** in upstream `lukilabs/craft-agents-oss` v0.7.1:

### packages/pi-agent-server/package.json
```json
{
  "dependencies": {
    "@sinclair/typebox": "^0.34.0",  // MISSING in upstream
    "turndown": "^7.2.0",            // MISSING in upstream
    "node-html-parser": "^7.0.0",    // MISSING in upstream
    "pdfjs-dist": "^4.9.246"         // MISSING in upstream
  }
}
```

### packages/shared/package.json
```json
{
  "dependencies": {
    "@mariozechner/pi-ai": "^0.56.2", // MISSING in upstream
    "glob": "^11.0.0"                  // MISSING in upstream
  }
}
```

### packages/server-core/package.json
```json
{
  "dependencies": {
    "@mariozechner/pi-ai": "^0.56.2"  // MISSING in upstream
  }
}
```

**Impact:** Code uses these packages but they're not declared in package.json.
**Our fix:** Added all missing dependencies manually.
**TODO:** Create PR to upstream with these fixes.

---

## 🔧 Workarounds Applied

### 1. PDF.js Worker (Solved ✅)

**Problem:** Vite cannot resolve `pdfjs-dist/build/pdf.worker.min.mjs?url` from Bun's `.bun/` directory

**Workaround:**
```typescript
// packages/ui/src/components/overlay/PDFPreviewOverlay.tsx
// Use CDN worker instead of local import
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
```

**Status:** ✅ Works (but requires internet connection)

### 2. Vite Config Updates

**File:** `apps/electron/vite.config.ts`

```typescript
{
  resolve: {
    preserveSymlinks: false,
    alias: {
      'pdfjs-dist': resolve(__dirname, '../../node_modules/.bun/pdfjs-dist@4.10.38/node_modules/pdfjs-dist'),
    }
  },
  assetsInclude: ['**/*.mjs']
}
```

---

## 📋 Next Steps

### Option A: Complete Vite Fix (2-3 hours)
- [ ] Write custom Vite plugin for Bun `.bun/` resolution
- [ ] Add aliases for all `@tiptap/*` packages
- [ ] Test full build
- [ ] Verify production packaging

### Option B: Switch to npm for builds (30 min)
- [ ] Keep Bun for dev mode
- [ ] Use `npm install` for production builds
- [ ] Update build scripts in `package.json`
- [ ] Test with npm node_modules structure

### Option C: Wait for upstream/tooling fixes
- [ ] Create issue in Bun repo about Vite compatibility
- [ ] Create issue in Vite repo about workspace resolution
- [ ] Monitor upstream for fixes

### Option D: Simplify (RECOMMENDED)
- [ ] Remove Tiptap editor from `@craft-agent/ui`
- [ ] Use simpler markdown editor
- [ ] Fewer workspace dependencies = fewer resolution issues

---

## 🎯 Immediate Actions

1. **Create upstream PR** with dependency fixes
   - Repository: `lukilabs/craft-agents-oss`
   - Title: "fix: add missing dependencies in v0.7.1 packages"
   - Include all package.json changes

2. **Test what works:**
   - Try `npm run electron:dev` (dev mode)
   - Check if main process + UI loads
   - Verify MCP servers connect

3. **Document in CLAUDE.md:**
   - Known issue: Renderer build requires npm instead of Bun
   - Workaround: Use dev mode or switch to npm

---

## 📝 Timeline

**Time spent:** ~2.5 hours
**Date:** 2026-03-08 06:00-08:30 GMT+1

**Commits:**
- `609d6e6` - Merge upstream v0.7.1
- `5d086ab` - Apply WS Workspace branding
- `3dedbf1` - Fix missing dependencies and workarounds

**Branch:** `merge-upstream-v0.7.1`
**Remote:** https://github.com/W-S-Agency/ws-workspace/tree/merge-upstream-v0.7.1
