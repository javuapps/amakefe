import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) return 'react'
          return
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Creator Studio · Mindful Moments',
        short_name: 'Creator Studio',
        description: 'Write, schedule and publish stories for the community.',
        start_url: '/',
        display: 'standalone',
        background_color: '#fbf7f0',
        theme_color: '#2e1f2b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        // The studio holds unpublished drafts. Nothing from the API is cached to
        // disk — only the app shell, so it opens offline.
        runtimeCaching: [],
      },
    }),
  ],
})
