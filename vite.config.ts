import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  // .env files live in the project folder, not in src/.
  envDir: "..",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
