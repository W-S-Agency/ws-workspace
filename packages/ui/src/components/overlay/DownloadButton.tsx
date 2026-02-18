/**
 * DownloadButton - Download content as a file
 *
 * Creates a Blob from the content and triggers a browser download.
 * Used in overlay headers for saving content to disk.
 */

import * as React from 'react'
import { useCallback } from 'react'
import { Download } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface DownloadButtonProps {
  /** Content to download */
  content: string
  /** Filename for the download */
  filename: string
  /** Optional MIME type (default: text/plain) */
  mimeType?: string
  /** Optional tooltip for the button */
  title?: string
  /** Optional className override */
  className?: string
}

export function DownloadButton({ content, filename, mimeType = 'text/plain', title = 'Download', className }: DownloadButtonProps) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [content, filename, mimeType])

  return (
    <button
      onClick={handleDownload}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors shrink-0 select-none',
        'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className
      )}
      title={title}
    >
      <Download className="w-3.5 h-3.5" />
    </button>
  )
}
