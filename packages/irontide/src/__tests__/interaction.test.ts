import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InteractionManager } from '../interaction'

describe('InteractionManager', () => {
  let canvas: HTMLCanvasElement
  let manager: InteractionManager

  beforeEach(() => {
    canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'clientWidth', { value: 800 })
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 800, height: 100 }),
    })
    manager = new InteractionManager(canvas, {
      interact: true,
      momentum: true,
      momentumDeceleration: 0.95,
    })
  })

  it('emits seek on click', () => {
    const handler = vi.fn()
    manager.on('seek', handler)
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 400 }))
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ratio: expect.any(Number) }))
  })

  it('does not emit when disabled', () => {
    manager.setInteraction(false)
    const handler = vi.fn()
    manager.on('seek', handler)
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 400 }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('cleans up on destroy', () => {
    expect(() => manager.destroy()).not.toThrow()
  })
})
