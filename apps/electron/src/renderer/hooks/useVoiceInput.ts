import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'

export type VoiceInputState = 'idle' | 'recording' | 'transcribing' | 'error'

interface UseVoiceInputOptions {
  onTranscribed?: (text: string) => void
  copyToClipboard?: boolean
}

/** Build a WAV file from raw Float32 PCM samples (mono, 16-bit) */
function buildWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const pcm16 = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  const dataSize = pcm16.byteLength
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  view.setUint32(0, 0x52494646, false)  // "RIFF"
  view.setUint32(4, 36 + dataSize, true)
  view.setUint32(8, 0x57415645, false)  // "WAVE"
  // fmt chunk
  view.setUint32(12, 0x666D7420, false) // "fmt "
  view.setUint32(16, 16, true)          // chunk size
  view.setUint16(20, 1, true)           // PCM format
  view.setUint16(22, 1, true)           // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)           // block align
  view.setUint16(34, 16, true)          // bits per sample
  // data chunk
  view.setUint32(36, 0x64617461, false) // "data"
  view.setUint32(40, dataSize, true)

  const wav = new Uint8Array(buffer)
  wav.set(new Uint8Array(pcm16.buffer), 44)
  return wav
}

interface RecordingContext {
  audioCtx: AudioContext
  source: MediaStreamAudioSourceNode
  processor: ScriptProcessorNode
  stream: MediaStream
  chunks: Float32Array[]
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const [state, setState] = useState<VoiceInputState>('idle')
  const recordingRef = useRef<RecordingContext | null>(null)

  const cleanup = useCallback(() => {
    const rec = recordingRef.current
    if (rec) {
      rec.processor.disconnect()
      rec.source.disconnect()
      rec.stream.getTracks().forEach(track => track.stop())
      rec.audioCtx.close().catch(() => {})
      recordingRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)

      // Capture raw PCM via ScriptProcessorNode (no webm encoding)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      const chunks: Float32Array[] = []

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0)
        chunks.push(new Float32Array(input)) // copy
      }

      source.connect(processor)
      processor.connect(audioCtx.destination) // required for processor to fire

      recordingRef.current = { audioCtx, source, processor, stream, chunks }
      setState('recording')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone access denied'
      toast.error('Microphone error', { description: message })
      cleanup()
      setState('idle')
    }
  }, [cleanup])

  const stopRecording = useCallback(async () => {
    const rec = recordingRef.current
    if (!rec) return

    const { audioCtx, chunks } = rec
    const sampleRate = audioCtx.sampleRate
    cleanup()

    // Concatenate all PCM chunks
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
    if (totalLength < sampleRate * 0.5) {
      // Less than 0.5s of audio
      setState('idle')
      return
    }

    setState('transcribing')

    try {
      const allSamples = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        allSamples.set(chunk, offset)
        offset += chunk.length
      }

      const wavData = buildWav(allSamples, sampleRate)
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
  }, [options, cleanup])

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
