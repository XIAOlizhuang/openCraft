import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base:'/opencraft/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/opencraft_app/api': {
        target: 'http://172.40.225.172',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://172.40.225.172',
        changeOrigin: true,
      },
    },
  },
})
