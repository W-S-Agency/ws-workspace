import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'

export type VoiceInputState = 'idle' | 'recording' | 'transcribing' | 'error'

interface UseVoiceInputOptions {
  onTranscribed?: (text: string) => void
  copyToClipboard?: boolean
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const [state, setState] = useState<VoiceInputState>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null

        if (blob.size < 1000) {
          setState('idle')
          return
        }

        setState('transcribing')

        try {
          const arrayBuffer = await blob.arrayBuffer()
          const audioData = new Uint8Array(arrayBuffer)
          const result = await window.electronAPI.voiceInputTranscribe(audioData, mimeType)

          if (result.text) {
            if (options.copyToClipboard) {
              await window.electronAPI.voiceInputCopyToClipboard(result.text)
              toast.success('Copied to clipboard', {
                description: result.text.substring(0, 80) + (result.text.length > 80 ? '...' : ''),
              })
            }
            options.onTranscribed?.(result.text)
          }

          setState('idle')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Transcription failed'
          toast.error('Voice input failed', { description: message })
          setState('idle')
        }
      }

      recorder.start(250)
      setState('recording')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone access denied'
      toast.error('Microphone error', { description: message })
      cleanup()
      setState('idle')
    }
  }, [options, cleanup])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (state === 'recording') {
      stopRecording()
    } else if (state === 'idle') {
      startRecording()
    }
  }, [state, startRecording, stopRecording])

  useEffect(() => cleanup, [cleanup])

  return {
    state,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
    toggleRecording,
  }
}
