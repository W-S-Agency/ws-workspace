#!/usr/bin/env bun
/**
 * Post-install patch for @anthropic-ai/claude-agent-sdk cli.js.
 *
 * Problem (Windows-only): The SDK's bash detection uses
 *   execSync('dir "path"', {stdio:"pipe"})
 * which fails in Electron-spawned Bun subprocess on Windows because:
 * - Bun may use SHELL env var (set to /usr/bin/bash by MSYS) instead of ComSpec
 * - The `dir` command is a cmd.exe built-in, unavailable via bash
 *
 * Fix: Replace the `dir`-based check with `require("fs").existsSync()`.
 * This fix is safe on all platforms — existsSync works everywhere,
 * so we apply it unconditionally to keep the logic simple.
 *
 * This script is idempotent — safe to run multiple times.
 * Run automatically via `postinstall` in package.json, or manually:
 *   bun run scripts/patch-sdk-windows.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CLI_PATH = join(
  import.meta.dir,
  "..",
  "node_modules",
  "@anthropic-ai",
  "claude-agent-sdk",
  "cli.js"
);

// Pattern: function XXXX(A){try{return YY(`dir "${A}"`,{stdio:"pipe"}),!0}catch{return!1}}
// The function name and execSync reference name change with each SDK version due to minification.
const DIR_PATTERN = /function (\w+)\(A\)\{try\{return \w+\(`dir "\$\{A\}"`,\{stdio:"pipe"\}\),!0\}catch\{return!1\}\}/;

try {
  if (!existsSync(CLI_PATH)) {
    console.log("[patch-sdk] cli.js not found — skipping (SDK not installed yet?)");
    process.exit(0);
  }

  const content = readFileSync(CLI_PATH, "utf-8");

  // Check if already patched
  if (content.includes('require("fs").existsSync(A)')) {
    console.log("[patch-sdk] cli.js already patched — skipping");
    process.exit(0);
  }

  const match = content.match(DIR_PATTERN);
  if (!match) {
    console.log("[patch-sdk] No dir-based bash detection found in cli.js — SDK may have fixed this upstream");
    process.exit(0);
  }

  const funcName = match[1];
  const original = match[0];
  const patched = `function ${funcName}(A){try{return require("fs").existsSync(A)}catch{return!1}}`;

  const newContent = content.replace(original, patched);
  writeFileSync(CLI_PATH, newContent, "utf-8");

  console.log(`[patch-sdk] Patched cli.js: ${funcName}() now uses require("fs").existsSync() instead of dir`);
} catch (err) {
  console.error("[patch-sdk] Failed to patch cli.js:", err);
  // Non-fatal — don't break install on any platform
  process.exit(0);
}
