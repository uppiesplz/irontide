import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      'irontide': resolve(__dirname, '../../packages/irontide/src/index.ts'),
      'irontide-wasm': resolve(__dirname, '../../crates/irontide-core/pkg/irontide_core.js'),
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, '../..')],
    },
  },
})
