import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const applicationVersion = process.env.npm_package_version ?? "0.1.0";

function packageChunk(id: string): string | undefined {
  const moduleId = id.replaceAll("\\", "/");

  if (!moduleId.includes("/node_modules/")) return undefined;

  if (
    ["react", "react-dom", "react-router", "react-router-dom", "scheduler"].some((packageName) =>
      moduleId.includes(`/node_modules/${packageName}/`),
    )
  ) {
    return "react";
  }

  if (moduleId.includes("/node_modules/@supabase/")) return "supabase";

  if (
    moduleId.includes("/node_modules/@powersync/") ||
    moduleId.includes("/node_modules/@journeyapps/wa-sqlite/")
  ) {
    return "sync-runtime";
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(applicationVersion),
  },
  build: {
    rollupOptions: {
      output: {
        // Logical chunk names stay stable while content hashes make service
        // worker updates observable and prevent stale runtime assets.
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks: packageChunk,
      },
    },
  },
});
