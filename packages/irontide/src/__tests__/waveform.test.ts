import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock AudioData
function createMockAudioData(duration = 10) {
  return {
    calculatePeaks: vi.fn().mockReturnValue(new Float32Array(20)),
    duration,
    sample_rate: 44100,
    len: duration * 44100,
    channels: 1,
    free: vi.fn(),
  }
}

// Mock loadAudio
const mockLoadAudio = vi.fn()
vi.mock('../loader', () => ({
  initIrontide: vi.fn().mockResolvedValue({}),
  isWasmAvailable: vi.fn().mockReturnValue(true),
  resolveDecoder: vi.fn().mockReturnValue('wasm'),
  loadAudio: (...args: unknown[]) => mockLoadAudio(...args),
}))

// Mock Renderer to avoid canvas 2d context issues in happy-dom
vi.mock('../renderer', () => ({
  Renderer: vi.fn().mockImplementation(() => ({
    resize: vi.fn(),
    calculateBarDimensions: vi.fn().mockReturnValue({ barWidth: 3, totalBarWidth: 4 }),
    render: vi.fn(),
    destroy: vi.fn(),
  })),
}))

import { Waveform } from '../waveform'

function createContainer(): HTMLElement {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ width: 800, height: 128, top: 0, left: 0, bottom: 128, right: 800 }),
  })
  document.body.appendChild(container)
  return container
}

describe('Waveform', () => {
  let container: HTMLElement

  beforeEach(() => {
    vi.clearAllMocks()
    container = createContainer()
  })

  describe('create()', () => {
    it('creates an instance with correct duration', async () => {
      const audioData = createMockAudioData(10)
      mockLoadAudio.mockResolvedValue({ audioData })

      const wf = await Waveform.create({ container, src: 'test.mp3' })
      expect(wf).toBeInstanceOf(Waveform)
      expect(wf.getDuration()).toBe(10)
      expect(wf.getCurrentTime()).toBe(0)

      wf.destroy()
    })

    it('frees audio data and removes canvas if construction fails after load', async () => {
      const audioData = createMockAudioData(10)
      audioData.calculatePeaks = vi.fn(() => { throw new Error('render boom') })
      mockLoadAudio.mockResolvedValue({ audioData })

      // Force any canvas created by Waveform.create to have a nonzero clientWidth
      // so render() reaches calculatePeaks (which throws).
      const realCreateElement = document.createElement.bind(document)
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        const el = realCreateElement(tag)
        if (tag === 'canvas') {
          Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true })
        }
        return el
      }) as typeof document.createElement)

      await expect(
        Waveform.create({ container, src: 'test.mp3' })
      ).rejects.toThrow('render boom')

      expect(audioData.free).toHaveBeenCalled()
      expect(container.querySelector('canvas')).toBeNull()

      createElementSpy.mockRestore()
    })
  })

  describe('load()', () => {
    it('swaps audio data and emits ready', async () => {
      const audioData1 = createMockAudioData(10)
      const audioData2 = createMockAudioData(30)
      mockLoadAudio
        .mockResolvedValueOnce({ audioData: audioData1 })
        .mockResolvedValueOnce({ audioData: audioData2 })

      const wf = await Waveform.create({ container, src: 'track1.mp3' })
      expect(wf.getDuration()).toBe(10)

      const readyHandler = vi.fn()
      wf.on('ready', readyHandler)

      await wf.load('track2.mp3')

      expect(wf.getDuration()).toBe(30)
      expect(readyHandler).toHaveBeenCalledOnce()

      wf.destroy()
    })

    it('frees old AudioData before loading new', async () => {
      const audioData1 = createMockAudioData(10)
      const audioData2 = createMockAudioData(20)
      mockLoadAudio
        .mockResolvedValueOnce({ audioData: audioData1 })
        .mockResolvedValueOnce({ audioData: audioData2 })

      const wf = await Waveform.create({ container, src: 'track1.mp3' })
      await wf.load('track2.mp3')

      expect(audioData1.free).toHaveBeenCalledOnce()

      wf.destroy()
    })

    it('resets playback state', async () => {
      const audioData1 = createMockAudioData(10)
      const audioData2 = createMockAudioData(20)
      mockLoadAudio
        .mockResolvedValueOnce({ audioData: audioData1 })
        .mockResolvedValueOnce({ audioData: audioData2 })

      const wf = await Waveform.create({ container, src: 'track1.mp3' })
      wf.setCurrentTime(5)
      wf.zoom(100)

      await wf.load('track2.mp3')

      expect(wf.getCurrentTime()).toBe(0)
      expect(wf.getZoom()).toBe(0)
      expect(wf.getScrollPosition()).toBe(0)

      wf.destroy()
    })

    it('emits loading events during load', async () => {
      const audioData1 = createMockAudioData(10)
      const audioData2 = createMockAudioData(20)
      mockLoadAudio
        .mockResolvedValueOnce({ audioData: audioData1 })
        .mockImplementationOnce(async (_src, _decoder, onProgress) => {
          onProgress?.(50, 'downloading')
          onProgress?.(100, 'ready')
          return { audioData: audioData2 }
        })

      const wf = await Waveform.create({ container, src: 'track1.mp3' })

      const loadingHandler = vi.fn()
      wf.on('loading', loadingHandler)

      await wf.load('track2.mp3')

      expect(loadingHandler).toHaveBeenCalledWith({ progress: 50, stage: 'downloading' })
      expect(loadingHandler).toHaveBeenCalledWith({ progress: 100, stage: 'ready' })

      wf.destroy()
    })

    it('preserves event listeners across loads', async () => {
      const audioData1 = createMockAudioData(10)
      const audioData2 = createMockAudioData(20)
      const audioData3 = createMockAudioData(15)
      mockLoadAudio
        .mockResolvedValueOnce({ audioData: audioData1 })
        .mockResolvedValueOnce({ audioData: audioData2 })
        .mockResolvedValueOnce({ audioData: audioData3 })

      const wf = await Waveform.create({ container, src: 'track1.mp3' })

      const readyHandler = vi.fn()
      wf.on('ready', readyHandler)

      await wf.load('track2.mp3')
      expect(readyHandler).toHaveBeenCalledTimes(1)

      await wf.load('track3.mp3')
      expect(readyHandler).toHaveBeenCalledTimes(2)

      wf.destroy()
    })
  })
})
