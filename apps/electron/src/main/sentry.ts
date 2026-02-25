/**
 * Lazy Sentry wrapper for the main process.
 *
 * @sentry/electron's module-level code calls app.getAppPath() during require(),
 * which crashes esbuild CJS bundles. This module defers loading @sentry/electron
 * until initSentry() is explicitly called, and provides a no-op fallback when
 * the Sentry DSN is not configured.
 */

import { app } from 'electron'
import { createHash } from 'crypto'
import { hostname, homedir } from 'os'

interface SentryLike {
  init(options: Record<string, unknown>): void
  setUser(user: Record<string, unknown>): void
  setTag(key: string, value: string): void
  captureException(error: unknown, context?: Record<string, unknown>): void
}

const noopSentry: SentryLike = {
  init() {},
  setUser() {},
  setTag() {},
  captureException() {},
}

let _sentry: SentryLike = noopSentry

/**
 * Initialize Sentry if DSN is available. Must be called early in app startup.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initSentry(): void {
  if (_sentry !== noopSentry) return
  if (!process.env.SENTRY_ELECTRON_INGEST_URL) return

  try {
    // Dynamic require so esbuild wraps @sentry/electron in a lazy __commonJS loader
    // instead of inlining its module-level code at the bundle's top scope.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SentryModule = require('@sentry/electron/main')
    _sentry = SentryModule

    _sentry.init({
      dsn: process.env.SENTRY_ELECTRON_INGEST_URL,
      environment: app.isPackaged ? 'production' : 'development',
      release: app.getVersion(),
      enabled: true,
      beforeSend(event: Record<string, any>) {
        if (event.request?.headers) {
          for (const header of ['authorization', 'cookie', 'x-api-key']) {
            if (event.request.headers[header]) {
              event.request.headers[header] = '[REDACTED]'
            }
          }
        }
        if (event.breadcrumbs) {
          for (const breadcrumb of event.breadcrumbs) {
            if (breadcrumb.data) {
              for (const key of Object.keys(breadcrumb.data)) {
                const lk = key.toLowerCase()
                if (lk.includes('token') || lk.includes('key') ||
                    lk.includes('secret') || lk.includes('password') ||
                    lk.includes('credential') || lk.includes('auth')) {
                  breadcrumb.data[key] = '[REDACTED]'
                }
              }
            }
          }
        }
        return event
      },
    })

    const machineId = createHash('sha256').update(hostname() + homedir()).digest('hex').slice(0, 16)
    _sentry.setUser({ id: machineId })
  } catch {
    _sentry = noopSentry
  }
}

/** Get the Sentry instance (no-op if not initialized or DSN missing) */
export function getSentry(): SentryLike {
  return _sentry
}
