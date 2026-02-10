/**
 * Centralized path configuration for WS Workspace.
 *
 * Supports multi-instance development via CRAFT_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., ws-workspace-1), the detect-instance.sh
 * script sets CRAFT_CONFIG_DIR to ~/.ws-workspace-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.ws-workspace/
 * Instance 1 (-1 suffix): ~/.ws-workspace-1/
 * Instance 2 (-2 suffix): ~/.ws-workspace-2/
 */

import { homedir } from 'os';
import { join } from 'path';

// Allow override via environment variable for multi-instance dev
// Falls back to default ~/.ws-workspace/ for production and non-numbered dev folders
export const CONFIG_DIR = process.env.CRAFT_CONFIG_DIR || join(homedir(), '.ws-workspace');
