import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'

export type VoiceInputState = 'idle' | 'recording' | 'transcribing' | 'error'

interface UseVoiceInputOptions {
  onTranscribed?: (text: string) => void
  copyToClipboard?: boolean
}

/** Convert any audio blob to WAV using Web Audio API (the Whisper server only accepts WAV) */
async function convertToWav(blob: Blob): Promise<Uint8Array> {
  const audioCtx = new AudioContext({ sampleRate: 16000 })
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

    // Downmix to mono 16-bit PCM at 16kHz
    const pcmFloat = audioBuffer.getChannelData(0)
    const pcm16 = new Int16Array(pcmFloat.length)
    for (let i = 0; i < pcmFloat.length; i++) {
      const s = Math.max(-1, Math.min(1, pcmFloat[i]))
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // Build WAV file
    const wavHeader = new ArrayBuffer(44)
    const view = new DataView(wavHeader)
    const dataSize = pcm16.byteLength
    const fileSize = 36 + dataSize

    // RIFF header
    view.setUint32(0, 0x52494646, false)  // "RIFF"
    view.setUint32(4, fileSize, true)
    view.setUint32(8, 0x57415645, false)  // "WAVE"
    // fmt chunk
    view.setUint32(12, 0x666D7420, false) // "fmt "
    view.setUint32(16, 16, true)          // chunk size
    view.setUint16(20, 1, true)           // PCM format
    view.setUint16(22, 1, true)           // mono
    view.setUint32(24, 16000, true)       // sample rate
    view.setUint32(28, 32000, true)       // byte rate (16000 * 2)
    view.setUint16(32, 2, true)           // block align
    view.setUint16(34, 16, true)          // bits per sample
    // data chunk
    view.setUint32(36, 0x64617461, false) // "data"
    view.setUint32(40, dataSize, true)

    const wavBytes = new Uint8Array(44 + dataSize)
    wavBytes.set(new Uint8Array(wavHeader), 0)
    wavBytes.set(new Uint8Array(pcm16.buffer), 44)

    return wavBytes
  } finally {
    await audioCtx.close()
  }
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
          // Convert webm/ogg to WAV — Whisper server only accepts WAV
          const wavData = await convertToWav(blob)
          const result = await window.electronAPI.voiceInputTranscribe(wavData, 'audio/wav')

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
