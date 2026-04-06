/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 3000,
    open: !process.env.VITE_API_URL,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:4990',
        changeOrigin: true,
      },
      '/events': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:4990',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
  }
})
