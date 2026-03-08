# Known Issues

## Upstream Merge: v0.6.0 vs v0.7.x

### Issue
Upstream Craft Agents v0.7.0 and v0.7.1 have systemic **Vite + Rollup + workspace package resolution issues** that prevent renderer builds from succeeding.

### Root Cause
When building the renderer with Vite, Rollup fails to resolve named exports from packages in workspace setup. This affects:
- All packages with ESM named exports (`shiki`, `@radix-ui/*`, `tailwind-merge`, `clsx`, etc.)
- Multiple package managers tested (Bun, npm, pnpm) all fail identically
- The issue is NOT package-manager specific - it's a Vite + Rollup limitation

### Evidence
1. **v0.7.0/v0.7.1 Build Failures**:
   - Tiptap dependencies (added in v0.7.0) fail with Rollup export resolution errors
   - Even after removing Tiptap, other packages (`shiki`, `@radix-ui/*`) fail with the same pattern
   - All 3 package managers (Bun, npm, pnpm) produce identical errors

2. **Upstream Validation**:
   - Upstream has NOT published binaries since v0.6.0 (last release: March 2, 2025)
   - Upstream CI does NOT test renderer builds (only lint, typecheck, test)
   - v0.7.0 and v0.7.1 builds are unverified by upstream

3. **v0.6.0 Works**:
   - v0.6.0 has published binaries (proven working build)
   - v0.6.0 codebase builds successfully with minimal workarounds (PDF worker CDN fix)

### Decision
**Rolled back to upstream v0.6.0** as the stable foundation for WS Workspace.

### Applied Workarounds for v0.6.0
1. **PDF.js Worker**: Use CDN instead of Vite `?url` import
   ```typescript
   // Before (fails in Vite build):
   import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
   pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker

   // After (CDN workaround):
   pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
   ```

2. **Package Renaming**: All `@craft-agent/*` packages renamed to `@ws-workspace/*`

### Impact
- ✅ v0.6.0 builds successfully
- ✅ Proven stable (upstream published binaries)
- ⚠️ Missing features from v0.7.0/v0.7.1:
  - Tiptap markdown editor
  - Codex SDK updates
  - Any other v0.7.x enhancements

### Future Plan
Monitor upstream for fixes to v0.7.x build issues. When upstream publishes v0.7.x binaries or demonstrates working builds, consider upgrading.

### Related Files
- Build fix: `packages/ui/src/components/overlay/PDFPreviewOverlay.tsx`
- Build fix: `packages/ui/src/components/markdown/MarkdownPdfBlock.tsx`
- Build fix: `apps/electron/src/renderer/playground/registry/action-cards.tsx`

### Commit History
- Initial v0.7.1 merge attempt: `609d6e6`
- Branding applied: `5d086ab`
- Dependency fixes: `3dedbf1`
- v0.6.0 rollback: `2448556`

---

*Last updated: 2026-03-08*
