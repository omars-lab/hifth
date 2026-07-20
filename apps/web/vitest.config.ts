import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The PWA virtual module is provided by vite-plugin-pwa at build/dev time
      // only. In jsdom tests we stub it — the SW is exercised by Playwright, not
      // unit tests.
      "virtual:pwa-register": fileURLToPath(
        new URL("./src/test/pwa-register.stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
