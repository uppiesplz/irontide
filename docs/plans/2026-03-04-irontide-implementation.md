# IronTide Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build IronTide from the ground up as a monorepo with Rust/WASM core and TypeScript library, matching all functionality from the original prototype.

**Architecture:** Monorepo with `crates/irontide-core` (Rust → WASM via wasm-pack) and `packages/irontide` (TypeScript via Vite library mode). Rust handles audio decoding (Symphonia) and peak calculation. TypeScript handles canvas rendering, user interaction, and the public API. Async factory pattern with typed event emitter.

**Tech Stack:** Rust + wasm-pack + wasm-bindgen, TypeScript + Vite, Vitest + Playwright, asdf for tooling (rust 1.93.0, nodejs 24.11.1)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `.tool-versions`
- Create: `crates/irontide-core/Cargo.toml`
- Create: `crates/irontide-core/src/lib.rs`
- Create: `packages/irontide/package.json`
- Create: `packages/irontide/tsconfig.json`
- Create: `packages/irontide/vite.config.ts`
- Create: `packages/irontide/src/index.ts`
- Create: `scripts/build-wasm.sh`
- Create: `.gitignore`

**Step 1: Create `.tool-versions`**

```
rust 1.93.0
nodejs 24.11.1
```

**Step 2: Create `.gitignore`**

```
node_modules/
dist/
target/
crates/irontide-core/pkg/
*.wasm
.vite/
```

**Step 3: Create Rust crate skeleton**

`crates/irontide-core/Cargo.toml`:
```toml
[package]
name = "irontide-core"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
js-sys = "0.3"
console_error_panic_hook = "0.1"

[dependencies.web-sys]
version = "0.3"
features = ["console"]

[dependencies.symphonia]
version = "0.5"
features = ["mp3", "wav", "pcm", "aac", "ogg", "flac"]

[profile.release]
opt-level = "s"
lto = true
```

`crates/irontide-core/src/lib.rs`:
```rust
use wasm_bindgen::prelude::*;

mod audio_data;
mod decoder;

pub use audio_data::AudioData;

#[wasm_bindgen]
pub fn init_irontide() {
    console_error_panic_hook::set_once();
}
```

**Step 4: Create wasm-pack build script**

`scripts/build-wasm.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../crates/irontide-core"
wasm-pack build --target web --release
```

**Step 5: Create TypeScript package skeleton**

`packages/irontide/package.json`:
```json
{
  "name": "irontide",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vite": "^6.2",
    "vitest": "^3.0",
    "happy-dom": "^17.0"
  }
}
```

`packages/irontide/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`packages/irontide/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],
    },
  },
  test: {
    environment: 'happy-dom',
  },
})
```

`packages/irontide/src/index.ts`:
```ts
export { Waveform } from './waveform'
export { initIrontide } from './loader'
export type { WaveformOptions, DecoderType, LoadingStage } from './types'
```

**Step 6: Verify scaffolding**

Run: `cd ~/Desktop/irontide && bash scripts/build-wasm.sh`
Expected: Fails (missing audio_data.rs and decoder.rs), but Cargo.toml is valid

Run: `cd ~/Desktop/irontide/packages/irontide && npm install`
Expected: Installs successfully

**Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold monorepo with Rust crate and TypeScript package"
```

---

### Task 2: Rust AudioData Module

**Files:**
- Create: `crates/irontide-core/src/audio_data.rs`

**Step 1: Write AudioData struct and peak calculation**

`crates/irontide-core/src/audio_data.rs`:
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct AudioData {
    mono_mix: Vec<f32>,
    sample_rate: u32,
    channels: u32,
    duration: f64,
}

#[wasm_bindgen]
impl AudioData {
    #[wasm_bindgen(constructor)]
    pub fn new(samples: Vec<f32>, sample_rate: u32, channels: u32) -> AudioData {
        let num_samples = samples.len() / channels as usize;
        let duration = num_samples as f64 / sample_rate as f64;

        // Pre-compute mono mix
        let mono_mix = if channels == 1 {
            samples
        } else {
            let mut mono = Vec::with_capacity(num_samples);
            let ch = channels as usize;
            for i in 0..num_samples {
                let mut sum = 0.0f32;
                for c in 0..ch {
                    sum += samples[i * ch + c];
                }
                mono.push(sum / ch as f32);
            }
            mono
        };

        AudioData {
            mono_mix,
            sample_rate,
            channels,
            duration,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.channels
    }

    #[wasm_bindgen(getter)]
    pub fn duration(&self) -> f64 {
        self.duration
    }

    #[wasm_bindgen(getter)]
    pub fn len(&self) -> usize {
        self.mono_mix.len()
    }

    #[wasm_bindgen(getter)]
    pub fn is_empty(&self) -> bool {
        self.mono_mix.is_empty()
    }

    /// Calculate peaks for waveform rendering.
    /// Returns flat [min0, max0, min1, max1, ...] array.
    #[wasm_bindgen(js_name = "calculatePeaks")]
    pub fn calculate_peaks(
        &self,
        pixels: usize,
        start_sample: usize,
        end_sample: usize,
    ) -> Vec<f32> {
        let start = start_sample.min(self.mono_mix.len());
        let end = end_sample.min(self.mono_mix.len());

        if start >= end || pixels == 0 {
            return vec![0.0; pixels * 2];
        }

        let samples_per_pixel = (end - start) as f64 / pixels as f64;
        let mut peaks = Vec::with_capacity(pixels * 2);

        for i in 0..pixels {
            let seg_start = start + (i as f64 * samples_per_pixel) as usize;
            let seg_end = start + (((i + 1) as f64) * samples_per_pixel) as usize;
            let seg_end = seg_end.min(end);

            if seg_start >= seg_end {
                peaks.push(0.0);
                peaks.push(0.0);
                continue;
            }

            let mut min = f32::MAX;
            let mut max = f32::MIN;

            for &sample in &self.mono_mix[seg_start..seg_end] {
                if sample < min { min = sample; }
                if sample > max { max = sample; }
            }

            peaks.push(min);
            peaks.push(max);
        }

        peaks
    }
}
```

**Step 2: Verify Rust compiles**

Run: `cd ~/Desktop/irontide/crates/irontide-core && cargo check`
Expected: Compiles (decoder.rs missing but not yet imported)

Wait — `lib.rs` imports `mod decoder;`. We need a stub.

**Step 3: Create decoder stub**

`crates/irontide-core/src/decoder.rs`:
```rust
// Symphonia decoder — implemented in Task 3
```

**Step 4: Verify compilation**

Run: `cd ~/Desktop/irontide/crates/irontide-core && cargo check`
Expected: PASS

**Step 5: Run wasm-pack build**

Run: `bash ~/Desktop/irontide/scripts/build-wasm.sh`
Expected: Builds successfully, produces `pkg/` directory

**Step 6: Commit**

```bash
git add crates/
git commit -m "feat(wasm): add AudioData struct with peak calculation"
```

---

### Task 3: Rust Decoder Module (Symphonia)

**Files:**
- Modify: `crates/irontide-core/src/decoder.rs`
- Modify: `crates/irontide-core/src/lib.rs`

**Step 1: Implement Symphonia decoder**

`crates/irontide-core/src/decoder.rs`:
```rust
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use std::io::Cursor;

pub struct DecodedAudio {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u32,
}

pub fn decode(data: &[u8], progress_callback: &dyn Fn(f64)) -> Result<DecodedAudio, String> {
    let cursor = Cursor::new(data.to_vec());
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

    let hint = Hint::new();
    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| format!("Failed to probe audio format: {e}"))?;

    let mut format = probed.format;

    let track = format
        .default_track()
        .ok_or("No audio tracks found")?;

    let channels = track.codec_params.channels
        .map(|c| c.count() as u32)
        .unwrap_or(2);

    let sample_rate = track.codec_params.sample_rate
        .unwrap_or(44100);

    let track_id = track.id;

    let dec_opts = DecoderOptions::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &dec_opts)
        .map_err(|e| format!("Failed to create decoder: {e}"))?;

    let mut all_samples: Vec<f32> = Vec::new();

    // Estimate total frames for progress (may not be available)
    let total_frames = track.codec_params.n_frames.unwrap_or(0);
    let mut frames_decoded: u64 = 0;

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(format!("Error reading packet: {e}")),
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => return Err(format!("Decode error: {e}")),
        };

        let spec = *decoded.spec();
        let num_frames = decoded.frames();
        let num_channels = spec.channels.count();

        let mut sample_buf = SampleBuffer::<f32>::new(
            num_frames as u64,
            spec,
        );
        sample_buf.copy_interleaved_ref(decoded);
        all_samples.extend_from_slice(sample_buf.samples());

        frames_decoded += num_frames as u64;
        if total_frames > 0 {
            let progress = (frames_decoded as f64 / total_frames as f64).min(1.0);
            progress_callback(progress);
        }

        // If we don't know total frames, report based on data consumed
        // (rough estimate, but better than nothing)
        let _ = num_channels; // suppress unused warning
    }

    if all_samples.is_empty() {
        return Err("No audio samples decoded".to_string());
    }

    Ok(DecodedAudio {
        samples: all_samples,
        sample_rate,
        channels,
    })
}
```

**Step 2: Wire decoder into lib.rs**

Replace `crates/irontide-core/src/lib.rs`:
```rust
use wasm_bindgen::prelude::*;

mod audio_data;
mod decoder;

pub use audio_data::AudioData;

#[wasm_bindgen]
pub fn init_irontide() {
    console_error_panic_hook::set_once();
}

/// Decode audio bytes using Symphonia.
/// Returns AudioData ready for peak calculation.
#[wasm_bindgen(js_name = "decodeAudio")]
pub fn decode_audio(
    data: &[u8],
    progress_callback: &js_sys::Function,
) -> Result<AudioData, JsValue> {
    let callback = |progress: f64| {
        let _ = progress_callback.call1(
            &JsValue::NULL,
            &JsValue::from_f64(progress),
        );
    };

    let decoded = decoder::decode(data, &callback)
        .map_err(|e| JsValue::from_str(&e))?;

    Ok(AudioData::new(
        decoded.samples,
        decoded.sample_rate,
        decoded.channels,
    ))
}
```

**Step 3: Build and verify**

Run: `bash ~/Desktop/irontide/scripts/build-wasm.sh`
Expected: Builds successfully

**Step 4: Commit**

```bash
git add crates/
git commit -m "feat(wasm): add Symphonia audio decoder with progress reporting"
```

---

### Task 4: TypeScript Types and Event Emitter

**Files:**
- Create: `packages/irontide/src/types.ts`
- Create: `packages/irontide/src/events.ts`
- Create: `packages/irontide/src/__tests__/events.test.ts`

**Step 1: Write the failing test for EventEmitter**

`packages/irontide/src/__tests__/events.test.ts`:
```ts
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
})
```

**Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/irontide/packages/irontide && npx vitest run`
Expected: FAIL — module '../events' not found

**Step 3: Write types.ts**

`packages/irontide/src/types.ts`:
```ts
export type LoadingStage = 'downloading' | 'decoding' | 'processing' | 'ready'

export type DecoderType = 'auto' | 'wasm' | 'web'

export interface WaveformOptions {
  container: string | HTMLElement
  src: string
  decoder?: DecoderType
  height?: number
  waveColor?: string
  progressColor?: string
  barWidth?: number | 'auto'
  barGap?: number
  interact?: boolean
  momentum?: boolean
  momentumDeceleration?: number
}

export interface WaveformEvents {
  loading: { progress: number; stage: LoadingStage }
  ready: undefined
  seek: number
  scroll: number
  error: Error
  warning: string
}

export interface RenderState {
  peaks: Float32Array | null
  visibleStart: number
  visibleEnd: number
  currentTime: number
  duration: number
}
```

**Step 4: Write events.ts**

`packages/irontide/src/events.ts`:
```ts
type Handler = (data: any) => void

export class EventEmitter {
  private listeners = new Map<string, Set<Handler>>()

  on(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach((handler) => handler(data))
  }

  removeAll(): void {
    this.listeners.clear()
  }
}
```

**Step 5: Run tests**

Run: `cd ~/Desktop/irontide/packages/irontide && npx vitest run`
Expected: All 5 tests PASS

**Step 6: Commit**

```bash
git add packages/irontide/src/types.ts packages/irontide/src/events.ts packages/irontide/src/__tests__/
git commit -m "feat(ts): add typed event emitter and type definitions"
```

---

### Task 5: Renderer Module

**Files:**
- Create: `packages/irontide/src/renderer.ts`
- Create: `packages/irontide/src/__tests__/renderer.test.ts`

**Step 1: Write the failing test**

`packages/irontide/src/__tests__/renderer.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Renderer } from '../renderer'

describe('Renderer', () => {
  let canvas: HTMLCanvasElement
  let renderer: Renderer

  beforeEach(() => {
    canvas = document.createElement('canvas')
    // happy-dom provides a minimal canvas
    Object.defineProperty(canvas, 'clientWidth', { value: 800 })
    renderer = new Renderer(canvas, {
      height: 100,
      waveColor: '#464340',
      progressColor: '#e1b728',
      barWidth: 'auto',
      barGap: 1,
    })
  })

  it('creates a 2d context', () => {
    expect(renderer).toBeDefined()
  })

  it('calculates bar dimensions', () => {
    const dims = renderer.calculateBarDimensions(800, 2400)
    expect(dims.barWidth).toBeGreaterThan(0)
    expect(dims.totalBarWidth).toBeGreaterThan(dims.barWidth)
  })

  it('resizes canvas with correct DPR handling', () => {
    renderer.resize(1000)
    // Should not throw, DPR transform should be reset not accumulated
    renderer.resize(800)
    renderer.resize(1200)
  })

  it('renders without errors when given peaks', () => {
    // 4 bars: [min0, max0, min1, max1, min2, max2, min3, max3]
    const peaks = new Float32Array([-0.5, 0.5, -0.3, 0.3, -0.8, 0.8, -0.1, 0.1])
    expect(() => {
      renderer.render(peaks, { start: 0, end: 10 }, 5, 10)
    }).not.toThrow()
  })

  it('cleans up on destroy', () => {
    expect(() => renderer.destroy()).not.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/irontide/packages/irontide && npx vitest run`
Expected: FAIL — '../renderer' not found

**Step 3: Implement renderer.ts**

`packages/irontide/src/renderer.ts`:
```ts
export interface RenderOptions {
  height: number
  waveColor: string
  progressColor: string
  barWidth: number | 'auto'
  barGap: number
}

export interface TimeRange {
  start: number
  end: number
}

export interface BarDimensions {
  barWidth: number
  gap: number
  totalBarWidth: number
}

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private options: RenderOptions
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement, options: RenderOptions) {
    this.canvas = canvas
    this.options = options
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D context')
    this.ctx = ctx
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = `${options.height}px`
  }

  resize(width: number): void {
    const dpr = window.devicePixelRatio || 1
    const height = this.options.height
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  calculateBarDimensions(canvasWidth: number, totalWidth: number): BarDimensions {
    let barWidth: number
    if (this.options.barWidth === 'auto' || this.options.barWidth <= 0) {
      const targetBars = Math.min(canvasWidth / 3, totalWidth / 3)
      barWidth = Math.max(1, Math.floor(canvasWidth / targetBars))
    } else {
      barWidth = this.options.barWidth
    }
    const gap = Math.min(this.options.barGap, barWidth)
    return { barWidth, gap, totalBarWidth: barWidth + gap }
  }

  render(
    peaks: Float32Array,
    visibleRange: TimeRange,
    currentTime: number,
    duration: number,
  ): void {
    const width = this.canvas.clientWidth
    const height = this.options.height
    const dpr = window.devicePixelRatio || 1

    this.ctx.clearRect(0, 0, width * dpr, height * dpr)

    const totalWidth = duration > 0 ? width : 0
    const { barWidth, gap } = this.calculateBarDimensions(width, totalWidth)
    const numBars = peaks.length / 2

    // Draw waveform bars
    this.drawBars(peaks, numBars, barWidth, gap, height, this.options.waveColor)

    // Draw progress overlay
    this.drawProgress(
      peaks, numBars, barWidth, gap, height,
      visibleRange, currentTime,
    )
  }

  private drawBars(
    peaks: Float32Array,
    numBars: number,
    barWidth: number,
    gap: number,
    height: number,
    color: string,
  ): void {
    const centerY = height / 2
    const amplitude = height / 2

    this.ctx.fillStyle = color

    for (let i = 0; i < numBars; i++) {
      const min = peaks[i * 2]
      const max = peaks[i * 2 + 1]
      const x = i * (barWidth + gap)
      const minY = centerY + min * amplitude
      const maxY = centerY + max * amplitude
      const barHeight = Math.max(barWidth, maxY - minY)
      const y = Math.max(0, Math.min(height - barHeight, minY))
      const clampedHeight = Math.min(barHeight, height - y)
      this.ctx.fillRect(x, y, barWidth, clampedHeight)
    }
  }

  private drawProgress(
    peaks: Float32Array,
    numBars: number,
    barWidth: number,
    gap: number,
    height: number,
    visibleRange: TimeRange,
    currentTime: number,
  ): void {
    const visibleDuration = visibleRange.end - visibleRange.start
    if (visibleDuration <= 0) return
    if (currentTime < visibleRange.start || currentTime > visibleRange.end) return

    const width = this.canvas.clientWidth
    const progressRatio = (currentTime - visibleRange.start) / visibleDuration
    const playheadX = progressRatio * width

    // Clip and redraw bars with progress color
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(0, 0, playheadX, height)
    this.ctx.clip()
    this.drawBars(peaks, numBars, barWidth, gap, height, this.options.progressColor)
    this.ctx.restore()

    // Draw playhead line
    this.ctx.strokeStyle = this.options.progressColor
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(playheadX, 0)
    this.ctx.lineTo(playheadX, height)
    this.ctx.stroke()
  }

  destroy(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}
```

**Step 4: Run tests**

Run: `cd ~/Desktop/irontide/packages/irontide && npx vitest run`
Expected: All renderer tests PASS

**Step 5: Commit**

```bash
git add packages/irontide/src/renderer.ts packages/irontide/src/__tests__/renderer.test.ts
git commit -m "feat(ts): add canvas renderer with DPR fix and cached peaks"
```

---

### Task 6: Interaction Manager

**Files:**
- Create: `packages/irontide/src/interaction.ts`
- Create: `packages/irontide/src/__tests__/interaction.test.ts`

**Step 1: Write the failing test**

`packages/irontide/src/__tests__/interaction.test.ts`:
```ts
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
    canvas.dispatchEvent(new MouseEvent('click', { offsetX: 400 }))
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ratio: expect.any(Number) }))
  })

  it('does not emit seek when interaction is disabled', () => {
    manager.setInteraction(false)
    const handler = vi.fn()
    manager.on('seek', handler)
    canvas.dispatchEvent(new MouseEvent('click', { offsetX: 400 }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('cleans up listeners on destroy', () => {
    expect(() => manager.destroy()).not.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/irontide/packages/irontide && npx vitest run`
Expected: FAIL — '../interaction' not found

**Step 3: Implement interaction.ts**

`packages/irontide/src/interaction.ts`:

This module handles: click-to-seek, middle-mouse panning, touch panning (3+ fingers), pinch-to-zoom (2 fingers), wheel scrolling, and momentum physics. It emits semantic events rather than calling waveform methods.

```ts
import { EventEmitter } from './events'

export interface InteractionOptions {
  interact: boolean
  momentum: boolean
  momentumDeceleration: number
}

export interface SeekEvent {
  ratio: number // 0-1 across canvas width
}

export interface ScrollEvent {
  deltaPixels: number
}

export interface PinchZoomEvent {
  scale: number
  centerRatio: number // 0-1 across canvas width
}

export class InteractionManager {
  private emitter = new EventEmitter()
  private canvas: HTMLCanvasElement
  private options: InteractionOptions

  // Drag state
  private isDragging = false

  // Middle mouse pan state
  private isMiddleMousePanning = false
  private middleMouseStartX = 0
  private middleMouseStartCallback: ((delta: number) => void) | null = null

  // Multi-touch pan state
  private isMultiTouchPanning = false
  private multiTouchStartX = 0

  // Pinch zoom state
  private isPinching = false
  private pinchStartDistance = 0

  // Momentum state
  private momentumVelocity = 0
  private momentumAnimationId: number | null = null
  private lastPanTime = 0
  private lastPanX = 0

  // rAF throttle
  private pendingRaf: number | null = null

  constructor(canvas: HTMLCanvasElement, options: InteractionOptions) {
    this.canvas = canvas
    this.options = options
    if (options.interact) {
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
    if (enabled && !this.options.interact) {
      this.attachListeners()
    } else if (!enabled && this.options.interact) {
      this.detachListeners()
    }
    this.options.interact = enabled
    this.canvas.style.cursor = enabled ? 'pointer' : 'default'
  }

  private attachListeners(): void {
    this.canvas.addEventListener('click', this.handleClick)
    this.canvas.addEventListener('mousedown', this.handleMouseDown)
    this.canvas.addEventListener('mousemove', this.handleMouseMove)
    this.canvas.addEventListener('mouseup', this.handleMouseUp)
    this.canvas.addEventListener('mouseleave', this.handleMouseUp)
    this.canvas.addEventListener('auxclick', this.handleAuxClick)
    this.canvas.addEventListener('contextmenu', this.handleContextMenu)
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false })
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false })
    this.canvas.addEventListener('touchend', this.handleTouchEnd)
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false })
  }

  private detachListeners(): void {
    this.canvas.removeEventListener('click', this.handleClick)
    this.canvas.removeEventListener('mousedown', this.handleMouseDown)
    this.canvas.removeEventListener('mousemove', this.handleMouseMove)
    this.canvas.removeEventListener('mouseup', this.handleMouseUp)
    this.canvas.removeEventListener('mouseleave', this.handleMouseUp)
    this.canvas.removeEventListener('auxclick', this.handleAuxClick)
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu)
    this.canvas.removeEventListener('touchstart', this.handleTouchStart)
    this.canvas.removeEventListener('touchmove', this.handleTouchMove)
    this.canvas.removeEventListener('touchend', this.handleTouchEnd)
    this.canvas.removeEventListener('wheel', this.handleWheel)
  }

  private getRatio(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  // --- Mouse handlers ---

  private handleClick = (e: MouseEvent): void => {
    if (!this.options.interact) return
    this.emitter.emit('seek', { ratio: this.getRatio(e.clientX) })
  }

  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button === 1) {
      e.preventDefault()
      this.isMiddleMousePanning = true
      this.middleMouseStartX = e.clientX
      this.lastPanX = e.clientX
      this.lastPanTime = performance.now()
      this.momentumVelocity = 0
      this.stopMomentum()
      this.canvas.style.cursor = 'grabbing'
      return
    }
    this.isDragging = true
    this.canvas.style.cursor = 'grabbing'
  }

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.isMiddleMousePanning) {
      this.throttledEmit('scroll', { deltaPixels: -(e.clientX - this.lastPanX) })
      this.trackVelocity(e.clientX)
      return
    }
    if (this.isDragging) {
      this.throttledEmit('seek', { ratio: this.getRatio(e.clientX) })
    }
  }

  private handleMouseUp = (_e: MouseEvent): void => {
    if (this.isMiddleMousePanning) {
      this.isMiddleMousePanning = false
      this.canvas.style.cursor = 'pointer'
      if (this.options.momentum && Math.abs(this.momentumVelocity) > 0.1) {
        this.startMomentum()
      }
      return
    }
    this.isDragging = false
    this.canvas.style.cursor = this.options.interact ? 'pointer' : 'default'
  }

  private handleAuxClick = (e: MouseEvent): void => {
    if (e.button === 1) e.preventDefault()
  }

  private handleContextMenu = (e: MouseEvent): void => {
    if (this.isMiddleMousePanning) e.preventDefault()
  }

  // --- Touch handlers ---

  private handleTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      e.preventDefault()
      this.isPinching = true
      this.pinchStartDistance = this.getPinchDistance(e.touches[0], e.touches[1])
      this.stopMomentum()
      return
    }
    if (e.touches.length >= 3) {
      e.preventDefault()
      this.isMultiTouchPanning = true
      this.multiTouchStartX = this.getAvgTouchX(e.touches)
      this.lastPanX = this.multiTouchStartX
      this.lastPanTime = performance.now()
      this.momentumVelocity = 0
      this.stopMomentum()
      return
    }
    e.preventDefault()
    this.isDragging = true
  }

  private handleTouchMove = (e: TouchEvent): void => {
    if (this.isPinching && e.touches.length === 2) {
      e.preventDefault()
      const dist = this.getPinchDistance(e.touches[0], e.touches[1])
      const scale = dist / this.pinchStartDistance
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      this.emitter.emit('pinch-zoom', {
        scale,
        centerRatio: this.getRatio(centerX),
      } satisfies PinchZoomEvent)
      return
    }
    if (this.isMultiTouchPanning && e.touches.length >= 3) {
      e.preventDefault()
      const avgX = this.getAvgTouchX(e.touches)
      this.throttledEmit('scroll', { deltaPixels: -(avgX - this.lastPanX) })
      this.trackVelocity(avgX)
      return
    }
    if (this.isDragging && e.touches.length === 1) {
      e.preventDefault()
      const ratio = this.getRatio(e.touches[0].clientX)
      this.throttledEmit('seek', { ratio })
    }
  }

  private handleTouchEnd = (e: TouchEvent): void => {
    if (this.isPinching && e.touches.length < 2) {
      this.isPinching = false
    }
    if (this.isMultiTouchPanning && e.touches.length < 3) {
      this.isMultiTouchPanning = false
      if (this.options.momentum && Math.abs(this.momentumVelocity) > 0.1) {
        this.startMomentum()
      }
    }
    if (this.isDragging && e.touches.length === 0) {
      this.isDragging = false
    }
  }

  // --- Wheel ---

  private handleWheel = (e: WheelEvent): void => {
    // Emit scroll — waveform decides whether to apply based on zoom level
    const delta = e.deltaX || e.deltaY
    this.stopMomentum()
    this.emitter.emit('wheel', { deltaPixels: delta })
    e.preventDefault()
  }

  // --- Momentum ---

  private trackVelocity(currentX: number): void {
    const now = performance.now()
    const dt = now - this.lastPanTime
    if (dt > 0) {
      const velocity = (currentX - this.lastPanX) / dt
      this.momentumVelocity = this.momentumVelocity * 0.5 + velocity * 0.5
    }
    this.lastPanX = currentX
    this.lastPanTime = now
  }

  private startMomentum(): void {
    let lastTime = performance.now()

    const animate = () => {
      const now = performance.now()
      const dt = now - lastTime
      lastTime = now

      // Use actual delta time for frame-rate independent physics
      const pixelDelta = -(this.momentumVelocity * dt)
      this.emitter.emit('scroll', { deltaPixels: pixelDelta })

      this.momentumVelocity *= Math.pow(this.options.momentumDeceleration, dt / 16.67)

      if (Math.abs(this.momentumVelocity) < 0.01) {
        this.stopMomentum()
        return
      }

      this.momentumAnimationId = requestAnimationFrame(animate)
    }

    this.momentumAnimationId = requestAnimationFrame(animate)
  }

  private stopMomentum(): void {
    if (this.momentumAnimationId !== null) {
      cancelAnimationFrame(this.momentumAnimationId)
      this.momentumAnimationId = null
    }
    this.momentumVelocity = 0
  }

  // --- Helpers ---

  private throttledEmit(event: string, data: any): void {
    if (this.pendingRaf !== null) return
    this.pendingRaf = requestAnimationFrame(() => {
      this.pendingRaf = null
      this.emitter.emit(event, data)
    })
  }

  private getPinchDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getAvgTouchX(touches: TouchList): number {
    let total = 0
    for (let i = 0; i < touches.length; i++) {
      total += touches[i].clientX
    }
    return total / touches.length
  }

  destroy(): void {
    this.detachListeners()
    this.stopMomentum()
    if (this.pendingRaf !== null) {
      cancelAnimationFrame(this.pendingRaf)
    }
    this.emitter.removeAll()
  }
}
```

**Step 4: Run tests**

Run: `cd ~/Desktop/irontide/packages/irontide && npx vitest run`
Expected: All interaction tests PASS

**Step 5: Commit**

```bash
git add packages/irontide/src/interaction.ts packages/irontide/src/__tests__/interaction.test.ts
git commit -m "feat(ts): add interaction manager with rAF throttle and delta-time momentum"
```

---

### Task 7: Audio Loader

**Files:**
- Create: `packages/irontide/src/loader.ts`
- Create: `packages/irontide/src/__tests__/loader.test.ts`

**Step 1: Write the failing test**

`packages/irontide/src/__tests__/loader.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
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
      const result = resolveDecoder('auto')
      expect(['wasm', 'web']).toContain(result)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/irontide/packages/irontide && npx vitest run`
Expected: FAIL — '../loader' not found

**Step 3: Implement loader.ts**

`packages/irontide/src/loader.ts`:
```ts
import type { DecoderType, LoadingStage } from './types'

type ProgressCallback = (progress: number, stage: LoadingStage) => void

// WASM module — lazily loaded
let wasmInitPromise: Promise<any> | null = null
let wasmModule: any = null

export async function initIrontide(): Promise<void> {
  if (wasmModule) return
  if (wasmInitPromise) {
    await wasmInitPromise
    return
  }

  wasmInitPromise = (async () => {
    try {
      const mod = await import('../../crates/irontide-core/pkg/irontide_core.js')
      await mod.default()
      mod.init_irontide()
      wasmModule = mod
    } catch (e) {
      wasmInitPromise = null
      throw e
    }
  })()

  await wasmInitPromise
}

export function isWasmAvailable(): boolean {
  return wasmModule !== null
}

export function resolveDecoder(decoder: DecoderType): 'wasm' | 'web' {
  if (decoder === 'wasm' || decoder === 'web') return decoder
  // 'auto' — prefer wasm if available
  return wasmModule ? 'wasm' : 'web'
}

interface LoadResult {
  audioData: any // WASM AudioData
  decoderUsed: 'wasm' | 'web'
}

export async function loadAudio(
  src: string,
  decoder: DecoderType,
  onProgress: ProgressCallback,
  onWarning: (msg: string) => void,
): Promise<LoadResult> {
  // Ensure WASM is initialized for 'auto' and 'wasm'
  if (decoder !== 'web') {
    try {
      await initIrontide()
    } catch (e) {
      if (decoder === 'wasm') throw e
      // 'auto' mode — fall back to web
      onWarning(`WASM initialization failed, falling back to Web Audio: ${e}`)
    }
  }

  const resolvedDecoder = resolveDecoder(decoder)

  // Download audio
  const arrayBuffer = await downloadAudio(src, onProgress)

  if (resolvedDecoder === 'wasm') {
    return loadWasm(arrayBuffer, onProgress)
  } else {
    return loadWeb(arrayBuffer, onProgress)
  }
}

async function downloadAudio(
  src: string,
  onProgress: ProgressCallback,
): Promise<ArrayBuffer> {
  onProgress(0, 'downloading')
  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Failed to load audio: ${response.status} ${response.statusText}`)
  }

  const contentLength = response.headers?.get?.('content-length')
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

  if (response.body && totalBytes > 0) {
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let receivedBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      receivedBytes += value.length
      onProgress((receivedBytes / totalBytes) * 25, 'downloading')
    }

    const allChunks = new Uint8Array(receivedBytes)
    let position = 0
    for (const chunk of chunks) {
      allChunks.set(chunk, position)
      position += chunk.length
    }
    return allChunks.buffer
  }

  onProgress(10, 'downloading')
  const buffer = await response.arrayBuffer()
  onProgress(25, 'downloading')
  return buffer
}

async function loadWasm(
  arrayBuffer: ArrayBuffer,
  onProgress: ProgressCallback,
): Promise<LoadResult> {
  onProgress(25, 'decoding')

  const { decodeAudio } = wasmModule
  const audioData = decodeAudio(new Uint8Array(arrayBuffer), (progress: number) => {
    onProgress(25 + progress * 35, 'decoding')
  })

  onProgress(100, 'ready')
  return { audioData, decoderUsed: 'wasm' }
}

async function loadWeb(
  arrayBuffer: ArrayBuffer,
  onProgress: ProgressCallback,
): Promise<LoadResult> {
  onProgress(25, 'decoding')

  const audioContext = new AudioContext()
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    onProgress(40, 'processing')

    // Transfer to WASM AudioData for peak calculation
    const { AudioData } = wasmModule
    const numChannels = audioBuffer.numberOfChannels
    const length = audioBuffer.length
    const interleaved = new Float32Array(length * numChannels)

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        interleaved[i * numChannels + channel] = channelData[i]
      }
      onProgress(40 + ((channel + 1) / numChannels) * 30, 'processing')
    }

    onProgress(70, 'processing')
    const audioData = new AudioData(interleaved, audioBuffer.sampleRate, numChannels)
    onProgress(100, 'ready')

    return { audioData, decoderUsed: 'web' }
  } finally {
    await audioContext.close()
  }
}
```

**Step 4: Run tests**

Run: `cd ~/Desktop/irontide/packages/irontide && npx vitest run`
Expected: All loader tests PASS

**Step 5: Commit**

```bash
git add packages/irontide/src/loader.ts packages/irontide/src/__tests__/loader.test.ts
git commit -m "feat(ts): add audio loader with auto decoder fallback and progress tracking"
```

---

### Task 8: Waveform Coordinator Class

**Files:**
- Create: `packages/irontide/src/waveform.ts`
- Modify: `packages/irontide/src/index.ts`

**Step 1: Implement waveform.ts**

`packages/irontide/src/waveform.ts`:
```ts
import { EventEmitter } from './events'
import { Renderer } from './renderer'
import { InteractionManager } from './interaction'
import { loadAudio, initIrontide } from './loader'
import type { WaveformOptions, WaveformEvents } from './types'

const DEFAULTS: Required<Omit<WaveformOptions, 'container' | 'src'>> = {
  decoder: 'auto',
  height: 100,
  waveColor: '#464340',
  progressColor: '#e1b728',
  barWidth: 'auto',
  barGap: 1,
  interact: true,
  momentum: true,
  momentumDeceleration: 0.95,
}

export class Waveform {
  private emitter = new EventEmitter()
  private renderer: Renderer
  private interaction: InteractionManager
  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private resizeObserver: ResizeObserver | null = null

  private audioData: any = null
  private options: Required<Omit<WaveformOptions, 'container' | 'src'>>
  private duration = 0
  private currentTime = 0
  private pixelsPerSecond = 0 // 0 = fit to width
  private scrollPosition = 0
  private readonly minZoom = 1
  private readonly maxZoom = 1000

  private constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    renderer: Renderer,
    interaction: InteractionManager,
    audioData: any,
    options: Required<Omit<WaveformOptions, 'container' | 'src'>>,
  ) {
    this.container = container
    this.canvas = canvas
    this.renderer = renderer
    this.interaction = interaction
    this.audioData = audioData
    this.options = options
    this.duration = audioData.duration

    this.wireInteraction()
    this.setupResizeHandling()
    this.render()
  }

  static async create(options: WaveformOptions): Promise<Waveform> {
    const opts = { ...DEFAULTS, ...options }

    // Resolve container
    let container: HTMLElement
    if (typeof options.container === 'string') {
      const el = document.querySelector(options.container)
      if (!el) throw new Error(`Container not found: ${options.container}`)
      container = el as HTMLElement
    } else {
      container = options.container
    }

    container.style.position = container.style.position || 'relative'
    container.style.overflow = 'hidden'

    // Create canvas
    const canvas = document.createElement('canvas')
    container.appendChild(canvas)

    // Create renderer
    const renderer = new Renderer(canvas, {
      height: opts.height,
      waveColor: opts.waveColor,
      progressColor: opts.progressColor,
      barWidth: opts.barWidth,
      barGap: opts.barGap,
    })

    // Initial resize
    const rect = container.getBoundingClientRect()
    renderer.resize(rect.width)

    // Create a temporary emitter for loading events
    const tempEmitter = new EventEmitter()

    // Create interaction manager
    const interaction = new InteractionManager(canvas, {
      interact: opts.interact,
      momentum: opts.momentum,
      momentumDeceleration: opts.momentumDeceleration,
    })

    // Ensure WASM is ready
    if (opts.decoder !== 'web') {
      try {
        await initIrontide()
      } catch (e) {
        if (opts.decoder === 'wasm') {
          canvas.remove()
          throw e
        }
      }
    }

    // Load audio
    let loadResult
    try {
      loadResult = await loadAudio(
        options.src,
        opts.decoder,
        (progress, stage) => tempEmitter.emit('loading', { progress, stage }),
        (msg) => tempEmitter.emit('warning', msg),
      )
    } catch (e) {
      canvas.remove()
      throw e
    }

    const wf = new Waveform(
      container, canvas, renderer, interaction,
      loadResult.audioData, opts,
    )

    // Transfer any listeners from temp emitter (loading events already fired)
    wf.emitter.emit('ready', undefined)

    return wf
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
    this.currentTime = Math.max(0, Math.min(this.duration, time))
    this.autoScrollToPlayhead()
    this.render()
  }

  getCurrentTime(): number {
    return this.currentTime
  }

  getDuration(): number {
    return this.duration
  }

  zoom(pixelsPerSecond: number): void {
    if (pixelsPerSecond === 0) {
      this.pixelsPerSecond = 0
      this.scrollPosition = 0
    } else {
      this.pixelsPerSecond = Math.max(this.minZoom, Math.min(this.maxZoom, pixelsPerSecond))
    }
    this.render()
  }

  getZoom(): number {
    return this.pixelsPerSecond
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
    this.scrollPosition = offset / maxScroll
    this.render()
  }

  setScrollPosition(position: number): void {
    this.scrollPosition = Math.max(0, Math.min(1, position))
    this.render()
  }

  getScrollPosition(): number {
    return this.scrollPosition
  }

  setInteraction(enabled: boolean): void {
    this.interaction.setInteraction(enabled)
  }

  destroy(): void {
    this.resizeObserver?.disconnect()
    this.interaction.destroy()
    this.renderer.destroy()
    this.canvas.remove()
    this.emitter.removeAll()
    this.audioData?.free?.()
    this.audioData = null
  }

  // --- Internal ---

  private wireInteraction(): void {
    this.interaction.on('seek', (e: { ratio: number }) => {
      const { start, end } = this.getVisibleTimeRange()
      const time = start + e.ratio * (end - start)
      this.currentTime = Math.max(0, Math.min(this.duration, time))
      this.render()
      this.emitter.emit('seek', this.currentTime)
    })

    this.interaction.on('scroll', (e: { deltaPixels: number }) => {
      const totalWidth = this.getTotalWidth()
      const canvasWidth = this.canvas.clientWidth
      if (totalWidth <= canvasWidth) return

      const maxScroll = totalWidth - canvasWidth
      const currentOffset = this.scrollPosition * maxScroll
      const newOffset = Math.max(0, Math.min(maxScroll, currentOffset + e.deltaPixels))
      this.scrollPosition = newOffset / maxScroll
      this.render()
      this.emitter.emit('scroll', this.scrollPosition)
    })

    this.interaction.on('wheel', (e: { deltaPixels: number }) => {
      const totalWidth = this.getTotalWidth()
      const canvasWidth = this.canvas.clientWidth
      if (totalWidth <= canvasWidth) return

      const maxScroll = totalWidth - canvasWidth
      const currentOffset = this.scrollPosition * maxScroll
      const newOffset = Math.max(0, Math.min(maxScroll, currentOffset + e.deltaPixels))
      this.scrollPosition = newOffset / maxScroll
      this.render()
      this.emitter.emit('scroll', this.scrollPosition)
    })

    this.interaction.on('pinch-zoom', (e: { scale: number; centerRatio: number }) => {
      const canvasWidth = this.canvas.clientWidth
      const scrollOffset = this.getScrollOffset()
      const anchorTime = (scrollOffset + e.centerRatio * canvasWidth) / this.getEffectivePxPerSec()

      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.getEffectivePxPerSec() * e.scale))
      const anchorScreenX = anchorTime * this.getEffectivePxPerSec() - scrollOffset

      this.pixelsPerSecond = newZoom
      const newTotalWidth = this.duration * this.pixelsPerSecond
      const newMaxScroll = Math.max(0, newTotalWidth - canvasWidth)
      const newScrollOffset = anchorTime * this.pixelsPerSecond - anchorScreenX
      this.scrollPosition = newMaxScroll > 0 ? newScrollOffset / newMaxScroll : 0

      this.render()
    })
  }

  private setupResizeHandling(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.renderer.resize(entry.contentRect.width)
        this.render()
      }
    })
    this.resizeObserver.observe(this.container)
  }

  private getEffectivePxPerSec(): number {
    if (this.pixelsPerSecond > 0) return this.pixelsPerSecond
    return this.canvas.clientWidth / this.duration
  }

  private getTotalWidth(): number {
    return this.duration * this.getEffectivePxPerSec()
  }

  private getScrollOffset(): number {
    const totalWidth = this.getTotalWidth()
    const canvasWidth = this.canvas.clientWidth
    if (totalWidth <= canvasWidth) return 0
    return this.scrollPosition * (totalWidth - canvasWidth)
  }

  private getVisibleTimeRange(): { start: number; end: number } {
    const scrollOffset = this.getScrollOffset()
    const canvasWidth = this.canvas.clientWidth
    const pxPerSec = this.getEffectivePxPerSec()
    return {
      start: Math.max(0, scrollOffset / pxPerSec),
      end: Math.min(this.duration, (scrollOffset + canvasWidth) / pxPerSec),
    }
  }

  private autoScrollToPlayhead(): void {
    const { start, end } = this.getVisibleTimeRange()
    const buffer = (end - start) * 0.1
    if (this.currentTime < start + buffer || this.currentTime > end - buffer) {
      this.scrollToTime(this.currentTime)
    }
  }

  private render(): void {
    if (!this.audioData) return

    const canvasWidth = this.canvas.clientWidth
    const { start, end } = this.getVisibleTimeRange()
    const sampleRate = this.audioData.sample_rate
    const startSample = Math.floor(start * sampleRate)
    const endSample = Math.floor(end * sampleRate)

    const totalWidth = this.getTotalWidth()
    const { totalBarWidth } = this.renderer.calculateBarDimensions(canvasWidth, totalWidth)
    const numBars = Math.ceil(canvasWidth / totalBarWidth)

    const peaks = this.audioData.calculatePeaks(numBars, startSample, endSample)

    this.renderer.render(peaks, { start, end }, this.currentTime, this.duration)
  }
}
```

**Step 2: Verify index.ts exports are correct**

`packages/irontide/src/index.ts` already has:
```ts
export { Waveform } from './waveform'
export { initIrontide } from './loader'
export type { WaveformOptions, DecoderType, LoadingStage } from './types'
```

**Step 3: Run all tests**

Run: `cd ~/Desktop/irontide/packages/irontide && npx vitest run`
Expected: All tests PASS (events, renderer, interaction, loader)

**Step 4: Commit**

```bash
git add packages/irontide/src/waveform.ts packages/irontide/src/index.ts
git commit -m "feat(ts): add Waveform coordinator with async factory and event system"
```

---

### Task 9: WASM Build Integration and Smoke Test

**Files:**
- Modify: `scripts/build-wasm.sh` (make executable)
- Modify: `packages/irontide/package.json` (add build:wasm script)

**Step 1: Make build script executable and add npm script**

```bash
chmod +x ~/Desktop/irontide/scripts/build-wasm.sh
```

Add to `packages/irontide/package.json` scripts:
```json
"build:wasm": "bash ../../scripts/build-wasm.sh",
"build:all": "npm run build:wasm && npm run build"
```

**Step 2: Run full WASM build**

Run: `cd ~/Desktop/irontide && bash scripts/build-wasm.sh`
Expected: Builds successfully, `crates/irontide-core/pkg/` contains `.wasm`, `.js`, `.d.ts`

**Step 3: Run TypeScript build**

Run: `cd ~/Desktop/irontide/packages/irontide && npm run build`
Expected: Builds to `dist/`

**Step 4: Commit**

```bash
git add scripts/ packages/irontide/package.json
git commit -m "chore: wire up WASM and TypeScript build pipeline"
```

---

### Task 10: Demo Page

**Files:**
- Create: `examples/basic/index.html`

**Step 1: Create demo page**

Port the existing demo from the original project with the new API. Use `Waveform.create()`, event listeners instead of callback options, proper error handling.

Reference the original at `/Users/maia/projects/personal/irontide/index.html` for the UI structure and controls. Key changes:
- `await Waveform.create({...})` instead of `new Waveform({...})`
- `wf.on('seek', ...)` instead of `onSeek` option
- `wf.on('loading', ...)` instead of `onLoading` option
- `try/catch` around `Waveform.create()` for error handling

**Step 2: Test manually**

Run: `cd ~/Desktop/irontide/examples/basic && python3 -m http.server 8080`
Open: `http://localhost:8080`
Verify: WASM loads, audio decodes, waveform renders, zoom/seek/pan all work

**Step 3: Commit**

```bash
git add examples/
git commit -m "feat: add basic demo page with new API"
```

---

### Task 11: E2E Tests with Playwright

**Files:**
- Create: `tests/e2e/waveform.spec.ts`
- Create: `playwright.config.ts`
- Modify: `packages/irontide/package.json` (add playwright dep)

**Step 1: Install Playwright**

```bash
cd ~/Desktop/irontide/packages/irontide && npm install -D @playwright/test
npx playwright install chromium
```

**Step 2: Create Playwright config**

`playwright.config.ts` at repo root:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8080',
  },
  webServer: {
    command: 'python3 -m http.server 8080 --directory examples/basic',
    port: 8080,
  },
})
```

**Step 3: Write E2E test**

`tests/e2e/waveform.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('loads and renders waveform', async ({ page }) => {
  await page.goto('/')
  // Wait for WASM to initialize
  await expect(page.locator('#status')).not.toContainText('Error', { timeout: 10000 })
})

test('canvas element exists', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible({ timeout: 10000 })
})
```

**Step 4: Run E2E tests**

Run: `cd ~/Desktop/irontide && npx playwright test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/e2e/ playwright.config.ts packages/irontide/package.json packages/irontide/package-lock.json
git commit -m "test: add Playwright E2E tests for waveform loading"
```

---

### Task 12: Final Review and Merge to Main

**Step 1: Run all tests**

```bash
cd ~/Desktop/irontide/packages/irontide && npx vitest run
cd ~/Desktop/irontide && npx playwright test
```

**Step 2: Review code**

Use superpowers:requesting-code-review to review the full implementation against the design doc.

**Step 3: Merge to main**

```bash
git checkout main
git merge develop --no-ff -m "feat: IronTide v0.1.0 — complete rewrite with WASM core and TypeScript library"
```
