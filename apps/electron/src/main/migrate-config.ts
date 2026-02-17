/**
 * One-time migration from ~/.craft-agent/ to ~/.ws-workspace/
 *
 * After merging upstream craft-agents-oss v0.4.6, the app temporarily used
 * ~/.craft-agent/ for some data (workspaces, credentials, docs, etc.).
 * This module copies any data found in ~/.craft-agent/ to ~/.ws-workspace/
 * so users don't lose their workspaces, sessions, or credentials after update.
 *
 * The migration is idempotent — it only copies missing items and never overwrites.
 * A marker file (.migrated-from-craft-agent) prevents re-scanning on subsequent launches.
 */

import { existsSync, mkdirSync, cpSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { mainLog } from './logger'
import { CONFIG_DIR } from '@ws-workspace/shared/config/paths'

const LEGACY_DIR = join(homedir(), '.craft-agent')
const MIGRATION_MARKER = join(CONFIG_DIR, '.migrated-from-craft-agent')

/**
 * Migrate data from ~/.craft-agent/ to ~/.ws-workspace/ if needed.
 * Call this early in app startup, before workspace loading.
 */
export function migrateFromLegacyConfigDir(): void {
  // Skip if already migrated
  if (existsSync(MIGRATION_MARKER)) return

  // Skip if no legacy directory exists
  if (!existsSync(LEGACY_DIR)) {
    // Mark as done so we don't check again
    writeMigrationMarker()
    return
  }

  mainLog.info('[migrate] Found legacy ~/.craft-agent/ directory, starting migration...')

  // Ensure target directory exists
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }

  // Items to migrate (only if not already present in target)
  const items = [
    'workspaces',
    'credentials.enc',
    'config.json',
    'preferences.json',
    'permissions',
    'themes',
    'tool-icons',
    'drafts.json',
  ]

  let migratedCount = 0

  for (const item of items) {
    const source = join(LEGACY_DIR, item)
    const target = join(CONFIG_DIR, item)

    if (!existsSync(source)) continue
    if (existsSync(target)) {
      mainLog.info(`[migrate] Skipping ${item} (already exists in target)`)
      continue
    }

    try {
      cpSync(source, target, { recursive: true })
      mainLog.info(`[migrate] Copied ${item}`)
      migratedCount++
    } catch (error) {
      mainLog.error(`[migrate] Failed to copy ${item}:`, error)
    }
  }

  mainLog.info(`[migrate] Migration complete. Copied ${migratedCount} items.`)
  writeMigrationMarker()
}

function writeMigrationMarker(): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true })
    }
    writeFileSync(MIGRATION_MARKER, new Date().toISOString(), 'utf-8')
  } catch {
    // Non-fatal
  }
}
