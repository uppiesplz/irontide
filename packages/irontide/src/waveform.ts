import { EventEmitter } from './events'
import { Renderer } from './renderer'
import { InteractionManager } from './interaction'
import { initIrontide, loadAudio } from './loader'
import type { WaveformOptions, WaveformEvents, LoadingStage, DecoderType } from './types'

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
  onLoading: undefined as WaveformOptions['onLoading'],
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
  private _pixelsPerSecond = 0 // 0 = fit to width
  private _scrollPosition = 0 // 0-1
  private readonly minZoom = 1
  private readonly maxZoom = 1000
  private _decoder: DecoderType = 'auto'

  private constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    renderer: Renderer,
    interaction: InteractionManager,
    audioData: AudioData,
    emitter: EventEmitter,
    decoder: DecoderType,
  ) {
    this.container = container
    this.canvas = canvas
    this.renderer = renderer
    this.interaction = interaction
    this.audioData = audioData
    this.emitter = emitter
    this._duration = audioData.duration
    this._decoder = decoder

    this.wireInteraction()
    this.setupResizeHandling()
    this.render()
  }

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

    let audioData: AudioData | null = null
    let renderer: Renderer | null = null
    let interaction: InteractionManager | null = null
    let instance: Waveform | null = null

    try {
      // Create emitter early so loading events can be routed
      const emitter = new EventEmitter()

      renderer = new Renderer(canvas, {
        height: options.height,
        waveColor: options.waveColor,
        progressColor: options.progressColor,
        barWidth: options.barWidth,
        barGap: options.barGap,
      })

      // Initial resize
      const rect = container.getBoundingClientRect()
      if (rect.width > 0) {
        renderer.resize(rect.width)
      }

      interaction = new InteractionManager(canvas, {
        interact: options.interact,
        momentum: options.momentum,
        momentumDeceleration: options.momentumDeceleration,
      })

      // Load audio — route progress to both the onLoading callback and event emitter
      const result = await loadAudio(
        options.src,
        options.decoder,
        (progress: number, stage: LoadingStage) => {
          options.onLoading?.(progress, stage)
          emitter.emit('loading', { progress, stage })
        },
        (message: string) => {
          emitter.emit('warning', message)
        },
      )
      audioData = result.audioData

      instance = new Waveform(
        container, canvas, renderer, interaction, audioData, emitter, options.decoder,
      )

      emitter.emit('ready', undefined)
      return instance
    } catch (error) {
      if (instance) {
        instance.destroy()
      } else {
        if (audioData && typeof audioData.free === 'function') {
          audioData.free()
        }
        interaction?.destroy()
        renderer?.destroy()
        if (canvas.parentElement) {
          canvas.parentElement.removeChild(canvas)
        }
      }
      throw error
    }
  }

  // --- Events ---

  on<K extends keyof WaveformEvents>(
    event: K,
    handler: (data: WaveformEvents[K]) => void,
  ): void {
    this.emitter.on(event as string, handler as any)
  }

  off<K extends keyof WaveformEvents>(
    event: K,
    handler: (data: WaveformEvents[K]) => void,
  ): void {
    this.emitter.off(event as string, handler as any)
  }

  // --- Public methods ---

  setCurrentTime(time: number): void {
    this._currentTime = Math.max(0, Math.min(this._duration, time))
    this.render()
  }

  getCurrentTime(): number {
    return this._currentTime
  }

  getDuration(): number {
    return this._duration
  }

  /**
   * Set zoom level in pixels per second.
   * Use 0 to fit the entire waveform to the container width.
   */
  zoom(pixelsPerSecond: number): void {
    if (pixelsPerSecond === 0) {
      this._pixelsPerSecond = 0
      this._scrollPosition = 0
    } else {
      this._pixelsPerSecond = Math.max(this.minZoom, Math.min(this.maxZoom, pixelsPerSecond))
    }
    this.render()
  }

  getZoom(): number {
    return this._pixelsPerSecond
  }

  zoomIn(factor = 2): void {
    this.zoom(this.getEffectivePxPerSec() * factor)
  }

  zoomOut(factor = 2): void {
    this.zoom(this.getEffectivePxPerSec() / factor)
  }

  scrollToTime(time: number): void {
    const totalWidth = this.getTotalWidth()
    const canvasWidth = this.canvas.clientWidth
    if (totalWidth <= canvasWidth) return

    const pxPerSec = this.getEffectivePxPerSec()
    const maxScroll = totalWidth - canvasWidth
    let offset = time * pxPerSec - canvasWidth / 2
    offset = Math.max(0, Math.min(maxScroll, offset))
    this._scrollPosition = offset / maxScroll
    this.render()
    this.emitter.emit('scroll', this._scrollPosition)
  }

  setScrollPosition(position: number): void {
    this._scrollPosition = Math.max(0, Math.min(1, position))
    this.render()
    this.emitter.emit('scroll', this._scrollPosition)
  }

  /**
   * Set scroll offset in pixels (bypasses 0-1 normalization).
   * Use this when syncing to an external scroll container's scrollLeft.
   */
  setScrollOffset(offsetPixels: number): void {
    const totalWidth = this.getTotalWidth()
    const canvasWidth = this.canvas.clientWidth
    if (totalWidth <= canvasWidth) {
      this._scrollPosition = 0
      this.render()
      return
    }
    const maxScroll = totalWidth - canvasWidth
    this._scrollPosition = Math.max(0, Math.min(1, offsetPixels / maxScroll))
    this.render()
    this.emitter.emit('scroll', this._scrollPosition)
  }

  getScrollPosition(): number {
    return this._scrollPosition
  }

  setInteraction(enabled: boolean): void {
    this.interaction.setInteraction(enabled)
  }

  async load(src: string): Promise<void> {
    // Free old WASM AudioData
    if (this.audioData && typeof this.audioData.free === 'function') {
      this.audioData.free()
    }

    const { audioData } = await loadAudio(
      src,
      this._decoder,
      (progress: number, stage: LoadingStage) => {
        this.emitter.emit('loading', { progress, stage })
      },
      (message: string) => {
        this.emitter.emit('warning', message)
      },
    )

    this.audioData = audioData
    this._duration = audioData.duration
    this._currentTime = 0
    this._scrollPosition = 0
    this._pixelsPerSecond = 0

    this.render()
    this.emitter.emit('ready', undefined)
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    this.interaction.destroy()
    this.renderer.destroy()
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas)
    }
    this.emitter.removeAll()
    if (this.audioData && typeof this.audioData.free === 'function') {
      this.audioData.free()
    }
  }

  // --- Internal ---

  private getEffectivePxPerSec(): number {
    if (this._pixelsPerSecond > 0) return this._pixelsPerSecond
    const canvasWidth = this.canvas.clientWidth
    return canvasWidth / this._duration
  }

  private getTotalWidth(): number {
    return this._duration * this.getEffectivePxPerSec()
  }

  private getScrollOffset(): number {
    const totalWidth = this.getTotalWidth()
    const canvasWidth = this.canvas.clientWidth
    if (totalWidth <= canvasWidth) return 0
    return this._scrollPosition * (totalWidth - canvasWidth)
  }

  private getVisibleTimeRange(): { start: number; end: number } {
    const scrollOffset = this.getScrollOffset()
    const canvasWidth = this.canvas.clientWidth
    const pxPerSec = this.getEffectivePxPerSec()
    return {
      start: Math.max(0, scrollOffset / pxPerSec),
      end: Math.min(this._duration, (scrollOffset + canvasWidth) / pxPerSec),
    }
  }

  private wireInteraction(): void {
    this.interaction.on('seek', (data: { ratio: number }) => {
      const { start, end } = this.getVisibleTimeRange()
      const time = start + data.ratio * (end - start)
      this._currentTime = Math.max(0, Math.min(this._duration, time))
      this.render()
      this.emitter.emit('seek', this._currentTime)
    })

    this.interaction.on('scroll', (data: { deltaPixels: number }) => {
      const totalWidth = this.getTotalWidth()
      const canvasWidth = this.canvas.clientWidth
      if (totalWidth <= canvasWidth) return

      const maxScroll = totalWidth - canvasWidth
      const currentOffset = this.getScrollOffset()
      const newOffset = Math.max(0, Math.min(maxScroll, currentOffset + data.deltaPixels))
      this._scrollPosition = newOffset / maxScroll
      this.render()
      this.emitter.emit('scroll', this._scrollPosition)
    })

    this.interaction.on('zoom', (data: { scale: number }) => {
      this.zoom(this.getEffectivePxPerSec() * data.scale)
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

  private render(): void {
    const canvasWidth = this.canvas.clientWidth
    if (canvasWidth <= 0 || !this.audioData) return

    const { start, end } = this.getVisibleTimeRange()
    const sampleRate = this.audioData.sample_rate

    // Sample indices are into the mono mix (not interleaved)
    const startSample = Math.floor(start * sampleRate)
    const endSample = Math.min(this.audioData.len, Math.ceil(end * sampleRate))

    const totalWidth = this.getTotalWidth()
    const { totalBarWidth } = this.renderer.calculateBarDimensions(canvasWidth, totalWidth)
    const numBars = Math.floor(canvasWidth / totalBarWidth)

    if (numBars <= 0 || endSample <= startSample) return

    const peaks = this.audioData.calculatePeaks(numBars, startSample, endSample)

    this.renderer.render(peaks, { start, end }, this._currentTime, this._duration)
  }
}
