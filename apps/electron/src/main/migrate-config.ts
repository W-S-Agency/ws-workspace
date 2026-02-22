/**
 * Migration from ~/.craft-agent/ to ~/.ws-workspace/
 *
 * Handles two scenarios:
 * 1. First-time migration — user upgrades from old Craft Agents build to WS Workspace.
 *    Copies all config, credentials, workspaces, sessions, sources, etc.
 * 2. Differential sync — user had both old and new builds installed side-by-side.
 *    The old build kept writing to ~/.craft-agent/ after the initial migration.
 *    On each launch we check for newer files in ~/.craft-agent/ and merge them.
 *
 * Safety guarantees:
 * - Never deletes files from either directory
 * - Never overwrites a newer file with an older one (compares mtime)
 * - Copies missing items that only exist in legacy dir
 * - Logs every action for debugging
 */

import { existsSync, mkdirSync, cpSync, writeFileSync, statSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { mainLog } from './logger'
import { CONFIG_DIR } from '@ws-workspace/shared/config/paths'

const LEGACY_DIR = join(homedir(), '.craft-agent')

/**
 * Migrate and sync data from ~/.craft-agent/ to ~/.ws-workspace/.
 * Call this early in app startup, before workspace loading.
 *
 * Runs on every launch (fast no-op when legacy dir doesn't exist).
 */
export function migrateFromLegacyConfigDir(): void {
  // Skip if no legacy directory exists — nothing to migrate
  if (!existsSync(LEGACY_DIR)) return

  mainLog.info('[migrate] Checking ~/.craft-agent/ for data to sync...')

  // Ensure target directory exists
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }

  // Top-level files: copy if missing or if legacy is newer
  const topLevelFiles = [
    'credentials.enc',
    'config.json',
    'preferences.json',
    'drafts.json',
    'config-defaults.json',
  ]

  let syncedCount = 0

  for (const file of topLevelFiles) {
    if (syncFile(join(LEGACY_DIR, file), join(CONFIG_DIR, file), file)) {
      syncedCount++
    }
  }

  // Top-level directories: copy if missing entirely
  const topLevelDirs = [
    'permissions',
    'themes',
    'tool-icons',
    'docs',
    'release-notes',
    'logs',
    'mcp-servers',
  ]

  for (const dir of topLevelDirs) {
    const source = join(LEGACY_DIR, dir)
    const target = join(CONFIG_DIR, dir)

    if (!existsSync(source)) continue

    if (!existsSync(target)) {
      try {
        cpSync(source, target, { recursive: true })
        mainLog.info(`[migrate] Copied directory: ${dir}`)
        syncedCount++
      } catch (error) {
        mainLog.error(`[migrate] Failed to copy directory ${dir}:`, error)
      }
    }
  }

  // Workspaces: deep merge — sync sessions, sources, skills, config per workspace
  syncedCount += syncWorkspaces()

  if (syncedCount > 0) {
    mainLog.info(`[migrate] Sync complete. ${syncedCount} items synced from ~/.craft-agent/`)
  } else {
    mainLog.info('[migrate] No new data in ~/.craft-agent/, everything up to date.')
  }
}

/**
 * Sync a single file: copy if target is missing, or if source is newer.
 * Returns true if the file was copied.
 */
function syncFile(source: string, target: string, label: string): boolean {
  if (!existsSync(source)) return false

  if (!existsSync(target)) {
    // Target doesn't exist — copy
    try {
      const targetDir = join(target, '..')
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
      cpSync(source, target)
      mainLog.info(`[migrate] Copied missing file: ${label}`)
      return true
    } catch (error) {
      mainLog.error(`[migrate] Failed to copy ${label}:`, error)
      return false
    }
  }

  // Both exist — compare mtimes
  try {
    const sourceMtime = statSync(source).mtimeMs
    const targetMtime = statSync(target).mtimeMs

    if (sourceMtime > targetMtime) {
      cpSync(source, target)
      mainLog.info(`[migrate] Updated file (legacy was newer): ${label}`)
      return true
    }
  } catch (error) {
    mainLog.error(`[migrate] Failed to compare/copy ${label}:`, error)
  }

  return false
}

/**
 * Deep-sync workspaces: for each workspace in legacy dir,
 * sync sessions, sources, skills, and config files.
 */
function syncWorkspaces(): number {
  const legacyWorkspacesDir = join(LEGACY_DIR, 'workspaces')
  const targetWorkspacesDir = join(CONFIG_DIR, 'workspaces')

  if (!existsSync(legacyWorkspacesDir)) return 0

  let count = 0

  try {
    const workspaceSlugs = readdirSync(legacyWorkspacesDir).filter(entry => {
      try { return statSync(join(legacyWorkspacesDir, entry)).isDirectory() } catch { return false }
    })

    for (const slug of workspaceSlugs) {
      const legacyWs = join(legacyWorkspacesDir, slug)
      const targetWs = join(targetWorkspacesDir, slug)

      if (!existsSync(targetWs)) {
        // Entire workspace is missing — copy it all
        try {
          mkdirSync(targetWs, { recursive: true })
          cpSync(legacyWs, targetWs, { recursive: true })
          mainLog.info(`[migrate] Copied entire workspace: ${slug}`)
          count++
        } catch (error) {
          mainLog.error(`[migrate] Failed to copy workspace ${slug}:`, error)
        }
        continue
      }

      // Workspace exists in both — sync individual parts
      // Sync workspace-level files
      for (const file of ['config.json', 'hooks.json', 'views.json', 'projects.json']) {
        if (syncFile(join(legacyWs, file), join(targetWs, file), `workspaces/${slug}/${file}`)) {
          count++
        }
      }

      // Sync events.jsonl — special case: always take the larger one (more data)
      count += syncEventsFile(legacyWs, targetWs, slug)

      // Sync subdirectories: sessions, sources, skills, labels, scripts, statuses
      for (const subdir of ['sessions', 'sources', 'skills', 'labels', 'scripts', 'statuses']) {
        count += syncSubdirectory(legacyWs, targetWs, subdir, slug)
      }
    }
  } catch (error) {
    mainLog.error('[migrate] Error syncing workspaces:', error)
  }

  return count
}

/**
 * Sync events.jsonl — append-only file. Take the larger one (more events = more data).
 */
function syncEventsFile(legacyWs: string, targetWs: string, slug: string): number {
  const source = join(legacyWs, 'events.jsonl')
  const target = join(targetWs, 'events.jsonl')

  if (!existsSync(source)) return 0

  if (!existsSync(target)) {
    try {
      cpSync(source, target)
      mainLog.info(`[migrate] Copied events.jsonl for workspace: ${slug}`)
      return 1
    } catch (error) {
      mainLog.error(`[migrate] Failed to copy events.jsonl for ${slug}:`, error)
      return 0
    }
  }

  try {
    const sourceSize = statSync(source).size
    const targetSize = statSync(target).size

    if (sourceSize > targetSize) {
      cpSync(source, target)
      mainLog.info(`[migrate] Updated events.jsonl for ${slug} (legacy had more data: ${sourceSize} > ${targetSize} bytes)`)
      return 1
    }
  } catch (error) {
    mainLog.error(`[migrate] Failed to compare events.jsonl for ${slug}:`, error)
  }

  return 0
}

/**
 * Sync a subdirectory (sessions, sources, skills, etc.)
 * Copies any folders/files that exist in legacy but not in target.
 */
function syncSubdirectory(legacyWs: string, targetWs: string, subdir: string, wsSlug: string): number {
  const sourceDir = join(legacyWs, subdir)
  const targetDir = join(targetWs, subdir)

  if (!existsSync(sourceDir)) return 0

  if (!existsSync(targetDir)) {
    try {
      cpSync(sourceDir, targetDir, { recursive: true })
      mainLog.info(`[migrate] Copied ${subdir}/ for workspace: ${wsSlug}`)
      return 1
    } catch (error) {
      mainLog.error(`[migrate] Failed to copy ${subdir}/ for ${wsSlug}:`, error)
      return 0
    }
  }

  // Both exist — sync individual entries
  let count = 0

  try {
    const entries = readdirSync(sourceDir)

    for (const entry of entries) {
      const sourceEntry = join(sourceDir, entry)
      const targetEntry = join(targetDir, entry)

      if (!existsSync(targetEntry)) {
        try {
          cpSync(sourceEntry, targetEntry, { recursive: true })
          mainLog.info(`[migrate] Copied ${subdir}/${entry} for workspace: ${wsSlug}`)
          count++
        } catch (error) {
          mainLog.error(`[migrate] Failed to copy ${subdir}/${entry} for ${wsSlug}:`, error)
        }
      }
    }
  } catch (error) {
    mainLog.error(`[migrate] Error syncing ${subdir}/ for ${wsSlug}:`, error)
  }

  return count
}
