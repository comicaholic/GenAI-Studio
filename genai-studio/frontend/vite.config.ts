import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Switch proxy target based on an env flag; DOCKER=true only in docker-compose
const useDocker = process.env.DOCKER === 'true'
const target = useDocker ? 'http://backend:8000' : 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
      },
    },
  },
})
