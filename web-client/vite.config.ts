import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/XmppTest/',
  resolve: {
    alias: {
      events: 'events',
    },
  },
  optimizeDeps: {
    include: ['events'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separare le librerie vendor principali
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'xmpp-vendor': ['stanza'],
          'db-vendor': ['idb'],
          // Separare i componenti pesanti
          'pages': [
            './src/pages/ChatPage',
            './src/pages/ConversationsPage',
          ],
          // Separare i servizi
          'services': [
            './src/services/xmpp',
            './src/services/messages',
            './src/services/conversations',
            './src/services/conversations-db',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
