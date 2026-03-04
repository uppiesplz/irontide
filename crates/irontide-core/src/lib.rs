use wasm_bindgen::prelude::*;

mod audio_data;
mod decoder;

pub use audio_data::AudioData;

#[wasm_bindgen]
pub fn init_irontide() {
    console_error_panic_hook::set_once();
}
