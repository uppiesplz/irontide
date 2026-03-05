import { defineConfig } from "vite";
import path from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
  },
  resolve: {
    alias: {
      "irontide-wasm": path.resolve(
        __dirname,
        "../../crates/irontide-core/pkg/irontide_core.js"
      ),
    },
  },
  test: {
    environment: "happy-dom",
  },
});
