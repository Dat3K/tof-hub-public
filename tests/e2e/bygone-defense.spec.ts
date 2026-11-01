import {expect, test} from '@playwright/test';

for (const [locale, width] of [['en', 1440], ['ru', 390]] as const) {
  test(`MMO Bygone shows floor defense in the elemental cards (${locale})`, async ({page, context}) => {
    test.setTimeout(90000);
    const ru = locale === 'ru';
    await page.setViewportSize({width, height: 900});
    await context.addCookies([{name: 'tof_locale', value: locale, domain: 'localhost', path: '/'}]);
    await page.goto('/datamine/bygone/?mode=mmo&floor=200', {waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-encounter-ready="true"]')).toBeVisible({timeout: 60000});
    const enemy = page.getByRole('article', {name: `${ru ? 'Этаж' : 'Floor'} 200`, exact: true}).getByRole('listitem').first().getByRole('button');
    await enemy.click();
    const dialog = page.getByRole('dialog');
    const elements = dialog.getByRole('region', {name: ru ? 'Защита от стихий' : 'Elemental defense', exact: true});
    await expect(elements.getByText(new Intl.NumberFormat(locale).format(11377), {exact: true})).toHaveCount(5);
    await expect(elements.getByText(`${ru ? 'Базовый DEF' : 'Base DEF'}: 1`, {exact: true})).toHaveCount(5);
    await expect(elements).toContainText(ru ? 'Оценка · со стаками этажа' : 'Estimated · floor stacks');
    await expect(elements).toContainText(ru ? 'Стаки защиты этажа' : 'Floor DEF stacks');
    await elements.scrollIntoViewIfNeeded();
    await page.screenshot({path: `ignore/documentation-media/generated/bygone-floor-defense-${locale}.png`, animations: 'disabled'});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(enemy).toBeFocused();
  });
}
