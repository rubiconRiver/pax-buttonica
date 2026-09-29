import { DEMO, PRIMARY_GUARD_MS, expect, lab, openDemo, openSettings, readStorage, setSlider, test } from './helpers';

/**
 * "When someone plays a strategy card, nobody gets skipped." The two-beat flow, its guards, and the setting that
 * collapses it to one beat.
 */

const others = DEMO.filter((n) => n !== 'Dave');

test('a stray third tap right after the double-tap does not skip the primary', async ({ page }) => {
  const table = await openDemo(page);
  await table.doubleTap('Dave');
  await expect(table.center.locator('.ability__label')).toHaveText('Primary ability');
  // 450 ms later: inside the guard.
  await table.tap('Dave');
  await expect(table.center.locator('.ability__label')).toHaveText('Primary ability');
  await page.clock.fastForward(PRIMARY_GUARD_MS);
  await table.tap('Dave');
  await expect(table.center.locator('.ability__label')).toHaveText('Secondary ability');
  await expect(table.log).toContainText('Dave is done with the primary — secondaries are open.');
});

test('during the primary, other players tapping changes nothing', async ({ page }) => {
  const table = await openDemo(page);
  await table.doubleTap('Dave');
  for (const name of ['Mike', 'Jen']) await table.tap(name);
  await table.hold('Sarah');
  await expect(table.center.locator('.ability__label')).toHaveText('Primary ability');
  await table.expectLights({ Dave: 'flash', Mike: 'dim', Jen: 'dim', Sarah: 'dim' });
});

test('the owner is refused, with the reason, until the last player has answered', async ({ page }) => {
  const table = await openDemo(page);
  await table.doubleTap('Dave');
  await table.hold('Dave');
  await table.expectToast('Dave: finish the primary first — tap when done');
  await expect(table.light('Dave')).toHaveAttribute('data-react', 'denied');

  await table.primaryDone('Dave');
  await table.hold('Dave');
  await table.expectToast('Dave: waiting on Mike, Sarah, Jen, Kyle, Steph');

  for (const name of ['Mike', 'Sarah', 'Jen', 'Kyle']) await table.tap(name);
  await table.hold('Dave');
  await table.expectToast('Dave: waiting on Steph');
  await expect(table.center.locator('.play__name')).toHaveText('Leadership');

  // A hold answers a secondary just as well as a tap (people lean on the thing).
  await table.hold('Steph');
  await table.expectLights({ Steph: 'dim', Dave: 'pulse' });
  await expect(table.log).toContainText('Everyone has responded to Leadership.');
  await table.hold('Dave');
  await table.expectActive('Kyle');
  // The refusals are in the log for the post-mortem.
  await expect(table.log).toContainText('Dave: waiting on Steph');
});

test('answering twice, or the owner tapping during the secondary, does nothing', async ({ page }) => {
  const table = await openDemo(page);
  await table.doubleTap('Dave');
  await table.primaryDone('Dave');
  await table.tap('Mike');
  await table.tap('Mike');
  await table.tap('Dave');
  await expect(table.center.locator('.center__status')).toContainText('Waiting on 4');
  await table.expectLights({ Mike: 'dim', Dave: 'solid', Sarah: 'flash' });
});

test('the card colour is what blinks', async ({ page }) => {
  const table = await openDemo(page);
  await table.doubleTap('Dave');
  // Leadership is red; Dave plays blue. (--led is a registered colour property, so it reads back as rgb().)
  const led = (name: string) => table.light(name).evaluate((el) => getComputedStyle(el).getPropertyValue('--led').trim());
  const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
  expect(await led('Dave')).toBe(rgb('#e5484d'));
  expect(await led('Mike')).toBe(rgb('#ffd21f'));
  await table.primaryDone('Dave');
  expect(await led('Mike')).toBe(rgb('#e5484d'));
  await table.tap('Mike');
  expect(await led('Mike')).toBe(rgb('#ffd21f'));
});

test('once the card is played it is marked as spent everywhere', async ({ page }) => {
  const table = await openDemo(page);
  await expect(table.seat('Dave').locator('.cardpip')).not.toHaveAttribute('data-used', 'true');
  await table.doubleTap('Dave');
  await expect(table.seat('Dave').locator('.cardpip')).toHaveAttribute('data-used', 'true');
  await expect(table.roster('Dave').locator('.cardpip')).toHaveAttribute('data-used', 'true');
  await table.primaryDone('Dave');
  await table.center.getByRole('button', { name: "Everyone's done" }).click();
  await table.hold('Dave');
  // Round the table and back to Dave: no card left to play, and now he may pass.
  for (const name of ['Kyle', 'Mike', 'Sarah', 'Steph', 'Jen']) await table.hold(name);
  await table.expectActive('Dave');
  await expect(table.center.getByRole('button', { name: /^Play / })).toHaveCount(0);
  await expect(table.center.getByRole('button', { name: 'Pass', exact: true })).toBeEnabled();
});

test.describe('setting: primary first, then secondaries', () => {
  test('switched off, everyone blinks the moment the card comes out', async ({ page }) => {
    const table = await openDemo(page);
    const panel = await openSettings(page);
    await panel.getByLabel('Strategy cards: primary first, then secondaries').uncheck();
    await page.keyboard.press('Escape');
    expect((await readStorage(page, 'pb.settings.v2')).primaryStage).toBe(false);

    await table.doubleTap('Dave');
    await expect(table.center.locator('.ability__label')).toHaveText('Secondary ability');
    await expect(table.center.getByRole('button', { name: 'Primary done' })).toHaveCount(0);
    await table.expectLights({ Dave: 'solid', ...Object.fromEntries(others.map((n) => [n, 'flash'])) });
    await table.hold('Dave');
    await table.expectToast(/waiting on/i);
  });

  test('it applies to a new demo too, and can be switched back on mid-game', async ({ page }) => {
    const table = await openDemo(page);
    let panel = await openSettings(page);
    await panel.getByLabel('Strategy cards: primary first, then secondaries').uncheck();
    await page.keyboard.press('Escape');
    await lab(page, 'Fresh turn').click();
    await lab(page, 'Double-tap: play card').click();
    await expect(table.center.locator('.ability__label')).toHaveText('Secondary ability');

    panel = await openSettings(page);
    await panel.getByLabel('Strategy cards: primary first, then secondaries').check();
    await page.keyboard.press('Escape');
    await lab(page, 'Everyone responds').click();
    await table.hold('Dave');
    await table.doubleTap('Kyle');
    await expect(table.center.locator('.ability__label')).toHaveText('Primary ability');
  });
});

test('the blink speed setting reaches every button', async ({ page }) => {
  await openDemo(page);
  const panel = await openSettings(page);
  await setSlider(panel.locator('input[type=range]').nth(1), 3000);
  await expect(panel).toContainText('3.0s');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--flash-ms'))).toBe('3000ms');
});

test('buttons that blink or breathe do it in step', async ({ page }) => {
  const table = await openDemo(page);
  await table.doubleTap('Dave');
  await table.primaryDone('Dave');
  // Every flashing button starts its animation at the same point of the same wall-clock cycle.
  const delays = await Promise.all(others.map((n) => table.light(n).evaluate((el) => (el as HTMLElement).style.animationDelay)));
  expect(new Set(delays).size).toBe(1);
  expect(delays[0]).toMatch(/^-\d+(\.\d+)?ms$/);
});
