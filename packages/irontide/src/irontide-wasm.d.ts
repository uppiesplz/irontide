declare module 'irontide-wasm' {
  export class AudioData {
    free(): void
    calculatePeaks(pixels: number, start_sample: number, end_sample: number): Float32Array
    constructor(samples: Float32Array, sample_rate: number, channels: number)
    readonly channels: number
    readonly duration: number
    readonly is_empty: boolean
    readonly len: number
    readonly sample_rate: number
  }

  export function decodeAudio(data: Uint8Array, progress_callback: Function): AudioData
  export function init_irontide(): void

  export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module

  export default function init(module_or_path?: InitInput | Promise<InitInput>): Promise<any>
}
