use wasm_bindgen::prelude::*;

mod audio_data;
mod decoder;

pub use audio_data::AudioData;

#[wasm_bindgen]
pub fn init_irontide() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(js_name = "decodeAudio")]
pub fn decode_audio(data: &[u8], progress_callback: &js_sys::Function) -> Result<AudioData, JsValue> {
    let callback = |progress: f64| {
        let _ = progress_callback.call1(&JsValue::NULL, &JsValue::from_f64(progress));
    };

    let decoded = decoder::decode(data, &callback)
        .map_err(|e| JsValue::from_str(&e))?;

    Ok(AudioData::new(decoded.samples, decoded.sample_rate, decoded.channels))
}
