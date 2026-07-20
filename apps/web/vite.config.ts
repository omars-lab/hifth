import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Hifth is a static, hash-routed, RTL-native PWA. No backend.
// The SVG corpus lives in public/assets and is precached lazily (runtime),
// not baked into the install precache — a 604-page corpus would blow the
// precache budget. Loop 6 adds pin-a-juz runtime caching; Loop 0 precaches
// only the shell so the app is installable and opens offline.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null, // registration handled in src/pwa.ts (install-prompt flow)
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Hifth — حفظ",
        short_name: "Hifth",
        description: "A navigation instrument for huffaz.",
        lang: "ar",
        dir: "rtl",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f4efe6",
        theme_color: "#f4efe6",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Shell only in the install precache. SVG pages are large and numerous;
        // they are runtime-cached on first view (see Loop 6 for pin-a-juz).
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["assets/pages/**"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/assets/pages/"),
            handler: "CacheFirst",
            options: {
              cacheName: "hifth-pages",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
