# Windows bash.exe Detection Fix

## Problem

Craft Agents fails on Windows with error:
```
Claude Code was unable to find CLAUDE_CODE_GIT_BASH_PATH path "C:\Program Files\Git\bin\bash.exe"
```

## Root Cause

The `@anthropic-ai/claude-agent-sdk` CLI (`cli.js`) checks for bash.exe existence using:
```js
execSync('dir "C:\Program Files\Git\bin\bash.exe"', { stdio: "pipe" })
```

This `dir` command fails in Electron-spawned Bun subprocess because:
1. Bun's `execSync` may use the `SHELL` env var instead of `ComSpec` (cmd.exe)
2. When Electron inherits env from Git Bash/MSYS, `SHELL` is `/usr/bin/bash` (Unix-style path, invalid outside MSYS)
3. The `dir` command is a cmd.exe built-in, not available via bash

## Fix (3 parts)

### 1. Patch `cli.js` (REQUIRED, reapply after each SDK update)

The bash detection function in `cli.js` must be changed from `dir`-based to `fs.existsSync`-based.

**How to find the function:**
```bash
grep -oP '.{0,100}bash\.exe.{0,100}' node_modules/@anthropic-ai/claude-agent-sdk/cli.js | head -3
```

This shows something like:
```
...if(ph6(q))return q}console.error("Claude Code on Windows requires git-bash...
```

The function name before `(q)` (e.g. `ph6`, `QI1`, `XS6`) is the bash check function. Find its definition:
```bash
grep -oP 'function ph6.{0,100}' node_modules/@anthropic-ai/claude-agent-sdk/cli.js
```

**Replace:**
```js
// BEFORE (broken on Windows in Electron/Bun subprocess):
function ph6(A){try{return cE(`dir "${A}"`,{stdio:"pipe"}),!0}catch{return!1}}

// AFTER (works everywhere):
function ph6(A){try{return require("fs").existsSync(A)}catch{return!1}}
```

> The function name (ph6, QI1, etc.) changes with each SDK version due to minification. The pattern is always the same: a function that takes a path, runs `dir`, and returns boolean.

**Files to patch:**
- Dev: `C:\Users\alexa\craft-agents-oss\node_modules\@anthropic-ai\claude-agent-sdk\cli.js`
- Installed: `C:\Users\alexa\AppData\Local\Programs\@craft-agentelectron\resources\app\node_modules\@anthropic-ai\claude-agent-sdk\cli.js`

### 2. Environment fixes in `options.ts` (already in source code)

File: `packages/shared/src/agent/options.ts`

In `getDefaultOptions()`, within the `if (customPathToClaudeCodeExecutable)` block:
- Set `ComSpec` to `cmd.exe` if missing
- Remove Unix-style `SHELL` env var (e.g. `/usr/bin/bash`)
- Auto-detect `CLAUDE_CODE_GIT_BASH_PATH` from common Git install locations

### 3. Environment fixes in `network-interceptor.ts` (already in source code)

File: `packages/shared/src/network-interceptor.ts`

At the top of the file (runs as `--preload` before SDK):
- Remove MSYS-style `SHELL` env var
- Ensure `ComSpec` is set

## Quick Re-patch Script

After updating `@anthropic-ai/claude-agent-sdk`, run this to find and patch the function:

```bash
# Find the function name
FUNC=$(grep -oP '\w+(?=\(q\))' node_modules/@anthropic-ai/claude-agent-sdk/cli.js | head -1)
# Or more reliably, search for the dir pattern:
grep -oP 'function \w+\(A\)\{try\{return \w+\(`dir "\$\{A\}"`,\{stdio:"pipe"\}\),!0\}catch\{return!1\}\}' \
  node_modules/@anthropic-ai/claude-agent-sdk/cli.js

# Apply patch (sed)
sed -i 's/return [a-zA-Z0-9]*(`dir "${A}"`,{stdio:"pipe"}),!0/return require("fs").existsSync(A)/g' \
  node_modules/@anthropic-ai/claude-agent-sdk/cli.js
```

## Verification

```bash
# Test that cli.js runs without errors:
cd C:\Users\alexa\craft-agents-oss
CLAUDE_CODE_GIT_BASH_PATH="C:\Program Files\Git\bin\bash.exe" bun --env-file=NUL node_modules/@anthropic-ai/claude-agent-sdk/cli.js --version
# Expected output: 2.1.37 (Claude Code)
```

## SDK Versions Tested

| SDK Version | cli.js Version | Function Name | Status |
|-------------|---------------|---------------|--------|
| 0.2.31      | 2.1.19        | XS6 / QI1     | Patched |
| 0.2.37      | 2.1.37        | ph6            | Patched |

## Related Issues

- UTF-8 BOM in `~/.claude.json` on Windows (claude-code#14442)
- Empty config file crash (claude-code#2593)
- Race condition with concurrent sessions (claude-code#18998)
- Bun `.env` auto-loading overriding OAuth auth (craft-agents-oss#39)

## Date

First identified and fixed: 2026-02-09
