export type LoadingStage = 'downloading' | 'decoding' | 'processing' | 'ready'
export type DecoderType = 'auto' | 'wasm' | 'web'

export interface WaveformOptions {
  container: string | HTMLElement
  src: string
  decoder?: DecoderType
  height?: number
  waveColor?: string
  progressColor?: string
  barWidth?: number | 'auto'
  barGap?: number
  interact?: boolean
  momentum?: boolean
  momentumDeceleration?: number
  /** Called during loading (before create() resolves). Use for progress UI. */
  onLoading?: (progress: number, stage: LoadingStage) => void
}

export interface WaveformEvents {
  loading: { progress: number; stage: LoadingStage }
  ready: undefined
  seek: number
  scroll: number
  error: Error
  warning: string
}

export interface RenderState {
  peaks: Float32Array | null
  visibleStart: number
  visibleEnd: number
  currentTime: number
  duration: number
}
