# IronTide

High-performance audio waveform renderer powered by WebAssembly.

- **WASM-accelerated** — Audio decoding (Symphonia) and peak calculation run in WebAssembly
- **Automatic fallback** — Falls back to Web Audio API if WASM isn't available
- **Interactive** — Click to seek, pinch to zoom, momentum scrolling
- **Rendering only** — You control playback, IronTide renders the waveform
- **Zero dependencies** — Just the WASM binary and a thin TypeScript wrapper

## Quick Start

```ts
import { Waveform } from 'irontide'

const wf = await Waveform.create({
  container: '#waveform',
  src: 'audio.wav',
})

wf.on('seek', (time) => {
  audioElement.currentTime = time
})

// Update playhead position
wf.setCurrentTime(audioElement.currentTime)

// Zoom in
wf.zoom(200) // pixels per second
```

## License

MIT
