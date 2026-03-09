/**
 * Cross-platform asset copy script.
 *
 * Copies the resources/ directory to dist/resources/.
 * All bundled assets (docs, themes, permissions, tool-icons) now live in resources/
 * which electron-builder handles natively via directories.buildResources.
 *
 * At Electron startup, setBundledAssetsRoot(__dirname) is called, and then
 * getBundledAssetsDir('docs') resolves to <__dirname>/resources/docs/, etc.
 *
 * Run: bun scripts/copy-assets.ts
 */

import { cpSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Copy all resources (icons, themes, docs, permissions, tool-icons, etc.)
cpSync('resources', 'dist/resources', { recursive: true });

console.log('✓ Copied resources/ → dist/resources/');

// Copy PowerShell parser script (for Windows command validation in Explore mode)
// Source: packages/shared/src/agent/powershell-parser.ps1
// Destination: dist/resources/powershell-parser.ps1
const psParserSrc = join('..', '..', 'packages', 'shared', 'src', 'agent', 'powershell-parser.ps1');
const psParserDest = join('dist', 'resources', 'powershell-parser.ps1');
try {
  copyFileSync(psParserSrc, psParserDest);
  console.log('✓ Copied powershell-parser.ps1 → dist/resources/');
} catch (err) {
  // Only warn - PowerShell validation is optional on non-Windows platforms
  console.log('⚠ powershell-parser.ps1 copy skipped (not critical on non-Windows)');
}

// Copy network interceptor files for electron-builder packaging.
// These standalone .ts files run as Bun preload scripts (--preload flag) in the SDK subprocess.
// electron-builder's `files` patterns resolve relative to --project (apps/electron),
// but the source files live at the monorepo root (packages/shared/src/).
// We copy them here so the `files` patterns in electron-builder.yml can find them.
const interceptorFiles = [
  'unified-network-interceptor.ts',
  'interceptor-common.ts',
  'interceptor-request-utils.ts',
  'feature-flags.ts',
  'cjs-compat-preload.cjs',
];
const interceptorSrcDir = join('..', '..', 'packages', 'shared', 'src');
const interceptorDestDir = join('packages', 'shared', 'src');
mkdirSync(interceptorDestDir, { recursive: true });
for (const file of interceptorFiles) {
  copyFileSync(join(interceptorSrcDir, file), join(interceptorDestDir, file));
}
console.log('✓ Copied interceptor files → packages/shared/src/');

// Patch SDK package.json: remove "type": "module" so Node.js treats cli.js as CommonJS.
// On Windows, we use Electron's embedded Node.js (not Bun) to avoid Bun's ENOTCONN bug.
// Bun allows require() in ESM files; Node.js does not. cli.js uses require() throughout,
// so it must be loaded as CJS. Removing "type" makes .js files default to CommonJS.
const sdkPkgPath = join('node_modules', '@anthropic-ai', 'claude-agent-sdk', 'package.json');
try {
  const sdkPkg = JSON.parse(readFileSync(sdkPkgPath, 'utf-8'));
  if (sdkPkg.type === 'module') {
    delete sdkPkg.type;
    writeFileSync(sdkPkgPath, JSON.stringify(sdkPkg, null, 2) + '\n', 'utf-8');
    console.log('✓ Patched SDK package.json: removed "type": "module" for Node.js CJS compat');
  }
} catch (err) {
  console.log('⚠ SDK package.json patch skipped:', (err as Error).message);
}
