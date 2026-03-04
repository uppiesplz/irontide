import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
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
