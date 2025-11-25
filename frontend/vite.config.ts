// @ts-nocheck
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/math/',
  resolve: {
    alias: {
      // Stub module for libs that import "web-worker"
      'web-worker': path.resolve(__dirname, 'src/shims/empty.ts'),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          vendor: ['axios', 'elkjs', 'lucide-react'],
        },
      },
    },
  },
})
