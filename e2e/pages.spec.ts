import { expect, readStorage, test } from './helpers';

/** Everything that isn't the game: the landing page, the documents, the shopping list. */

test('every page renders, with a heading, and nothing in the console', async ({ page }) => {
  const pages: [string, RegExp][] = [
    ['/', /./],
    ['/demo', /./],
    ['/play', /Who's at the table\?/],
    ['/me', /Who are you\?/],
    ['/join', /Your phone is the button/],
    ['/parts', /Everything to buy/],
    ['/standard', /./],
    ['/stats', /at the table/],
    ['/hardware', /./],
    ['/button', /./],
    ['/bench', /Is this thing on\?/],
    ['/buzzer', /First question/],
  ];
  for (const [path, heading] of pages) {
    await page.goto(path);
    if (path === '/demo') await expect(page.locator('.center__active')).toHaveText('Dave');
    else await expect(page.locator('h1').first(), path).toHaveText(heading);
  }
  // Unknown addresses land on the home page rather than a blank screen.
  await page.goto('/no-such-page');
  await expect(page.getByRole('link', { name: /Play with the demo/ })).toBeVisible();
});

test('the landing page gets a visitor to the demo, the documents and the parts list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Play with the demo/ }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await page.getByTitle('Back to the home page').click();

  for (const [name, url, text] of [
    ['Button standard', /\/standard$/, 'hello'],
    ['Build guide', /\/hardware$/, 'ESP32'],
    ['The button', /\/button$/, ''],
  ] as const) {
    await page.locator('.nav__links').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    if (text) await expect(page.locator('body')).toContainText(text);
    await page.goBack();
  }
  await page.getByRole('link', { name: 'Parts list' }).click();
  await expect(page).toHaveURL(/\/parts$/);
  // The URL changes a beat before the new page paints and scrolls itself to the top.
  await expect.poll(() => page.evaluate(() => window.scrollY), 'a new page starts at the top').toBe(0);
});

test('the documents are rendered from the repo’s markdown, tables and code included', async ({ page }) => {
  await page.goto('/standard');
  await expect(page.locator('.prose h1')).toHaveCount(1);
  await expect(page.locator('.prose pre code').first()).toBeVisible();
  await expect(page.locator('.prose')).toContainText('"t":"btn"');
  await page.getByRole('link', { name: 'Build guide' }).click();
  await expect(page.locator('.prose table').first()).toBeVisible();
  await page.getByRole('link', { name: 'Open the simulator' }).click();
  await expect(page).toHaveURL(/\/demo$/);
});

test('the landing page table plays by itself', async ({ page }) => {
  await page.goto('/');
  const lights = () => page.locator('.dev').evaluateAll((els) => els.map((e) => e.getAttribute('data-mode')).join(','));
  const before = await lights();
  await page.clock.runFor(20_000);
  expect(await lights()).not.toBe(before);
});

test.describe('the parts list', () => {
  const total = (page: import('@playwright/test').Page) =>
    page.locator('.parts__sum').innerText().then((t) => Number(t.replace(/[^0-9.]/g, '')));

  test('the total follows the choices', async ({ page }) => {
    await page.goto('/parts');
    const six = await total(page);
    expect(six).toBeGreaterThan(50);
    const buttons = page.locator('.parts__choices .opt').filter({ hasText: 'Buttons' });
    await buttons.getByRole('button', { name: '8', exact: true }).click();
    const eight = await total(page);
    expect(eight).toBeGreaterThan(six);
    await buttons.getByRole('button', { name: '3', exact: true }).click();
    expect(await total(page)).toBeLessThan(six);

    // Every line's price is quantity × unit price, and the lines add up to the total.
    const sum = await page.locator('.part__price').evaluateAll((els) => els.reduce((t, e) => t + Number(e.textContent!.replace(/[^0-9.]/g, '')), 0));
    expect(Math.abs(sum - (await total(page)))).toBeLessThan(0.05);

    // Perfboard instead of the custom board swaps lines in the list.
    const names = () => page.locator('.part__title').allInnerTexts();
    const withBoard = await names();
    await page.getByRole('button', { name: /Perfboard/ }).click();
    expect(await names()).not.toEqual(withBoard);
  });

  test('ticking things off is remembered, and the summary counts what is left', async ({ page }) => {
    await page.goto('/parts');
    const first = page.locator('.part').first();
    const name = (await first.locator('.part__title').innerText()).split('\n')[0];
    await first.locator('.part__check').click();
    await expect(first).toHaveAttribute('data-got', 'true');
    await expect(page.locator('.parts__total')).toContainText(/1 of \d+ ordered · \$[\d.,]+ still to buy/);
    const before = await total(page);

    await page.locator('.parts__choices .opt').filter({ hasText: 'Buttons' }).getByRole('button', { name: '4', exact: true }).click();
    await page.reload();
    await expect(page.locator('.part').first()).toHaveAttribute('data-got', 'true');
    await expect(page.locator('.parts__choices .opt').filter({ hasText: 'Buttons' }).getByRole('button', { name: '4', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await total(page)).toBeLessThan(before);
    const saved = await readStorage(page, 'pb.parts.v1');
    expect(saved.choices.buttons).toBe(4);
    expect(saved.ordered).toHaveLength(1);
    expect(name.length).toBeGreaterThan(3);
  });

  test('each line opens to explain itself and links out to a shop', async ({ page }) => {
    await page.goto('/parts');
    const lines = page.locator('.part');
    const n = await lines.count();
    expect(n).toBeGreaterThan(6);
    for (let i = 0; i < n; i++) {
      const href = await lines.nth(i).locator('a.btn').getAttribute('href');
      expect(href, `line ${i + 1} has a real link`).toMatch(/^https:\/\//);
    }
    const second = lines.nth(1);
    await second.locator('.part__main').click();
    await expect(second).toHaveAttribute('data-open', 'true');
    await expect(second.locator('.part__more')).toBeVisible();
    await expect(lines.first().locator('.part__more'), 'one line open at a time').toHaveCount(0);
  });

  test('the list can be copied as text', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/parts');
    await page.getByRole('button', { name: 'Copy the list as text' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('https://');
    expect(text.split('\n').length).toBeGreaterThan(6);
  });
});

test.describe('on a phone-sized screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('no page scrolls sideways', async ({ page }) => {
    for (const path of ['/', '/parts', '/me', '/join', '/standard', '/hardware', '/button', '/play']) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} is ${overflow}px wider than the screen`).toBeLessThanOrEqual(1);
    }
  });
});

test('the game stats page: a real game replayed, with explanations on hover and things to click into', async ({ page }) => {
  await page.goto('/stats');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('12 h 49 m at the table');
  await expect(page.locator('.stats__seat')).toHaveText(['Branson', 'Jason', 'Garett', 'Devon', 'Cam', 'Alan']);
  // Players, sorted by time on the clock, then by typical turn.
  const rows = page.locator('section', { has: page.getByRole('heading', { name: /Player by player/ }) }).locator('tbody .stats__who');
  await expect(rows.first()).toHaveText('Branson');
  await page.getByRole('button', { name: 'Typical turn' }).click();
  await expect(rows.first()).toHaveText('Devon');
  // Every heading explains itself.
  await expect(page.locator('.tip[data-tip*="median"]').first()).toBeAttached();
  // A round opens up.
  await page.getByRole('button', { name: /^R3 / }).click();
  await expect(page.locator('.round__detail .stats__who')).toHaveCount(6);
  await expect(page.locator('.legend').first()).toContainText('Paused');
});
