import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // GitHub Pages用に相対パスを設定
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/aws-amplify') || id.includes('node_modules/@aws-amplify')) {
            return 'vendor-amplify';
          }
          if (id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
})