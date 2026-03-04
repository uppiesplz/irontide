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
                if sample < min {
                    min = sample;
                }
                if sample > max {
                    max = sample;
                }
            }

            peaks.push(min);
            peaks.push(max);
        }

        peaks
    }
}
