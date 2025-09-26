// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // forward REST calls (backend uses PORT=5000 in backend/.env)
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      // forward WebSocket calls to backend WebSocket server
      '/ws': {
        target: 'ws://localhost:5001',
        ws: true
      }
    }
  }
})
