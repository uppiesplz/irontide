/* tslint:disable */
/* eslint-disable */

export class AudioData {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Calculate peaks for waveform rendering.
     * Returns flat [min0, max0, min1, max1, ...] array.
     */
    calculatePeaks(pixels: number, start_sample: number, end_sample: number): Float32Array;
    constructor(samples: Float32Array, sample_rate: number, channels: number);
    readonly channels: number;
    readonly duration: number;
    readonly is_empty: boolean;
    readonly len: number;
    readonly sample_rate: number;
}

export function decodeAudio(data: Uint8Array, progress_callback: Function): AudioData;

export function init_irontide(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly decodeAudio: (a: number, b: number, c: any) => [number, number, number];
    readonly init_irontide: () => void;
    readonly __wbg_audiodata_free: (a: number, b: number) => void;
    readonly audiodata_calculatePeaks: (a: number, b: number, c: number, d: number) => [number, number];
    readonly audiodata_channels: (a: number) => number;
    readonly audiodata_duration: (a: number) => number;
    readonly audiodata_is_empty: (a: number) => number;
    readonly audiodata_len: (a: number) => number;
    readonly audiodata_new: (a: number, b: number, c: number, d: number) => number;
    readonly audiodata_sample_rate: (a: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
