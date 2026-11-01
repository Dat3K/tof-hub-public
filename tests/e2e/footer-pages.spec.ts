import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const tracker = JSON.parse(
  fs.readFileSync(path.resolve("apps/web/public/game-data/version-tracker.json"), "utf8"),
);

const pages = [
  {
    route: "/privacy/",
    title: { en: /Privacy & Data Storage/, ru: /Конфиденциальность и хранение данных/ },
  },
  {
    route: "/projects/",
    title: { en: /Tower of Fantasy resources/, ru: /Ресурсы по Tower of Fantasy/ },
  },
  {
    route: "/contribute/#multype",
    title: { en: /Help improve ToF Hub/, ru: /Как помочь проекту/ },
  },
  {
    route: "/changelog/",
    title: { en: /Update history/, ru: /История обновлений/ },
  },
  {
    route: "/info/simulacra/changelog/",
    title: { en: /Simulacra Changelogs/, ru: /История изменений симулякров/ },
  },
];

for (const locale of ["en", "ru"] as const)
  for (const width of [1440, 390, 320]) {
    for (const item of pages) {
      test(`Footer reading page ${item.route}: ${locale}, ${width}px`, async ({
        page,
        context,
        baseURL,
      }) => {
        await context.addCookies([{ name: "tof_locale", value: locale, url: baseURL! }]);
        await page.setViewportSize({ width, height: 1000 });
        await page.route("**/game-data/release-manifest.json", (route) =>
          route.fulfill({
            json: {
              schemaVersion: 1,
              gameVersion: "9.8.7",
              snapshot: {
                version: "9.8.7",
                exportedAt: "2026-10-15T12:00:00Z",
                sources: [
                  {
                    client: "Fixture client",
                    branch: "a-long-source-branch-for-reading-on-small-screens",
                  },
                ],
              },
            },
          }),
        );
        await page.route("**/api/v1/version-status/tracker", (route) =>
          route.fulfill({
            json: {
              ...tracker,
              mode: "live",
              branches: tracker.branches.map((branch: { id: string }) =>
                branch.id === "live-global" ? { ...branch, version: "9.8.6" } : branch,
              ),
            },
          }),
        );
        const response = await page.goto(item.route, { waitUntil: "domcontentloaded" });
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.title[locale]);
        const root = page.locator(".editorial-page");
        await expect(root).toBeVisible();
        if (item.route.startsWith("/projects/")) {
          await expect(root.locator(".editorial-resource").first()).toBeVisible();
          for (const link of await root.locator(".editorial-resource").all()) {
            await expect(link).toHaveAttribute("href", /\S+/);
            await expect(link).toHaveAttribute("rel", /noopener/);
          }
        }
        if (item.route.startsWith("/contribute/")) {
          const tabs = root.getByRole("tab");
          await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
          await expect(root.locator("#multype")).toBeVisible();
          for (const index of [2, 0]) {
            await tabs.nth(index).focus();
            await tabs.nth(index).press("Enter");
            await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
            const target = await tabs.nth(index).getAttribute("aria-controls");
            await expect(root.locator(`#${target}`)).toBeVisible();
            await expect(page).toHaveURL(new RegExp(`#${target}$`));
          }
        }
        if (item.route === "/changelog/") {
          // The project history (legacy → hub) is the last timeline entry.
          await expect(root.locator("[data-history]")).toHaveCount(1);
          const filters = root.locator(".editorial-filters button");
          // Nothing on the page waits for hydration any more; retry until React handles the key press.
          await expect(async () => {
            await filters.nth(1).focus();
            await filters.nth(1).press("Enter");
            await expect(filters.nth(1)).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
          }).toPass({ timeout: 30_000 });
          const selected = (await filters.nth(1).innerText()).trim();
          const entries = root.locator("[data-changelog-section]");
          expect(await entries.count()).toBeGreaterThan(0);
          expect(
            await entries.evaluateAll(
              (nodes, value) =>
                nodes.every((n) => n.getAttribute("data-changelog-section") === value),
              selected,
            ),
          ).toBe(true);
          await filters.first().click();
          await expect(filters.first()).toHaveAttribute("aria-pressed", "true");
        }
        if (item.route === "/info/simulacra/changelog/") {
          const mmo = root.locator('[data-server-mode="mmo"]').first();
          const gacha = root.locator('[data-server-mode="gacha"]').first();
          // Check a React-driven mode change before using the SSR patch header.
          await expect(async () => {
            await mmo.click();
            await expect(mmo).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
          }).toPass();
          await gacha.click();
          await expect(gacha).toHaveAttribute("aria-checked", "true");
          const patch = root.locator('[role="button"][aria-expanded]').first();
          // Locale histories are independent: a valid export can have no RU changes.
          const empty = root.getByText(locale === "ru" ? "Пока что нет изменений." : "No changes yet.", { exact: true });
          await expect(patch.or(empty).first()).toBeVisible();
          if (await patch.count()) {
            const before = await patch.getAttribute("aria-expanded");
            await patch.focus();
            await patch.press("Enter");
            await expect(patch).toHaveAttribute(
              "aria-expanded",
              before === "true" ? "false" : "true",
            );
          } else {
            await expect(empty).toBeVisible();
          }
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${item.route}: no horizontal page overflow`,
        ).toBe(true);
      });
    }
  }
