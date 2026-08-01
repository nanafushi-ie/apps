import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "pages-build",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.source.html",
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/chunk-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
