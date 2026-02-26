/**
 * CJS compatibility preload for Node.js ESM modules that expect Bun's behavior.
 *
 * Bun allows require() in ESM modules. Node.js does not — require is undefined
 * in ESM context. The SDK's cli.js is an ESM bundle that uses bare require()
 * in some functions (e.g., existsSync checks). This preload makes require()
 * available globally so those calls work under Node.js.
 *
 * Loaded via: node --require cjs-compat-preload.cjs cli.js
 */
'use strict';
global.require = require;
