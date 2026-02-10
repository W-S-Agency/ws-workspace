/**
 * @ws-workspace/shared
 *
 * Shared business logic for WS Workspace.
 * Used by the Electron app.
 *
 * Import specific modules via subpath exports:
 *   import { CraftAgent } from '@ws-workspace/shared/agent';
 *   import { loadStoredConfig } from '@ws-workspace/shared/config';
 *   import { getCredentialManager } from '@ws-workspace/shared/credentials';
 *   import { CraftMcpClient } from '@ws-workspace/shared/mcp';
 *   import { debug } from '@ws-workspace/shared/utils';
 *   import { loadSource, createSource, getSourceCredentialManager } from '@ws-workspace/shared/sources';
 *   import { createWorkspace, loadWorkspace } from '@ws-workspace/shared/workspaces';
 *
 * Available modules:
 *   - agent: CraftAgent SDK wrapper, plan tools
 *   - auth: OAuth, token management, auth state
 *   - clients: Craft API client
 *   - config: Storage, models, preferences
 *   - credentials: Encrypted credential storage
 *   - mcp: MCP client, connection validation
 *   - prompts: System prompt generation
 *   - sources: Workspace-scoped source management (MCP, API, local)
 *   - utils: Debug logging, file handling, summarization
 *   - validation: URL validation
 *   - version: Version and installation management
 *   - workspaces: Workspace management (top-level organizational unit)
 */

// Export branding (standalone, no dependencies)
export * from './branding.ts';
