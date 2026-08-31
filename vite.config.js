import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://213.199.36.106:8082',
        changeOrigin: true,
      },
    },
  },
})
