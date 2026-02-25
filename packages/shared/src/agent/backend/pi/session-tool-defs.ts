/**
 * Pi Session Tool Proxy Definitions
 *
 * Thin wrapper around the canonical tool definitions in @ws-workspace/session-tools-core.
 * Adds the `mcp__session__` prefix that the Pi SDK expects.
 */

import {
  getToolDefsAsJsonSchema,
  SESSION_TOOL_NAMES,
  type JsonSchemaToolDef,
} from '@ws-workspace/session-tools-core';

export type SessionToolProxyDef = JsonSchemaToolDef;

export { SESSION_TOOL_NAMES };

export function getSessionToolProxyDefs(): SessionToolProxyDef[] {
  return getToolDefsAsJsonSchema({ prefix: 'mcp__session__' });
}
