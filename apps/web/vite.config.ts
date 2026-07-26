import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * The commit this bundle was built from.
 *
 * Hifth is GPL-3.0-or-later, and publishing a static site *conveys* the program:
 * the browser is handed real copies of the JS and of `assets/roots/**`, which
 * are a GPL-covered derivative of the Quranic Arabic Corpus. §6 then requires
 * the reader to be offered the Corresponding Source — and "corresponding" means
 * *this* build, not whatever `main` happens to hold when they follow the link.
 * A deploy that cannot name its own commit cannot make that offer, so the
 * commit is resolved at build time and baked in.
 *
 * The order is deployment-first: Cloudflare Pages and GitHub Actions both hand
 * us the SHA in the environment, and neither guarantees a usable `.git` in the
 * build container. Local `git` is the developer's case, and "dev" is the
 * honest answer when there is no commit to name (a dirty working tree served
 * by `vite dev` corresponds to nothing published).
 */
function sourceCommit(): string {
  const fromEnv = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

// Hifth is a static, hash-routed, RTL-native PWA. No backend.
// The SVG corpus lives in public/assets and is cached at runtime, not baked
// into the install precache — a 604-page corpus would blow the precache budget.
// Loop 0 precached the shell so the app is installable; Loop 6a made the
// runtime side explicit, one strategy per asset class (see `workbox` below).
// Pin-a-juz packs are Loop 6b — they need the corpus vendored (Loop 4b) first.
export default defineConfig({
  base: "./",
  define: {
    __SOURCE_COMMIT__: JSON.stringify(sourceCommit()),
  },
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
        /*
         * Three asset classes, three strategies (Loop 6a). They differ in every
         * dimension that should drive the choice — size, mutability, and what a
         * cache miss costs offline — so one blanket strategy would be wrong for
         * two of them.
         *
         * 1. SHELL + REGISTRY → precache (install-time, revisioned).
         *    A few hundred KB of hashed JS/CSS/HTML/fonts, plus
         *    `assets/manifest.json` — the registry that tells the app which
         *    pages and polygons exist. Without the registry a cold offline
         *    start renders nothing at all, so it is the one data file worth
         *    install-time bytes. Everything here is small, versioned by the
         *    build, and needed on every single boot.
         */
        //    (favicon.svg comes in via `includeAssets` above.)
        globPatterns: ["**/*.{js,css,html,woff2}", "assets/manifest.json"],
        // Belt and braces: the mushaf corpus must never enter the precache —
        // 604 pages × ~160 KB would make the install download the whole book.
        globIgnores: ["assets/pages/**"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        // Fill the offline cache from the *first* visit rather than the second:
        // without claiming, the tab that ran the install stays uncontrolled, so
        // every page and shard it fetches bypasses the SW entirely. Claiming is
        // not skipWaiting — updates still wait for the `prompt` flow.
        clientsClaim: true,
        runtimeCaching: [
          {
            /*
             * 2. MUSHAF PAGES → CacheFirst, LRU-capped, no expiry.
             *    ~160 KB each and **immutable** by cross-loop rule: a page's
             *    bytes never change, and a different print is a different
             *    edition at a different path. So revalidation could only ever
             *    cost a round trip and confirm what we have — CacheFirst is
             *    both the fastest and the most offline-honest choice.
             *    No maxAgeSeconds deliberately: a time-expired page is a page
             *    that vanishes offline, which is precisely the failure this
             *    cache exists to prevent. The bound is entry count, and it is
             *    wider than the DOM budget (PLAN §4: current + adjacent
             *    mounted, LRU ~6) — DOM nodes are expensive, cached bytes are
             *    not, so keeping a juz-ish trail of visited pages costs ~5 MB
             *    and saves every back-hop a download.
             */
            urlPattern: ({ url }) => url.pathname.includes("/assets/pages/"),
            handler: "CacheFirst",
            options: {
              cacheName: "hifth-pages",
              expiration: { maxEntries: 32, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            /*
             * 3. ETL DATA SHARDS → StaleWhileRevalidate.
             *    Adjacency, roots, skins: single-digit KB each, at stable
             *    paths, and — unlike the pages — they *do* change, because a
             *    corrected edge or a re-run ETL ships new bytes to the same
             *    URL. The data is scripture-adjacent (PLAN §6), so serving a
             *    stale shard forever is not acceptable, and blocking a hop on
             *    the network is not either. SWR gives the instant offline read
             *    and picks up the correction on the next visit.
             *    Matching by extension rather than by directory keeps this rule
             *    true for shard families that land later (skins, tajweed) with
             *    no config change.
             */
            urlPattern: ({ url }) =>
              url.pathname.includes("/assets/") && url.pathname.endsWith(".json"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "hifth-data",
              // 114 adjacency + 114 root-ayah + 32 root buckets + skins, with
              // room to grow; the whole set is well under a megabyte.
              expiration: { maxEntries: 400, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
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
  preview: {
    // `make golden-linux` keeps the preview server on the host (its
    // node_modules are host-arch) and runs only the browser in the Playwright
    // Linux container, which reaches back over host.docker.internal. Vite's
    // preview server rejects unknown Host headers as DNS-rebinding protection,
    // so that one name has to be named here — the alternative, `true`, would
    // disable the check outright. This is the preview server only; nothing here
    // ships, and the production build is static files behind a CDN.
    allowedHosts: ["host.docker.internal"],
  },
});
