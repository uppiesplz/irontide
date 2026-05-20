import { irontideWasm } from 'irontide-wasm';

export declare type DecoderType = 'auto' | 'wasm' | 'web';

/**
 * Lazily initialize the WASM module. Returns a singleton promise
 * so the module is only loaded once.
 */
export declare function initIrontide(): Promise<WasmModule>;

export declare type LoadingStage = 'downloading' | 'decoding' | 'processing' | 'ready';

declare type WasmModule = irontideWasm;

export declare class Waveform {
    private emitter;
    private renderer;
    private interaction;
    private audioData;
    private canvas;
    private container;
    private resizeObserver;
    private _currentTime;
    private _duration;
    private _pixelsPerSecond;
    private _scrollPosition;
    private readonly minZoom;
    private readonly maxZoom;
    private _decoder;
    private peaksBuffer;
    private constructor();
    static create(userOptions: WaveformOptions): Promise<Waveform>;
    on<K extends keyof WaveformEvents>(event: K, handler: (data: WaveformEvents[K]) => void): void;
    off<K extends keyof WaveformEvents>(event: K, handler: (data: WaveformEvents[K]) => void): void;
    setCurrentTime(time: number): void;
    getCurrentTime(): number;
    getDuration(): number;
    /**
     * Set zoom level in pixels per second.
     * Use 0 to fit the entire waveform to the container width.
     */
    zoom(pixelsPerSecond: number): void;
    getZoom(): number;
    zoomIn(factor?: number): void;
    zoomOut(factor?: number): void;
    scrollToTime(time: number): void;
    setScrollPosition(position: number): void;
    /**
     * Set scroll offset in pixels (bypasses 0-1 normalization).
     * Use this when syncing to an external scroll container's scrollLeft.
     */
    setScrollOffset(offsetPixels: number): void;
    getScrollPosition(): number;
    setInteraction(enabled: boolean): void;
    load(src: string): Promise<void>;
    destroy(): void;
    private getEffectivePxPerSec;
    private getTotalWidth;
    private getScrollOffset;
    private getVisibleTimeRange;
    private wireInteraction;
    private setupResizeHandling;
    private render;
}

declare interface WaveformEvents {
    loading: {
        progress: number;
        stage: LoadingStage;
    };
    ready: undefined;
    seek: number;
    scroll: number;
    error: Error;
    warning: string;
}

export declare interface WaveformOptions {
    container: string | HTMLElement;
    src: string;
    decoder?: DecoderType;
    height?: number;
    waveColor?: string;
    progressColor?: string;
    barWidth?: number | 'auto';
    barGap?: number;
    interact?: boolean;
    momentum?: boolean;
    momentumDeceleration?: number;
    /** Called during loading (before create() resolves). Use for progress UI. */
    onLoading?: (progress: number, stage: LoadingStage) => void;
}

export { }
