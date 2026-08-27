import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { createRequire } from 'node:module'

const { version } = createRequire(import.meta.url)('./package.json')

// Tauri needs a fixed, predictable port; fails the build instead of picking
// another one so the Tauri dev-server config never silently drifts.
const port = 1420

export default defineConfig({
  plugins: [
    vue({
      // Vapor mode stays opt-in per-file (`<script setup vapor>`) rather than
      // global — see docs/architecture.md, "Vapor mode: точечное включение".
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    // Lets the updater store show a real "current version" during `pnpm dev`,
    // where the Tauri app API is unavailable — see src/stores/updater.ts.
    __APP_VERSION__: JSON.stringify(version),
  },
  clearScreen: false,
  server: {
    port,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
