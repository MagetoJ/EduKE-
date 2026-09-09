// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';



export default defineConfig({
   resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/react-app'),
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Automatically updates SW without waiting
      injectRegister: 'auto',
      workbox: {
        cleanupOutdatedCaches: true, // Clears old cache versions immediately
        skipWaiting: true,           // Bypasses waiting state for new SW
        clientsClaim: true,          // Takes control of open tabs immediately
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      devOptions: {
        enabled: true, // Enables SW testing in local dev mode
      },
    }),
  ],
});
