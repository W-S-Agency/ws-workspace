import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { BackendHostRuntimeContext } from '../types.ts';
import {
  setExecutable,
  setInterceptorPath,
  setPathToClaudeCodeExecutable,
} from '../../options.ts';

export interface ResolvedBackendRuntimePaths {
  claudeCliPath?: string;
  claudeInterceptorPath?: string;
  interceptorBundlePath?: string;
  copilotCliPath?: string;
  sessionServerPath?: string;
  bridgeServerPath?: string;
  piServerPath?: string;
  nodeRuntimePath?: string;
  bundledRuntimePath?: string;
}

export interface ResolvedBackendHostTooling {
  ripgrepPath?: string;
}

function firstExistingPath(candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Walk up from `base` checking `join(ancestor, relativePath)` at each level.
 * Stops after `maxLevels` ancestors or when hitting the filesystem root.
 */
function resolveUpwards(base: string, relativePath: string, maxLevels = 4): string | undefined {
  let dir = resolve(base);
  for (let i = 0; i <= maxLevels; i++) {
    const candidate = join(dir, relativePath);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return undefined;
}

function resolveBundledRuntimePath(hostRuntime: BackendHostRuntimeContext): string | undefined {
  const bunBinary = process.platform === 'win32' ? 'bun.exe' : 'bun';
  const bunBasePath = process.platform === 'win32'
    ? (hostRuntime.resourcesPath || hostRuntime.appRootPath)
    : hostRuntime.appRootPath;
  const bunPath = join(bunBasePath, 'vendor', 'bun', bunBinary);
  return existsSync(bunPath) ? bunPath : undefined;
}

function resolveClaudeCliPath(hostRuntime: BackendHostRuntimeContext): string | undefined {
  const sdkRelative = join('node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js');
  return firstExistingPath([
    join(hostRuntime.appRootPath, sdkRelative),
    join(hostRuntime.appRootPath, '..', '..', sdkRelative),
  ]);
}

function resolveClaudeInterceptorPath(hostRuntime: BackendHostRuntimeContext): string | undefined {
  const interceptorRelative = join('packages', 'shared', 'src', 'unified-network-interceptor.ts');
  return firstExistingPath([
    join(hostRuntime.appRootPath, interceptorRelative),
    join(hostRuntime.appRootPath, '..', '..', interceptorRelative),
  ]);
}

function resolveInterceptorBundlePath(hostRuntime: BackendHostRuntimeContext): string | undefined {
  if (hostRuntime.interceptorBundlePath && existsSync(hostRuntime.interceptorBundlePath)) {
    return hostRuntime.interceptorBundlePath;
  }

  return resolveUpwards(hostRuntime.appRootPath, join('dist', 'interceptor.cjs'))
    ?? resolveUpwards(hostRuntime.appRootPath, join('apps', 'electron', 'dist', 'interceptor.cjs'));
}

function resolveCopilotCliPath(hostRuntime: BackendHostRuntimeContext): string | undefined {
  const platform = process.platform === 'win32'
    ? 'win32'
    : process.platform === 'linux'
      ? 'linux'
      : 'darwin';
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const binaryName = platform === 'win32' ? 'copilot.exe' : 'copilot';

  if (hostRuntime.isPackaged) {
    const packaged = join(hostRuntime.appRootPath, 'vendor', 'copilot', `${platform}-${arch}`, binaryName);
    return existsSync(packaged) ? packaged : undefined;
  }

  return resolveUpwards(
    hostRuntime.appRootPath,
    join('node_modules', '@github', `copilot-${platform}-${arch}`, binaryName),
  );
}

function resolveServerPath(hostRuntime: BackendHostRuntimeContext, serverName: string): string | undefined {
  if (hostRuntime.isPackaged) {
    const packaged = join(hostRuntime.appRootPath, 'resources', serverName, 'index.js');
    return existsSync(packaged) ? packaged : undefined;
  }
  return resolveUpwards(
    hostRuntime.appRootPath,
    join('packages', serverName, 'dist', 'index.js'),
  );
}

function resolveRipgrepPath(hostRuntime: BackendHostRuntimeContext): string | undefined {
  const platform = process.platform === 'win32'
    ? 'x64-win32'
    : process.platform === 'darwin'
      ? (process.arch === 'arm64' ? 'arm64-darwin' : 'x64-darwin')
      : (process.arch === 'arm64' ? 'arm64-linux' : 'x64-linux');
  const binaryName = process.platform === 'win32' ? 'rg.exe' : 'rg';
  const ripgrepRelative = join(
    'node_modules',
    '@anthropic-ai',
    'claude-agent-sdk',
    'vendor',
    'ripgrep',
    platform,
    binaryName,
  );

  if (hostRuntime.isPackaged) {
    const packaged = join(hostRuntime.appRootPath, ripgrepRelative);
    if (existsSync(packaged)) return packaged;
  }

  const fromHostRoot = resolveUpwards(hostRuntime.appRootPath, ripgrepRelative, 10);
  if (fromHostRoot) return fromHostRoot;

  const cwdFallback = join(process.cwd(), ripgrepRelative);
  if (existsSync(cwdFallback)) return cwdFallback;

  return undefined;
}

export function resolveBackendRuntimePaths(hostRuntime: BackendHostRuntimeContext): ResolvedBackendRuntimePaths {
  const bundledRuntimePath = hostRuntime.nodeRuntimePath || resolveBundledRuntimePath(hostRuntime);

  return {
    claudeCliPath: resolveClaudeCliPath(hostRuntime),
    claudeInterceptorPath: resolveClaudeInterceptorPath(hostRuntime),
    interceptorBundlePath: resolveInterceptorBundlePath(hostRuntime),
    copilotCliPath: resolveCopilotCliPath(hostRuntime),
    sessionServerPath: resolveServerPath(hostRuntime, 'session-mcp-server'),
    bridgeServerPath: resolveServerPath(hostRuntime, 'bridge-mcp-server'),
    piServerPath: resolveServerPath(hostRuntime, 'pi-agent-server'),
    nodeRuntimePath: hostRuntime.nodeRuntimePath || bundledRuntimePath || 'bun',
    bundledRuntimePath,
  };
}

export function resolveBackendHostTooling(hostRuntime: BackendHostRuntimeContext): ResolvedBackendHostTooling {
  return {
    ripgrepPath: resolveRipgrepPath(hostRuntime),
  };
}

/**
 * On Windows with Node.js, remove "type": "module" from the SDK package.json
 * so that cli.js is loaded as CommonJS.
 *
 * The SDK's cli.js uses require() throughout (e.g., require("fs").existsSync()).
 * Bun allows require() in ESM files; Node.js does not — require is undefined in
 * ESM context, causing all existsSync checks to silently return false.
 * Removing "type" makes .js files default to CommonJS where require() works.
 *
 * This is idempotent — safe to call multiple times.
 */
function patchSdkPackageJsonForCjs(cliPath: string): void {
  const pkgPath = join(dirname(cliPath), 'package.json');
  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    if (pkg.type === 'module') {
      delete pkg.type;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    }
  } catch {
    // Non-fatal: if we can't patch, the subprocess will fail with a clear error
  }
}

/**
 * Configure anthropic-sdk globals from host runtime context.
 * This mirrors previous Electron bootstrap behavior but keeps it behind backend internals.
 */
export function applyAnthropicRuntimeBootstrap(
  hostRuntime: BackendHostRuntimeContext,
  paths: ResolvedBackendRuntimePaths,
): void {
  if (!paths.claudeCliPath) {
    throw new Error('Claude Code SDK not found. The app package may be corrupted.');
  }

  // On Windows, patch SDK package.json before any subprocess reads it.
  // Must happen before setPathToClaudeCodeExecutable since the subprocess
  // is spawned shortly after and needs to see the patched file.
  if (process.platform === 'win32') {
    patchSdkPackageJsonForCjs(paths.claudeCliPath);
  }

  setPathToClaudeCodeExecutable(paths.claudeCliPath);

  // On Windows, use the pre-compiled CJS interceptor bundle instead of raw .ts.
  // Node.js --require loads in CJS context; the .ts file uses import syntax
  // which fails in CJS. The bundle (dist/interceptor.cjs) is already compiled.
  const interceptorPath = process.platform === 'win32' && paths.interceptorBundlePath
    ? paths.interceptorBundlePath
    : paths.claudeInterceptorPath;

  if (!interceptorPath) {
    throw new Error('Network interceptor not found. The app package may be corrupted.');
  }
  setInterceptorPath(interceptorPath);

  if (hostRuntime.isPackaged) {
    if (!paths.bundledRuntimePath) {
      throw new Error('Bundled Bun runtime not found. The app package may be corrupted.');
    }
    setExecutable(paths.bundledRuntimePath);
  }
}

