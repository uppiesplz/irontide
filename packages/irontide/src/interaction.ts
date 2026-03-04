import { EventEmitter } from './events'

export interface InteractionOptions {
  interact: boolean
  momentum: boolean
  momentumDeceleration: number
}

export class InteractionManager {
  private canvas: HTMLCanvasElement
  private options: InteractionOptions
  private emitter = new EventEmitter()
  private enabled: boolean
  private rafId: number | null = null
  private momentumRafId: number | null = null

  // Momentum state
  private velocity = 0
  private lastMoveTime = 0
  private lastMoveX = 0
  private isPanning = false

  // Touch state
  private touchStartX = 0
  private touchStartY = 0
  private initialPinchDistance: number | null = null

  // Bound handlers for cleanup
  private boundClick: (e: MouseEvent) => void
  private boundMouseDown: (e: MouseEvent) => void
  private boundMouseMove: (e: MouseEvent) => void
  private boundMouseUp: (e: MouseEvent) => void
  private boundWheel: (e: WheelEvent) => void
  private boundTouchStart: (e: TouchEvent) => void
  private boundTouchMove: (e: TouchEvent) => void
  private boundTouchEnd: (e: TouchEvent) => void

  constructor(canvas: HTMLCanvasElement, options: InteractionOptions) {
    this.canvas = canvas
    this.options = options
    this.enabled = options.interact

    this.boundClick = this.handleClick.bind(this)
    this.boundMouseDown = this.handleMouseDown.bind(this)
    this.boundMouseMove = this.handleMouseMove.bind(this)
    this.boundMouseUp = this.handleMouseUp.bind(this)
    this.boundWheel = this.handleWheel.bind(this)
    this.boundTouchStart = this.handleTouchStart.bind(this)
    this.boundTouchMove = this.handleTouchMove.bind(this)
    this.boundTouchEnd = this.handleTouchEnd.bind(this)

    if (this.enabled) {
      this.attachListeners()
    }
  }

  on(event: string, handler: (data: any) => void): void {
    this.emitter.on(event, handler)
  }

  off(event: string, handler: (data: any) => void): void {
    this.emitter.off(event, handler)
  }

  setInteraction(enabled: boolean): void {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (enabled) {
      this.attachListeners()
    } else {
      this.detachListeners()
    }
  }

  destroy(): void {
    this.detachListeners()
    this.stopMomentum()
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.emitter.removeAll()
  }

  private attachListeners(): void {
    this.canvas.addEventListener('click', this.boundClick)
    this.canvas.addEventListener('mousedown', this.boundMouseDown)
    this.canvas.addEventListener('wheel', this.boundWheel, { passive: false })
    this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false })
    this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false })
    this.canvas.addEventListener('touchend', this.boundTouchEnd)
  }

  private detachListeners(): void {
    this.canvas.removeEventListener('click', this.boundClick)
    this.canvas.removeEventListener('mousedown', this.boundMouseDown)
    this.canvas.removeEventListener('wheel', this.boundWheel)
    this.canvas.removeEventListener('touchstart', this.boundTouchStart)
    this.canvas.removeEventListener('touchmove', this.boundTouchMove)
    this.canvas.removeEventListener('touchend', this.boundTouchEnd)
    document.removeEventListener('mousemove', this.boundMouseMove)
    document.removeEventListener('mouseup', this.boundMouseUp)
  }

  private getCanvasRatio(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  private handleClick(e: MouseEvent): void {
    // Don't emit seek if we were panning
    if (this.isPanning) return
    // Middle button is for panning only
    if (e.button === 1) return
    const ratio = this.getCanvasRatio(e.clientX)
    this.emitter.emit('seek', { ratio })
  }

  private handleMouseDown(e: MouseEvent): void {
    // Middle mouse button for panning
    if (e.button === 1) {
      e.preventDefault()
      this.isPanning = true
      this.lastMoveX = e.clientX
      this.lastMoveTime = performance.now()
      this.velocity = 0
      document.addEventListener('mousemove', this.boundMouseMove)
      document.addEventListener('mouseup', this.boundMouseUp)
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isPanning) return

    if (this.rafId !== null) return

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      const now = performance.now()
      const deltaPixels = e.clientX - this.lastMoveX
      const deltaTime = now - this.lastMoveTime

      if (deltaTime > 0) {
        this.velocity = deltaPixels / deltaTime
      }

      this.lastMoveX = e.clientX
      this.lastMoveTime = now
      // Negate: drag right = scroll left (grab-and-drag behavior)
      this.emitter.emit('scroll', { deltaPixels: -deltaPixels })
    })
  }

  private handleMouseUp(_e: MouseEvent): void {
    document.removeEventListener('mousemove', this.boundMouseMove)
    document.removeEventListener('mouseup', this.boundMouseUp)

    if (this.isPanning && this.options.momentum && Math.abs(this.velocity) > 0.01) {
      this.startMomentum()
    }

    // Defer isPanning reset so the click handler can check it
    setTimeout(() => {
      this.isPanning = false
    }, 0)
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault()
    this.emitter.emit('scroll', { deltaPixels: e.deltaX || e.deltaY })
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX
      this.touchStartY = e.touches[0].clientY
      this.lastMoveX = e.touches[0].clientX
      this.lastMoveTime = performance.now()
      this.velocity = 0
    } else if (e.touches.length === 2) {
      e.preventDefault()
      this.initialPinchDistance = this.getPinchDistance(e.touches)
    } else if (e.touches.length === 3) {
      e.preventDefault()
      this.isPanning = true
      this.lastMoveX = e.touches[1].clientX
      this.lastMoveTime = performance.now()
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (this.rafId !== null) return

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null

      if (e.touches.length === 1) {
        // Single finger: drag-to-seek
        const ratio = this.getCanvasRatio(e.touches[0].clientX)
        const now = performance.now()
        const deltaTime = now - this.lastMoveTime

        if (deltaTime > 0) {
          this.velocity = (e.touches[0].clientX - this.lastMoveX) / deltaTime
        }

        this.lastMoveX = e.touches[0].clientX
        this.lastMoveTime = now
        this.emitter.emit('seek', { ratio })
      } else if (e.touches.length === 2 && this.initialPinchDistance !== null) {
        // Pinch zoom
        e.preventDefault()
        const currentDistance = this.getPinchDistance(e.touches)
        const scale = currentDistance / this.initialPinchDistance
        this.emitter.emit('zoom', { scale })
        this.initialPinchDistance = currentDistance
      } else if (e.touches.length === 3) {
        // Three-finger pan
        e.preventDefault()
        const now = performance.now()
        const deltaPixels = e.touches[1].clientX - this.lastMoveX
        const deltaTime = now - this.lastMoveTime

        if (deltaTime > 0) {
          this.velocity = deltaPixels / deltaTime
        }

        this.lastMoveX = e.touches[1].clientX
        this.lastMoveTime = now
        // Negate: drag right = scroll left (grab-and-drag behavior)
        this.emitter.emit('scroll', { deltaPixels: -deltaPixels })
      }
    })
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0) {
      this.initialPinchDistance = null

      if (this.options.momentum && Math.abs(this.velocity) > 0.01) {
        this.startMomentum()
      }

      this.isPanning = false
    }
  }

  private getPinchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private startMomentum(): void {
    this.stopMomentum()
    let lastTimestamp = performance.now()

    const step = () => {
      const now = performance.now()
      const deltaTime = now - lastTimestamp
      lastTimestamp = now

      this.velocity *= Math.pow(this.options.momentumDeceleration, deltaTime / 16)

      if (Math.abs(this.velocity) < 0.001) {
        this.velocity = 0
        this.momentumRafId = null
        return
      }

      // Negate velocity for consistent grab-and-drag direction
      const deltaPixels = -this.velocity * deltaTime
      this.emitter.emit('scroll', { deltaPixels })
      this.momentumRafId = requestAnimationFrame(step)
    }

    this.momentumRafId = requestAnimationFrame(step)
  }

  private stopMomentum(): void {
    if (this.momentumRafId !== null) {
      cancelAnimationFrame(this.momentumRafId)
      this.momentumRafId = null
    }
    this.velocity = 0
  }
}
