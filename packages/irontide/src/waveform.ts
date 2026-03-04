import { EventEmitter } from './events'
import { Renderer } from './renderer'
import { InteractionManager } from './interaction'
import { initIrontide, loadAudio } from './loader'
import type { WaveformOptions, WaveformEvents, LoadingStage } from './types'

// WASM AudioData type (imported dynamically)
interface AudioData {
  calculatePeaks(pixels: number, startSample: number, endSample: number): Float32Array
  readonly duration: number
  readonly sample_rate: number
  readonly len: number
  readonly channels: number
  free(): void
}

const DEFAULT_OPTIONS = {
  decoder: 'auto' as const,
  height: 128,
  waveColor: '#464340',
  progressColor: '#e1b728',
  barWidth: 'auto' as const,
  barGap: 1,
  interact: true,
  momentum: true,
  momentumDeceleration: 0.95,
}

export class Waveform {
  private emitter = new EventEmitter()
  private renderer: Renderer
  private interaction: InteractionManager
  private audioData: AudioData
  private canvas: HTMLCanvasElement
  private container: HTMLElement
  private resizeObserver: ResizeObserver | null = null

  private _currentTime = 0
  private _duration = 0
  private _zoom = 1
  private _scrollPosition = 0 // 0-1, fraction of total duration at left edge
  private options: Required<
    Pick<
      WaveformOptions,
      | 'decoder'
      | 'height'
      | 'waveColor'
      | 'progressColor'
      | 'barWidth'
      | 'barGap'
      | 'interact'
      | 'momentum'
      | 'momentumDeceleration'
    >
  > &
    WaveformOptions

  private constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    renderer: Renderer,
    interaction: InteractionManager,
    audioData: AudioData,
    options: Waveform['options']
  ) {
    this.container = container
    this.canvas = canvas
    this.renderer = renderer
    this.interaction = interaction
    this.audioData = audioData
    this.options = options
    this._duration = audioData.duration

    this.wireInteraction()
    this.setupResizeHandling()
    this.render()
  }

  /**
   * Async factory: resolves container, initializes WASM, loads audio,
   * creates all components, and returns a ready Waveform instance.
   */
  static async create(userOptions: WaveformOptions): Promise<Waveform> {
    const options = { ...DEFAULT_OPTIONS, ...userOptions }

    // Resolve container
    const container =
      typeof options.container === 'string'
        ? document.querySelector<HTMLElement>(options.container)
        : options.container

    if (!container) {
      throw new Error(
        `Container not found: ${typeof userOptions.container === 'string' ? userOptions.container : 'element'}`
      )
    }

    // Create canvas
    const canvas = document.createElement('canvas')
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    container.appendChild(canvas)

    try {
      // Create EventEmitter for progress/error reporting
      const emitter = new EventEmitter()

      // Create renderer
      const renderer = new Renderer(canvas, {
        height: options.height,
        waveColor: options.waveColor,
        progressColor: options.progressColor,
        barWidth: options.barWidth,
        barGap: options.barGap,
      })

      // Create interaction manager
      const interaction = new InteractionManager(canvas, {
        interact: options.interact,
        momentum: options.momentum,
        momentumDeceleration: options.momentumDeceleration,
      })

      // Load audio
      const { audioData } = await loadAudio(
        options.src,
        options.decoder,
        (progress: number, stage: LoadingStage) => {
          emitter.emit('loading', { progress, stage })
        },
        (message: string) => {
          emitter.emit('warning', message)
        }
      )

      const instance = new Waveform(
        container,
        canvas,
        renderer,
        interaction,
        audioData,
        options
      )

      // Transfer any pre-create listeners
      instance.emitter = emitter
      instance.emitter.emit('ready', undefined)

      return instance
    } catch (error) {
      // Cleanup on failure
      container.removeChild(canvas)
      throw error
    }
  }

  // --- Public event API ---

  on<K extends keyof WaveformEvents>(
    event: K,
    handler: (data: WaveformEvents[K]) => void
  ): void {
    this.emitter.on(event as string, handler as any)
  }

  off<K extends keyof WaveformEvents>(
    event: K,
    handler: (data: WaveformEvents[K]) => void
  ): void {
    this.emitter.off(event as string, handler as any)
  }

  // --- Public methods ---

  setCurrentTime(time: number): void {
    this._currentTime = Math.max(0, Math.min(this._duration, time))
    this.autoScrollToPlayhead()
    this.render()
  }

  getCurrentTime(): number {
    return this._currentTime
  }

  getDuration(): number {
    return this._duration
  }

  zoom(level: number): void {
    this._zoom = Math.max(1, level)
    this.render()
  }

  getZoom(): number {
    return this._zoom
  }

  zoomIn(factor = 1.5): void {
    this.zoom(this._zoom * factor)
  }

  zoomOut(factor = 1.5): void {
    this.zoom(this._zoom / factor)
  }

  scrollToTime(time: number): void {
    if (this._duration <= 0) return
    this._scrollPosition = Math.max(0, Math.min(1, time / this._duration))
    this.render()
    this.emitter.emit('scroll', this._scrollPosition)
  }

  setScrollPosition(position: number): void {
    this._scrollPosition = Math.max(0, Math.min(1, position))
    this.render()
    this.emitter.emit('scroll', this._scrollPosition)
  }

  getScrollPosition(): number {
    return this._scrollPosition
  }

  setInteraction(enabled: boolean): void {
    this.interaction.setInteraction(enabled)
  }

  destroy(): void {
    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    // Destroy interaction manager
    this.interaction.destroy()

    // Destroy renderer
    this.renderer.destroy()

    // Remove canvas
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas)
    }

    // Remove all event listeners
    this.emitter.removeAll()

    // Free WASM AudioData
    if (this.audioData && typeof this.audioData.free === 'function') {
      this.audioData.free()
    }
  }

  // --- Internal methods ---

  private wireInteraction(): void {
    this.interaction.on('seek', (data: { ratio: number }) => {
      const { start, end } = this.getVisibleTimeRange()
      const visibleDuration = end - start
      const time = start + data.ratio * visibleDuration
      this._currentTime = Math.max(0, Math.min(this._duration, time))
      this.render()
      this.emitter.emit('seek', this._currentTime)
    })

    this.interaction.on('scroll', (data: { deltaPixels: number }) => {
      const canvasWidth = this.canvas.clientWidth
      if (canvasWidth <= 0 || this._duration <= 0) return

      const totalWidth = canvasWidth * this._zoom
      const scrollDelta = data.deltaPixels / totalWidth
      this._scrollPosition = Math.max(
        0,
        Math.min(1, this._scrollPosition - scrollDelta)
      )
      this.render()
      this.emitter.emit('scroll', this._scrollPosition)
    })

    this.interaction.on('zoom', (data: { scale: number }) => {
      this.zoom(this._zoom * data.scale)
    })
  }

  private setupResizeHandling(): void {
    if (typeof ResizeObserver === 'undefined') return

    this.resizeObserver = new ResizeObserver(() => {
      const width = this.container.clientWidth
      if (width > 0) {
        this.renderer.resize(width)
        this.render()
      }
    })
    this.resizeObserver.observe(this.container)
  }

  private getVisibleTimeRange(): { start: number; end: number } {
    const visibleFraction = 1 / this._zoom
    const start = this._scrollPosition * this._duration
    const end = Math.min(
      this._duration,
      start + visibleFraction * this._duration
    )
    return { start, end }
  }

  private autoScrollToPlayhead(): void {
    const { start, end } = this.getVisibleTimeRange()
    if (this._currentTime < start || this._currentTime > end) {
      // Scroll so playhead is at 25% from left
      const visibleDuration = end - start
      const targetStart = this._currentTime - visibleDuration * 0.25
      this._scrollPosition = Math.max(
        0,
        Math.min(1, targetStart / this._duration)
      )
    }
  }

  private render(): void {
    const canvasWidth = this.canvas.clientWidth
    if (canvasWidth <= 0 || !this.audioData) return

    const { start, end } = this.getVisibleTimeRange()
    const sampleRate = this.audioData.sample_rate
    const channels = this.audioData.channels
    const startSample = Math.floor(start * sampleRate * channels)
    const endSample = Math.min(
      this.audioData.len,
      Math.ceil(end * sampleRate * channels)
    )

    const { totalBarWidth } = this.renderer.calculateBarDimensions(
      canvasWidth,
      canvasWidth * this._zoom
    )
    const numBars = Math.floor(canvasWidth / totalBarWidth)

    if (numBars <= 0 || endSample <= startSample) return

    const peaks = this.audioData.calculatePeaks(numBars, startSample, endSample)

    this.renderer.render(
      peaks,
      { start, end },
      this._currentTime,
      this._duration
    )
  }
}
