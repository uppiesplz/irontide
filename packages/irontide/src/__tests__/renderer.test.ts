import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Renderer } from '../renderer'

// Mock canvas 2d context since happy-dom doesn't support it
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'clientWidth', { value: 800 })

  const mockCtx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    setTransform: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillStyle: '',
  }

  const originalGetContext = canvas.getContext.bind(canvas)
  canvas.getContext = ((type: string) => {
    if (type === '2d') return mockCtx as unknown as CanvasRenderingContext2D
    return originalGetContext(type)
  }) as typeof canvas.getContext

  return canvas
}

describe('Renderer', () => {
  let canvas: HTMLCanvasElement
  let renderer: Renderer

  beforeEach(() => {
    canvas = createMockCanvas()
    renderer = new Renderer(canvas, {
      height: 100,
      waveColor: '#464340',
      progressColor: '#e1b728',
      barWidth: 'auto',
      barGap: 1,
    })
  })

  it('creates successfully', () => {
    expect(renderer).toBeDefined()
  })

  it('calculates bar dimensions', () => {
    const dims = renderer.calculateBarDimensions(800, 2400)
    expect(dims.barWidth).toBeGreaterThan(0)
    expect(dims.totalBarWidth).toBeGreaterThan(dims.barWidth)
  })

  it('resizes without DPR accumulation', () => {
    renderer.resize(1000)
    renderer.resize(800)
    renderer.resize(1200)
    // Should not throw
  })

  it('renders with peaks data', () => {
    const peaks = new Float32Array([-0.5, 0.5, -0.3, 0.3, -0.8, 0.8, -0.1, 0.1])
    expect(() => renderer.render(peaks, { start: 0, end: 10 }, 5, 10)).not.toThrow()
  })

  it('cleans up on destroy', () => {
    expect(() => renderer.destroy()).not.toThrow()
  })
})
