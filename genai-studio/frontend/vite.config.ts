import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    host: true,      // bind 0.0.0.0 in Docker
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000', // Docker DNS
        changeOrigin: true,
      },
    },
  },
})
