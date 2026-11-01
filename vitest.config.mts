import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    maxWorkers: 2,
    include: [
      "tests/setup/**/*.{test,spec}.{ts,tsx}",
      "packages/ui/src/**/*.{test,spec}.{ts,tsx}",
      "packages/game-domain/src/**/*.{test,spec}.{ts,tsx}",
      "packages/contracts/src/**/*.{test,spec}.{ts,tsx}",
      "apps/api/src/**/*.{test,spec}.{ts,tsx}",
      "apps/web/src/**/*.{test,spec}.{ts,tsx}",
      "src/**/*.{test,spec}.{ts,tsx}",
    ],
    setupFiles: [path.resolve(import.meta.dirname, "tests/setup/vitest-setup.ts")],
  },
  resolve: {
    alias: {
      "@/dev": path.resolve(import.meta.dirname, "apps/web/src/dev"),
      "@/components": path.resolve(import.meta.dirname, "apps/web/src/components"),
      "@/features": path.resolve(import.meta.dirname, "apps/web/src/features"),
      "@/lib/game-data-client": path.resolve(import.meta.dirname, "apps/web/src/lib/game-data-client"),
      "@/lib/game-data-server": path.resolve(import.meta.dirname, "apps/web/src/lib/game-data-server"),
      "@/lib/i18n": path.resolve(import.meta.dirname, "apps/web/src/lib/i18n"),
      "@/lib/seo": path.resolve(import.meta.dirname, "apps/web/src/lib/seo"),
      "@/lib/version-status": path.resolve(import.meta.dirname, "apps/web/src/lib/version-status"),
      "@/lib": path.resolve(import.meta.dirname, "apps/web/src/lib"),
      "@/app": path.resolve(import.meta.dirname, "apps/web/src/app"),
      "@tof-hub/contracts": path.resolve(import.meta.dirname, "packages/contracts/src"),
      "@tof-hub/game-assets": path.resolve(import.meta.dirname, "packages/game-assets/src"),
      "@tof-hub/game-domain": path.resolve(import.meta.dirname, "packages/game-domain/src"),
      "@tof-hub/i18n": path.resolve(import.meta.dirname, "packages/i18n/src"),
      "@tof-hub/config": path.resolve(import.meta.dirname, "packages/config/src"),
      "@tof-hub/ui": path.resolve(import.meta.dirname, "packages/ui/src"),
      react: path.resolve(import.meta.dirname, "apps/web/node_modules/react"),
      "react-dom": path.resolve(import.meta.dirname, "apps/web/node_modules/react-dom"),
      "react-i18next": path.resolve(import.meta.dirname, "apps/web/node_modules/react-i18next"),
      i18next: path.resolve(import.meta.dirname, "apps/web/node_modules/i18next"),
      "next/navigation": path.resolve(import.meta.dirname, "tests/setup/mock-next-navigation.ts"),
      "@": path.resolve(import.meta.dirname, "apps/web/src"),
    },
  },
});
