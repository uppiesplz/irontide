import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from '../events'

describe('EventEmitter', () => {
  it('calls registered listeners', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    emitter.on('test', handler)
    emitter.emit('test', 42)
    expect(handler).toHaveBeenCalledWith(42)
  })

  it('supports multiple listeners', () => {
    const emitter = new EventEmitter()
    const h1 = vi.fn()
    const h2 = vi.fn()
    emitter.on('test', h1)
    emitter.on('test', h2)
    emitter.emit('test', 'data')
    expect(h1).toHaveBeenCalledWith('data')
    expect(h2).toHaveBeenCalledWith('data')
  })

  it('removes listeners with off()', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    emitter.on('test', handler)
    emitter.off('test', handler)
    emitter.emit('test', 'data')
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not throw when emitting with no listeners', () => {
    const emitter = new EventEmitter()
    expect(() => emitter.emit('test', 'data')).not.toThrow()
  })

  it('removeAll clears all listeners', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    emitter.on('a', handler)
    emitter.on('b', handler)
    emitter.removeAll()
    emitter.emit('a', null)
    emitter.emit('b', null)
    expect(handler).not.toHaveBeenCalled()
  })

  it('isolates errors from individual handlers', () => {
    const emitter = new EventEmitter()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const before = vi.fn()
    const throwing = vi.fn(() => { throw new Error('handler error') })
    const after = vi.fn()

    emitter.on('test', before)
    emitter.on('test', throwing)
    emitter.on('test', after)

    expect(() => emitter.emit('test', 'data')).not.toThrow()
    expect(before).toHaveBeenCalledWith('data')
    expect(throwing).toHaveBeenCalled()
    expect(after).toHaveBeenCalledWith('data')
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
