import { defineConfig } from "vitest/config";
// The unit tests run on Preact too, so they test what ships.
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      // The gesture library's modern build, whose imports of React the Preact
      // plugin can point at Preact. The test runner would otherwise pick its
      // old-style build, which loads React's own copy with nothing to draw with.
      "@use-gesture/react": fileURLToPath(
        new URL("./node_modules/@use-gesture/react/dist/use-gesture-react.esm.js", import.meta.url),
      ),
      // The PWA virtual module is provided by vite-plugin-pwa at build/dev time
      // only. In jsdom tests we stub it — the SW is exercised by Playwright, not
      // unit tests.
      "virtual:pwa-register": fileURLToPath(
        new URL("./src/test/pwa-register.stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    // Build these libraries with the app, so their imports of React are pointed
    // at Preact as the app's are, and the helper shares the app's copy of Preact.
    server: { deps: { inline: [/@testing-library\/preact/, /@use-gesture\/react/] } },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
