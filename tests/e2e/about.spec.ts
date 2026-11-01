import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

// The loader reads Live Global from the tracker API, then its generated snapshot.
const tracker = JSON.parse(
  fs.readFileSync(path.resolve("apps/web/public/game-data/version-tracker.json"), "utf8"),
);
const trackerWithLiveGlobal = (version: string) => ({
  ...tracker,
  mode: "live",
  branches: tracker.branches.map((branch: { id: string }) =>
    branch.id === "live-global" ? { ...branch, version } : branch,
  ),
});

for (const locale of ["en", "ru"] as const) {
  for (const width of [1280, 390, 320]) {
    test(`About data: ${locale}, ${width}px, sources and keyboard navigation`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([{ name: "tof_locale", value: locale, url: baseURL! }]);
      await page.route("**/game-data/release-manifest.json", (route) =>
        route.fulfill({
          json: {
            schemaVersion: 1,
            gameVersion: "9.8.7",
            snapshot: {
              version: "9.8.7",
              exportedAt: "2026-10-15T12:00:00Z",
              sources: [{ client: "Fixture client", branch: "fixture-branch" }],
            },
          },
        }),
      );
      await page.route("**/api/v1/version-status/tracker", (route) =>
        route.fulfill({ json: trackerWithLiveGlobal("9.8.6") }),
      );
      await page.setViewportSize({ width, height: 900 });
      const manifestResponse = page.waitForResponse((response) =>
        response.url().endsWith("/game-data/release-manifest.json"),
      );
      await page.goto("/about/", { waitUntil: "domcontentloaded" });
      await manifestResponse;
      const main = page.locator("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(
        locale === "ru" ? "Откуда берутся данные на сайте" : "Where the site’s data comes from",
      );
      await expect(page.locator("[data-site-header]")).toHaveAttribute("data-section", "main");
      const snapshot = main.getByRole("region", {
        name: locale === "ru" ? "Снимок игровых данных" : "Game data snapshot",
      });
      await expect(snapshot).toContainText("9.8.7");
      await expect(snapshot).toContainText("Fixture client — fixture-branch");
      await expect(snapshot).toContainText("9.8.6");
      for (const href of ["/info/", "/datamine/", "/tools/"]) {
        await expect(main.locator(`a[href="${href}"]`)).toBeVisible();
      }
      await expect(main.locator("#live-capture")).toContainText(".tofbuild");
      await expect(main.locator("#live-capture")).toContainText(".tofwish");
      await expect(main.locator("#live-capture")).toContainText(".tofplayers");
      await expect(main.locator("#live-capture")).toContainText("WinDivert");
      const captureLink = main
        .getByRole("navigation")
        .getByRole("link", { name: "Live Capture", exact: true });
      await captureLink.focus();
      await captureLink.press("Enter");
      await expect(page).toHaveURL(/#live-capture$/);
      await expect(main.locator("#live-capture h2")).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      for (const link of await main.locator("nav a").all()) {
        const href = await link.getAttribute("href");
        await expect(main.locator(href!)).toHaveCount(1);
      }
      await expect(page.locator('footer a[href="/about/"]')).toHaveText(
        locale === "ru" ? "О данных сайта" : "About the data",
      );
      // Existing inbound links keep their destinations after the rewrite.
      for (const id of [
        "terminology",
        "discovery",
        "principles",
        "reproduce",
        "oow",
        "seq",
        "fce",
        "items",
        "multype",
      ]) {
        await expect(main.locator(`#${id}`)).toHaveCount(1);
      }
    });
  }
}

for (const locale of ["en", "ru"] as const) {
  test(`About data remains readable without version sources (${locale})`, async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "tof_locale", value: locale, url: baseURL! }]);
    await page.route("**/game-data/release-manifest.json", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await page.route(/\/api\/v1\/version-status\/tracker|\/game-data\/version-tracker\.json/, (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    const manifestResponse = page.waitForResponse((response) =>
      response.url().endsWith("/game-data/release-manifest.json"),
    );
    await page.goto("/about/#live-capture", { waitUntil: "domcontentloaded" });
    await manifestResponse;
    const snapshot = page.locator('section[aria-labelledby="snapshot-title"]');
    await expect(snapshot.locator("dd")).toHaveText(
      Array(4).fill(locale === "ru" ? "Недоступно" : "Unavailable"),
    );
    await expect(page.locator("#live-capture h2")).toBeInViewport();
    await expect(page.locator("#datasets")).toContainText("Info");
  });
}
