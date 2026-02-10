/**
 * AgencySettingsPage
 *
 * Import and manage W&S Agency shared knowledge repos:
 * - Skills Library (131 skills organized L1-L9)
 * - Agency Memory (decisions, best practices, playbooks)
 *
 * Repos are cloned to ~/.ws-workspace/agency/ and auto-referenced
 * in ~/.claude/CLAUDE.md for Claude to use in all sessions.
 */

import { useState, useEffect, useCallback } from 'react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { routes } from '@/lib/navigate'
import { Spinner } from '@ws-workspace/ui'
import type { DetailsPageMeta } from '@/lib/navigation-registry'

import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
} from '@/components/settings'
import type { AgencyRepoStatus } from '../../../shared/types'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'agency',
}

type RepoId = 'skills-library' | 'agency-memory'

function AgencyRepoRow({
  repoId,
  label,
  description,
}: {
  repoId: RepoId
  label: string
  description: string
}) {
  const [status, setStatus] = useState<AgencyRepoStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    if (!window.electronAPI) return
    const s = await window.electronAPI.getAgencyRepoStatus(repoId)
    setStatus(s)
    if (s.error) setError(s.error)
  }, [repoId])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleImport = useCallback(async () => {
    if (!window.electronAPI) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.importAgencyRepo(repoId)
      if (!result.success) {
        setError(result.error || 'Import failed')
      }
      await loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsLoading(false)
    }
  }, [repoId, loadStatus])

  const handleUpdate = useCallback(async () => {
    if (!window.electronAPI) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.updateAgencyRepo(repoId)
      if (!result.success) {
        setError(result.error || 'Update failed')
      }
      await loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setIsLoading(false)
    }
  }, [repoId, loadStatus])

  const handleOpen = useCallback(() => {
    if (status?.path && window.electronAPI) {
      window.electronAPI.showInFolder(status.path)
    }
  }, [status])

  const formatDate = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return isoDate
    }
  }

  return (
    <>
      <SettingsRow label={label} description={description}>
        {isLoading ? (
          <div className="flex items-center gap-1.5">
            <Spinner className="mr-1" />
            <span className="text-xs text-muted-foreground">
              {status?.imported ? 'Updating...' : 'Importing...'}
            </span>
          </div>
        ) : status?.imported ? (
          <div className="flex items-center gap-2">
            {status.lastUpdated && (
              <span className="text-xs text-muted-foreground">
                {formatDate(status.lastUpdated)}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleOpen}>
              Open
            </Button>
            <Button variant="outline" size="sm" onClick={handleUpdate}>
              Update
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleImport}>
            Import
          </Button>
        )}
      </SettingsRow>
      {error && (
        <div className="px-4 pb-3 text-xs text-destructive">{error}</div>
      )}
    </>
  )
}

export default function AgencySettingsPage() {
  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title="Agency"
        actions={
          <HeaderMenu
            route={routes.view.settings('agency')}
            helpFeature="agency-settings"
          />
        }
      />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <div className="space-y-8">
              <SettingsSection
                title="Shared Knowledge"
                description="Import W&S Agency shared repos. Cloned to ~/.ws-workspace/agency/ and auto-referenced in ~/.claude/CLAUDE.md."
              >
                <SettingsCard>
                  <AgencyRepoRow
                    repoId="skills-library"
                    label="Skills Library"
                    description="131 skills organized L1-L9 for all agency workflows."
                  />
                  <AgencyRepoRow
                    repoId="agency-memory"
                    label="Agency Memory"
                    description="Decisions, best practices, playbooks, and templates."
                  />
                </SettingsCard>
              </SettingsSection>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
