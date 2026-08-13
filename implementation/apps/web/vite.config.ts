import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const applicationVersion = process.env.npm_package_version ?? "0.1.0";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(applicationVersion),
  },
  build: {
    rollupOptions: {
      output: {
        // The service worker precaches only these predictable shell asset paths.
        // Business data is never cached here.
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/chunk-[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
