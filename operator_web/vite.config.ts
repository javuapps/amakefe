import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The operator console is not a PWA.
 *
 * Nothing about handling other people's money should work offline or be served
 * from a cache: a payout recorded against a stale ledger is a payout made
 * twice. There is no service worker and no install prompt, deliberately.
 */
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
  plugins: [react(), tailwindcss()],
})
