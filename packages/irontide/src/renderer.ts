export interface RendererOptions {
  height: number
  waveColor: string
  progressColor: string
  barWidth: number | 'auto'
  barGap: number
}

export interface BarDimensions {
  barWidth: number
  gap: number
  totalBarWidth: number
}

export interface VisibleRange {
  start: number
  end: number
}

export class Renderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private options: RendererOptions
  private dpr: number

  constructor(canvas: HTMLCanvasElement, options: RendererOptions) {
    this.canvas = canvas
    this.options = options
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Unable to get 2d canvas context')
    }
    this.ctx = ctx

    this.resize(canvas.clientWidth)
  }

  resize(width: number): void {
    const { height } = this.options
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    // Use setTransform (not scale) to avoid DPR accumulation
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  calculateBarDimensions(canvasWidth: number, totalWidth: number): BarDimensions {
    let barWidth: number
    const gap = this.options.barGap

    if (this.options.barWidth === 'auto') {
      // Auto-calculate bar width based on pixel density
      // Aim for roughly 3-4 CSS pixels per bar at standard density
      const targetBarWidth = Math.max(1, Math.round(3 / this.dpr) || 1)
      barWidth = targetBarWidth
    } else {
      barWidth = this.options.barWidth
    }

    const totalBarWidth = barWidth + gap

    return { barWidth, gap, totalBarWidth }
  }

  render(
    peaks: Float32Array,
    visibleRange: VisibleRange,
    currentTime: number,
    duration: number
  ): void {
    const ctx = this.ctx
    const width = this.canvas.clientWidth
    const height = this.options.height
    const midY = height / 2

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    if (peaks.length === 0 || duration === 0) return

    const { barWidth, totalBarWidth } = this.calculateBarDimensions(width, width)
    const barCount = Math.floor(width / totalBarWidth)
    const pairCount = peaks.length / 2

    // Draw waveform bars
    ctx.fillStyle = this.options.waveColor
    for (let i = 0; i < barCount && i < pairCount; i++) {
      const min = peaks[i * 2]
      const max = peaks[i * 2 + 1]
      const x = i * totalBarWidth
      const topY = midY - max * midY
      const bottomY = midY - min * midY
      const barHeight = Math.max(1, bottomY - topY)
      ctx.fillRect(x, topY, barWidth, barHeight)
    }

    // Draw progress overlay using clip region (reuses same peaks data)
    const progressRatio = duration > 0 ? currentTime / duration : 0
    const { start, end } = visibleRange
    const visibleDuration = end - start
    const progressInView = visibleDuration > 0
      ? (currentTime - start) / visibleDuration
      : 0
    const playheadX = Math.max(0, Math.min(width, progressInView * width))

    if (playheadX > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, playheadX, height)
      ctx.clip()

      ctx.fillStyle = this.options.progressColor
      for (let i = 0; i < barCount && i < pairCount; i++) {
        const min = peaks[i * 2]
        const max = peaks[i * 2 + 1]
        const x = i * totalBarWidth
        const topY = midY - max * midY
        const bottomY = midY - min * midY
        const barHeight = Math.max(1, bottomY - topY)
        ctx.fillRect(x, topY, barWidth, barHeight)
      }

      ctx.restore()
    }

    // Draw playhead line
    if (playheadX > 0 && playheadX < width) {
      ctx.fillStyle = this.options.progressColor
      ctx.fillRect(Math.round(playheadX) - 0.5, 0, 1, height)
    }
  }

  destroy(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}
