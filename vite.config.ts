import react from '@vitejs/plugin-react'
import { defineConfig, Plugin } from 'vite'
import path from 'node:path'

// カスタムプラグインを作成して環境変数を注入
function injectEnvPlugin(): Plugin {
  return {
    name: 'inject-env',
    transformIndexHtml(html) {
      return html.replace(
        '<!--app-auth-password-->',
        process.env.VITE_AUTH_PASSWORD || ''
      )
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), injectEnvPlugin()],
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