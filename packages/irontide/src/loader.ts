import type { DecoderType, LoadingStage } from './types'

// Lazy-loaded WASM module types
type WasmModule = typeof import('irontide-wasm')
type AudioData = InstanceType<WasmModule['AudioData']>

let wasmInitPromise: Promise<WasmModule> | null = null
let wasmModule: WasmModule | null = null
let wasmAvailable = false

/**
 * Lazily initialize the WASM module. Returns a singleton promise
 * so the module is only loaded once.
 */
export async function initIrontide(): Promise<WasmModule> {
  if (wasmModule) return wasmModule

  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      try {
        const mod = await import('irontide-wasm')
        // Initialize the WASM module
        const init = mod.default
        await init()
        mod.init_irontide()
        wasmModule = mod
        wasmAvailable = true
        return mod
      } catch (e) {
        wasmInitPromise = null
        wasmAvailable = false
        throw e
      }
    })()
  }

  return wasmInitPromise
}

/**
 * Check if WASM is available (has been successfully initialized).
 */
export function isWasmAvailable(): boolean {
  return wasmAvailable
}

/**
 * Resolve the decoder type to a concrete 'wasm' | 'web' choice.
 * For 'auto', defaults to 'wasm' if available, otherwise 'web'.
 */
export function resolveDecoder(decoder: DecoderType): 'wasm' | 'web' {
  if (decoder === 'wasm') return 'wasm'
  if (decoder === 'web') return 'web'
  // Auto: prefer wasm
  return wasmAvailable ? 'wasm' : 'web'
}

export interface LoadAudioResult {
  audioData: AudioData
}

type ProgressCallback = (progress: number, stage: LoadingStage) => void
type WarningCallback = (message: string) => void

/**
 * Load and decode audio from a URL.
 *
 * Progress stages:
 *   0-25%   = downloading
 *   25-60%  = decoding
 *   60-100% = processing (WASM AudioData construction for web path)
 */
export async function loadAudio(
  src: string,
  decoder: DecoderType,
  onProgress?: ProgressCallback,
  onWarning?: WarningCallback
): Promise<LoadAudioResult> {
  const emit = (progress: number, stage: LoadingStage) => {
    onProgress?.(progress, stage)
  }

  // Stage 1: Download (0-25%)
  emit(0, 'downloading')
  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await downloadWithProgress(response, (ratio) => {
    emit(ratio * 25, 'downloading')
  })
  emit(25, 'downloading')

  // Resolve decoder
  let resolvedDecoder = decoder
  if (decoder === 'auto') {
    try {
      await initIrontide()
      resolvedDecoder = 'wasm'
    } catch {
      onWarning?.('WASM initialization failed, falling back to Web Audio API')
      resolvedDecoder = 'web'
    }
  }

  const actualDecoder = resolveDecoder(resolvedDecoder)

  // Stage 2: Decode (25-60%)
  emit(25, 'decoding')

  let audioData: AudioData

  if (actualDecoder === 'wasm') {
    const mod = await initIrontide()
    const uint8 = new Uint8Array(arrayBuffer)
    audioData = mod.decodeAudio(uint8, (progress: number) => {
      emit(25 + progress * 35, 'decoding')
    })
    emit(60, 'decoding')
  } else {
    // Web Audio API path
    const audioContext = new AudioContext()
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      emit(60, 'decoding')

      // Stage 3: Process - transfer to WASM AudioData (60-100%)
      emit(60, 'processing')
      const mod = await initIrontide()

      // Interleave channels
      const channels = audioBuffer.numberOfChannels
      const length = audioBuffer.length
      const interleaved = new Float32Array(length * channels)

      for (let ch = 0; ch < channels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < length; i++) {
          interleaved[i * channels + ch] = channelData[i]
        }
        emit(60 + ((ch + 1) / channels) * 30, 'processing')
      }

      audioData = new mod.AudioData(interleaved, audioBuffer.sampleRate, channels)
    } finally {
      await audioContext.close()
    }
  }

  emit(100, 'ready')
  return { audioData }
}

/**
 * Download response body with progress tracking.
 */
async function downloadWithProgress(
  response: Response,
  onProgress: (ratio: number) => void
): Promise<ArrayBuffer> {
  const contentLength = response.headers.get('content-length')

  if (!contentLength || !response.body) {
    // No content-length header or no body stream: just get the whole thing
    const buffer = await response.arrayBuffer()
    onProgress(1)
    return buffer
  }

  const totalBytes = parseInt(contentLength, 10)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let receivedBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    receivedBytes += value.length
    onProgress(totalBytes > 0 ? receivedBytes / totalBytes : 0)
  }

  // Combine chunks into single ArrayBuffer
  const buffer = new ArrayBuffer(receivedBytes)
  const view = new Uint8Array(buffer)
  let offset = 0
  for (const chunk of chunks) {
    view.set(chunk, offset)
    offset += chunk.length
  }

  return buffer
}
