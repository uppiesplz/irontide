import { describe, it, expect, vi } from 'vitest'

// Mock the WASM module so Vite doesn't try to load actual WASM
vi.mock('irontide-wasm', () => ({
  default: vi.fn().mockResolvedValue({}),
  init_irontide: vi.fn(),
  decodeAudio: vi.fn(),
  AudioData: vi.fn(),
}))

import { resolveDecoder } from '../loader'

describe('loader', () => {
  describe('resolveDecoder', () => {
    it('returns "wasm" when explicitly set', () => {
      expect(resolveDecoder('wasm')).toBe('wasm')
    })
    it('returns "web" when explicitly set', () => {
      expect(resolveDecoder('web')).toBe('web')
    })
    it('returns a valid decoder for "auto"', () => {
      expect(['wasm', 'web']).toContain(resolveDecoder('auto'))
    })
  })
})
