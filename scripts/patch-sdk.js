// Patch Claude Code SDK: replace dir-based bash check with fs.existsSync
// Must be reapplied after each bun install / SDK update
const fs = require('fs');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js');

if (!fs.existsSync(cliPath)) {
  console.log('SDK cli.js not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(cliPath, 'utf-8');
const before = 'return cE(`dir "${A}"`,{stdio:"pipe"}),!0';
const after = 'return require("fs").existsSync(A)';

if (content.includes(after)) {
  console.log('SDK already patched');
  process.exit(0);
}

if (!content.includes(before)) {
  console.warn('WARNING: SDK patch pattern not found (new SDK version?). Manual patch may be needed.');
  process.exit(0);
}

content = content.replace(before, after);
fs.writeFileSync(cliPath, content);
console.log('SDK patched: bash.exe detection now uses fs.existsSync');
