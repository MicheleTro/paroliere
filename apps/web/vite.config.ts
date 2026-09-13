import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Paroliere',
        short_name: 'Paroliere',
        description: 'Gioco di parole stile Paroliere/Boggle, in italiano.',
        theme_color: '#f4ecd8',
        background_color: '#f4ecd8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Il file del dizionario ha un nome versionato: cache-first, non cambia mai
        // contenuto. Il suo manifest.json va invece riverificato in rete a ogni
        // avvio per scoprire una nuova versione (RF-18).
        runtimeCaching: [
          {
            urlPattern: /\/dictionary\/manifest\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'dictionary-manifest' },
          },
          {
            urlPattern: /\/dictionary\/.+\.txt$/,
            handler: 'CacheFirst',
            options: { cacheName: 'dictionary-files' },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
});
