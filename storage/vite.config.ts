import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { sites } from "./build/sites-vite-plugin";

export default defineConfig({
  base: "./",
  plugins: [react(), sites()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "index.source.html"),
    },
  },
});
