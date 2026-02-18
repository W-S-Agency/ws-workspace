/**
 * Voice Input Service
 *
 * Handles audio transcription via self-hosted Whisper instance.
 * Ported from D:/Claude/tools/voice-input/server.mjs.
 */

import { clipboard, globalShortcut, BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mainLog } from './logger'
import { IPC_CHANNELS } from '../shared/types'

const WHISPER_URL = 'https://whisper.srv2.it-reality.de'
const WHISPER_USER = 'admin'
const WHISPER_PASS = '0FuidVlyN47j4AeJgMSO_YP8A0b0WwVK'

// JWT token cache (22h TTL)
let cachedToken: string | null = null
let tokenExpiry = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const resp = await fetch(`${WHISPER_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: WHISPER_USER, password: WHISPER_PASS }),
  })

  if (!resp.ok) throw new Error(`Whisper login failed: ${resp.status}`)
  const { token } = await resp.json() as { token: string }
  cachedToken = token
  tokenExpiry = Date.now() + 22 * 3600_000
  mainLog.info('[voice-input] Authenticated')
  return token
}

/**
 * Upload audio via a child Node.js process.
 *
 * Electron's main process overrides global `fetch` with Chromium's net.fetch,
 * which corrupts multipart binary uploads (returns 500). Even `require('node:https')`
 * in the bundled CJS produces the same result — likely because esbuild or Electron
 * patches the TLS stack.
 *
 * Spawning a plain Node.js child process guarantees we use undici's fetch (the real
 * Node.js implementation) which works correctly — same as the standalone server.mjs.
 */
async function uploadAudio(buffer: Buffer, mimeType: string, token: string): Promise<{ id: number }> {
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'wav'
  const tmpFile = join(tmpdir(), `voice-upload-${Date.now()}.${ext}`)
  writeFileSync(tmpFile, buffer)
  mainLog.info(`[voice-input] Saved ${buffer.length} bytes to ${tmpFile}`)

  const script = `
    const fs = require('fs');
    const buffer = fs.readFileSync(process.argv[1]);
    const token = process.argv[2];
    const mimeType = process.argv[3];
    const WHISPER_URL = process.argv[4];
    const boundary = '----Boundary' + Date.now();
    const head = Buffer.from(
      '--' + boundary + '\\r\\n' +
      'Content-Disposition: form-data; name="file"; filename="voice.' + (mimeType.includes('wav') ? 'wav' : mimeType.includes('webm') ? 'webm' : 'ogg') + '"\\r\\n' +
      'Content-Type: ' + mimeType + '\\r\\n\\r\\n'
    );
    const tail = Buffer.from('\\r\\n--' + boundary + '--\\r\\n');
    const body = Buffer.concat([head, buffer, tail]);
    fetch(WHISPER_URL + '/api/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
      },
      body,
    })
    .then(r => r.text().then(t => { process.stdout.write(JSON.stringify({ status: r.status, body: t })); }))
    .catch(e => { process.stderr.write(e.message); process.exit(1); });
  `

  return new Promise((resolve, reject) => {
    execFile(process.execPath.includes('electron') ? 'node' : process.execPath, ['-e', script, tmpFile, token, mimeType, WHISPER_URL], {
      timeout: 30_000,
    }, (err, stdout, stderr) => {
      try { unlinkSync(tmpFile) } catch { /* ignore */ }

      if (err) {
        reject(new Error(`Upload child process failed: ${err.message} ${stderr}`))
        return
      }

      try {
        const result = JSON.parse(stdout)
        if (result.status !== 200 && result.status !== 201) {
          reject(new Error(`Upload failed: ${result.status} ${result.body}`))
          return
        }
        resolve(JSON.parse(result.body))
      } catch {
        reject(new Error(`Upload parse error: ${stdout.substring(0, 300)}`))
      }
    })
  })
}

async function pollDone(id: number, token: string, maxMs = 90_000): Promise<{ id: number; status: string; duration?: number }> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const resp = await fetch(`${WHISPER_URL}/api/transcriptions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await resp.json() as { id: number; status: string; duration?: number }

    if (data.status === 'done') return data
    if (data.status === 'error') throw new Error(`Whisper error for #${id}`)

    await new Promise(r => setTimeout(r, 1500))
  }
  throw new Error('Transcription timeout (90s)')
}

async function getText(transcription: { id: number }, token: string): Promise<string> {
  const id = transcription.id

  // Step 1: get signed download token
  const dlResp = await fetch(`${WHISPER_URL}/api/transcriptions/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const { url } = await dlResp.json() as { url: string }

  // Extract JWT token from the frontend URL path (whisper-dashboard bug workaround)
  const fileToken = url.split('/').pop()

  // Step 2: use correct backend path
  const fileResp = await fetch(`${WHISPER_URL}/api/transcriptions/file/${fileToken}/txt`)
  if (!fileResp.ok) throw new Error(`Text fetch failed: ${fileResp.status}`)

  return (await fileResp.text()).trim()
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function transcribeAudio(audioData: Buffer, mimeType: string): Promise<{ text: string; duration?: number }> {
  if (audioData.length < 1000) {
    throw new Error('Audio too short')
  }

  mainLog.info(`[voice-input] Transcribing ${audioData.length} bytes (${mimeType})`)
  const token = await getToken()
  const upload = await uploadAudio(audioData, mimeType, token)
  mainLog.info(`[voice-input] Uploaded -> ID #${upload.id}`)

  const done = await pollDone(upload.id, token)
  mainLog.info(`[voice-input] #${upload.id} done (${done.duration?.toFixed(1)}s audio)`)

  const text = await getText(done, token)
  mainLog.info(`[voice-input] Text: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`)

  return { text, duration: done.duration }
}

export function copyToClipboard(text: string): void {
  clipboard.writeText(text)
}

// ── Global Hotkey ─────────────────────────────────────────────────────────────

export function registerVoiceInputHotkey(): void {
  const accelerator = process.platform === 'darwin'
    ? 'Alt+Command+V'  // Cmd+Option+V on Mac
    : 'Alt+Super+V'    // Win+Alt+V on Windows

  const success = globalShortcut.register(accelerator, () => {
    mainLog.info('[voice-input] Global hotkey triggered')
    const win = BrowserWindow.getFocusedWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.VOICE_INPUT_HOTKEY_TRIGGERED)
    } else {
      // App not focused — find any window and bring to front
      const windows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed())
      if (windows.length > 0) {
        const target = windows[0]
        if (target.isMinimized()) target.restore()
        target.focus()
        target.webContents.send(IPC_CHANNELS.VOICE_INPUT_HOTKEY_TRIGGERED)
      }
    }
  })

  if (!success) {
    mainLog.warn(`[voice-input] Failed to register global shortcut: ${accelerator}`)
  } else {
    mainLog.info(`[voice-input] Registered global shortcut: ${accelerator}`)
  }
}

export function unregisterVoiceInputHotkey(): void {
  const accelerator = process.platform === 'darwin'
    ? 'Alt+Command+V'
    : 'Alt+Super+V'
  globalShortcut.unregister(accelerator)
}
