import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Supabase and React change far less often than the app does; keeping
        // them in their own chunks means a content update does not re-download
        // them on a metered connection. Matched by path because supabase-js
        // reaches this app through @amakefe/core rather than directly.
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
        name: 'Mindful Moments with Amake Fe',
        short_name: 'Mindful Moments',
        description: 'Real stories about marriage, family and life.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fffdf9',
        theme_color: '#2e1f2b',
        categories: ['lifestyle', 'social'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        // Stories the reader has opened stay available offline — the audience is
        // on intermittent mobile data and reads in long sittings.
        runtimeCaching: [
          {
            urlPattern: /\/rest\/v1\/(cnt_story_cards|cnt_story_parts|cnt_categories)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'stories',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
})
