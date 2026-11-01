import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./ignore/test-results",
  testMatch: process.env.PLAYWRIGHT_ALL_TESTS
    ? "**/*.spec.ts"
    : ["**/core.spec.ts", "**/seo.spec.ts", "**/errors.spec.ts", "**/info.spec.ts", "**/locales.spec.ts", "**/shared-ui.spec.ts", "**/about.spec.ts", "**/multype-guide.spec.ts", "**/footer-pages.spec.ts", "**/story.spec.ts", "**/feedback.spec.ts", "**/feedback-admin.spec.ts", "**/wish.spec.ts", "**/wish-import.spec.ts"],
  snapshotPathTemplate: "./tests/fixtures/snapshots/{arg}{ext}",
  timeout: 45000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.1,
      threshold: 0.2,
    },
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 720 },
  },
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER || PORT === 8080 || PORT === "8080"
      ? undefined
      : {
          command: "pnpm --filter web dev",
          url: `http://localhost:${PORT}`,
          reuseExistingServer: true,
          timeout: 120000,
        },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
