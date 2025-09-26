// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // forward REST calls
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      // forward WebSocket calls
      '/ws': {
        target: 'ws://localhost:5001',
        ws: true
      }
    }
  }
})
