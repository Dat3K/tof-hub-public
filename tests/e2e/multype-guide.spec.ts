import { test, expect } from "@playwright/test";

for (const locale of ["en", "ru"] as const) {
  for (const width of [1440, 390, 320]) {
    test(`Multype guide restored: ${locale}, ${width}px`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "tof_locale", value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto("/datamine/multype/guide/", {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        locale === "ru" ? "Стаки баффов и множители" : "Buff Stacking & Multipliers",
      );
      await expect(page).toHaveTitle(
        locale === "ru"
          ? "Справочник типов урона | ToF Hub"
          : "Damage type guide | ToF Hub",
      );
      const example = page.locator('[data-example-key="couant"]');
      await expect(async () => {
        await example.click();
        await expect(example).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
      }).toPass();
      await expect(page.locator("[data-pair-sub-name]")).toHaveText(locale === "ru" ? "ОБЫЧНАЯ" : "Normal");
      await expect(page.locator("[data-pair-datamined-values]")).toHaveText(
        "Buff_Artifact_SSR012_DamageUp",
      );
      await expect(page.locator("[data-pair-renamed-values]")).toHaveText("Type Count");
      const board = page.locator(".guide-multype-board.multype-main");
      const raw = board.locator('[data-guide-board-mode="datamined"]');
      await raw.focus();
      await raw.press("Enter");
      await expect(raw).toHaveAttribute("aria-pressed", "true");
      await expect(board).toContainText("ModuleExtraType_CardPassive");
      await expect(board).toContainText("Buff_Matrix_SSR88");
      await board.locator('[data-guide-board-mode="renamed"]').click();
      await expect(board).toContainText("Asuka 4pc");
      const toc = width > 1060 ? page.locator(".guide-sidebar") : page.locator(".guide-inline-toc");
      const link = toc.locator('a[href="#simplified"]');
      await link.focus();
      await link.press("Enter");
      await expect(page).toHaveURL(/#simplified$/);
      await expect(page.locator("#simplified h2")).toBeInViewport();
      await expect(link).toHaveAttribute("aria-current", "location");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.locator('main a[href="/datamine/multype/"]').first()).toBeAttached();
    });
  }
}
