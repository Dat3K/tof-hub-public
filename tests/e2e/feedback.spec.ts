import { test, expect } from '@playwright/test';

for (const locale of ['en', 'ru'] as const) {
  for (const width of [1440, 390, 320]) {
    test(`Feedback: optional scores and separate messages, ${locale}, ${width}px`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: 'tof_locale', value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 1000 });
      const requests: { id: string; ratings: { visual: number | null }; notes: { page: string; message: string }[] }[] = [];
      await page.route(/\/api\/v1\/feedback\/?$/, route => {
        const input = route.request().postDataJSON(); requests.push(input);
        return route.fulfill({ status: requests.length === 1 ? 503 : 201, json: requests.length === 1 ? {} : { accepted: true, id: input.id } });
      });
      await page.goto('/feedback/?from=footer', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(locale === 'ru' ? 'Как вам ToF Hub?' : 'How is ToF Hub working for you?');
      const form = page.locator('form');
      await expect(form.locator('input[type=radio]:checked')).toHaveCount(0);
      const submit = page.getByRole('button', { name: locale === 'ru' ? 'Отправить отзыв' : 'Send feedback', exact: true });
      await submit.click();
      await expect(form.getByRole('alert')).toContainText(locale === 'ru' ? 'хотя бы' : 'at least');
      expect(requests).toHaveLength(0);
      const firstGroup = page.getByRole('group', { name: locale === 'ru' ? 'Визуальное оформление' : 'Visual design', exact: true });
      await firstGroup.getByRole('radio', { name: '0', exact: true }).focus();
      await page.keyboard.press('Space');
      await expect(firstGroup.getByRole('radio', { name: '0', exact: true })).toBeChecked();
      await expect(form.getByRole('alert')).toHaveCount(0);
      await page.getByRole('button', { name: locale === 'ru' ? 'Добавить сообщение' : 'Add a message', exact: true }).click();
      const firstNote = form.getByRole('region', { name: `${locale === 'ru' ? 'Сообщение' : 'Message'} 1`, exact: true });
      await firstNote.getByLabel(locale === 'ru' ? 'К чему относится?' : 'What is this about?').selectOption('page');
      await firstNote.getByLabel(locale === 'ru' ? 'Найти страницу' : 'Find a page').fill('food');
      await firstNote.getByRole('combobox', { name: locale === 'ru' ? 'Выберите страницу' : 'Choose a page', exact: true }).selectOption('/info/food/');
      const hostileText = "<script>window.feedbackInjected=true</script>'; DROP TABLE players;--";
      await firstNote.getByLabel(locale === 'ru' ? 'Ваше сообщение' : 'Your message', { exact: true }).fill(hostileText);
      await page.getByRole('button', { name: locale === 'ru' ? 'Добавить ещё страницу или сообщение' : 'Add another page or message', exact: true }).click();
      const secondNote = form.getByRole('region', { name: `${locale === 'ru' ? 'Сообщение' : 'Message'} 2`, exact: true });
      await secondNote.getByLabel(locale === 'ru' ? 'К чему относится?' : 'What is this about?').selectOption('page');
      await secondNote.getByRole('combobox', { name: locale === 'ru' ? 'Выберите страницу' : 'Choose a page', exact: true }).selectOption('/tools/comp/');
      await secondNote.getByLabel(locale === 'ru' ? 'Ваше сообщение' : 'Your message', { exact: true }).fill('A separate page suggestion');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if ((locale === 'en' && width === 1440) || (locale === 'ru' && width === 390)) await page.screenshot({ path: `ignore/documentation-media/generated/feedback-${locale}-${width}.png`, fullPage: true });
      await submit.click();
      await expect(form.getByRole('alert')).toContainText(locale === 'ru' ? 'Не удалось' : 'could not');
      await expect(firstNote.locator('textarea')).toHaveValue(hostileText);
      await submit.click();
      await expect(page.getByRole('heading', { level: 2, name: locale === 'ru' ? 'Спасибо! Ваш отзыв сохранён.' : 'Thank you. Your feedback has been saved.' })).toBeVisible();
      expect(requests[0].id).toBe(requests[1].id);
      expect(requests[1].ratings.visual).toBe(0);
      expect(requests[1].notes.map(note => note.page)).toEqual(['/info/food/', '/tools/comp/']);
      expect(await page.evaluate(() => (window as unknown as { feedbackInjected?: boolean }).feedbackInjected)).toBeUndefined();
      await page.getByRole('button', { name: locale === 'ru' ? 'Оставить ещё отзыв' : 'Leave another review' }).click();
      await expect(form.locator('input[type=radio]:checked')).toHaveCount(0);
      await page.getByLabel(locale === 'ru' ? 'Где это особенно заметно? (необязательно)' : 'Where is it especially noticeable? (optional)').fill('A later, new response');
      await submit.click();
      await expect(page.getByRole('heading', { level: 2, name: locale === 'ru' ? 'Спасибо! Ваш отзыв сохранён.' : 'Thank you. Your feedback has been saved.' })).toBeVisible();
      expect(requests[2].id).not.toBe(requests[1].id);
      expect(requests[2].notes).toEqual([]);
    });
  }
}

test('Feedback link remains available from the shared footer', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'tof_locale', value: 'en', url: baseURL! }]);
  await page.goto('/privacy/');
  const link = page.locator('footer').getByRole('link', { name: 'Give feedback', exact: true });
  await expect(link).toHaveAttribute('href', '/feedback/?from=footer');
  await link.click(); await expect(page).toHaveURL(/\/feedback\/\?from=footer/);
});

test.describe('Feedback invitation (enabled preview)', () => {
  test.skip(process.env.FEEDBACK_E2E_PROMPT !== 'true', 'Requires FEEDBACK_PROMPT_ENABLED=true on the web preview');
  for (const reason of ['time', 'pages'] as const) {
    test(`one invitation after ${reason}, dismiss survives reload`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: 'tof_locale', value: 'en', url: baseURL! }]);
      let claims = 0;
      await page.route(/\/api\/v1\/feedback\/prompt\/claim\/?$/, route => { claims++; return route.fulfill({ json: { show: claims === 1 } }); });
      await page.addInitScript(({ reason }) => {
        if (sessionStorage.getItem('feedback-seeded')) return;
        sessionStorage.setItem('feedback-seeded', 'yes');
        localStorage.setItem('tof-feedback-v1', JSON.stringify({ version: 1, suppressed: false, activeMs: reason === 'time' ? 900000 : 0,
          pages: reason === 'pages' ? ['/', '/info/', '/datamine/', '/tools/', '/about/', '/privacy/', '/projects/', '/info/food/', '/info/pets/', '/info/arts/'] : [], lastActiveAt: Date.now() }));
      }, { reason });
      await page.goto('/about/'); await page.bringToFront();
      const dialog = page.getByRole('dialog', { name: 'Help improve ToF Hub?' });
      await expect(dialog).toBeVisible({ timeout: 20000 });
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
      await page.reload(); await page.waitForTimeout(5500);
      expect(claims).toBe(1); await expect(dialog).toHaveCount(0);
    });
  }
  test('hidden time does not count and focused fields defer the invitation', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'tof_locale', value: 'en', url: baseURL! }]);
    let claims = 0;
    await page.route(/\/api\/v1\/feedback\/prompt\/claim\/?$/, route => { claims++; return route.fulfill({ json: { show: true } }); });
    await page.goto('/about/'); await page.bringToFront();
    await page.evaluate(() => {
      localStorage.setItem('tof-feedback-v1', JSON.stringify({ version: 1, suppressed: false, activeMs: 899999, pages: [], lastActiveAt: Date.now() }));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(5500); expect(claims).toBe(0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      const input = document.createElement('input'); input.id = 'feedback-focus-fixture'; document.body.append(input); input.focus();
    });
    await page.waitForTimeout(5500); expect(claims).toBe(0);
    await page.locator('#feedback-focus-fixture').evaluate(element => (element as HTMLElement).blur());
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(2000); expect(claims).toBe(0);
    await expect.poll(() => claims, { timeout: 12000 }).toBe(1);
  });
});
