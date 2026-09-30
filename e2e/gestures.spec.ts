import { Board, HOLD_MS, Table, expect, lab, openDemo, openSettings, readStorage, seedStorage, setSlider, test } from './helpers';

/**
 * Tap, double-tap and hold are the entire vocabulary of a button, and the on-screen button measures them with the
 * same thresholds a real one will. These tests pin the thresholds down to the millisecond, on a controlled clock.
 */

test.describe('hold to end the turn', () => {
  test('0.9 seconds ends the turn; 0.8 does not', async ({ page }) => {
    const table = await openDemo(page);
    await table.hold('Dave', HOLD_MS - 100);
    await table.expectActive('Dave');
    await expect(table.toast, 'an abandoned hold is not a tap').toHaveCount(0);
    await table.hold('Dave', HOLD_MS);
    await table.expectActive('Kyle');
    await expect(table.log).toContainText(/Dave/);
  });

  test('the ring fills while holding and the button reports it', async ({ page }) => {
    const table = await openDemo(page);
    const key = await table.key('Dave');
    await page.keyboard.down(key);
    await expect(table.light('Dave')).toHaveAttribute('data-pressed', 'true');
    await expect(table.light('Dave')).toHaveAttribute('data-holding', 'true');
    await page.clock.fastForward(HOLD_MS);
    await expect(table.light('Dave')).toHaveAttribute('data-held', 'true');
    await expect(table.light('Dave')).not.toHaveAttribute('data-holding', 'true');
    // The turn ended the moment the ring filled, not on release.
    await table.expectActive('Kyle');
    await page.keyboard.up(key);
    await expect(table.light('Dave')).not.toHaveAttribute('data-pressed', 'true');
  });

  test("somebody else's hold is ignored, and their button says so while it is held", async ({ page }) => {
    const table = await openDemo(page);
    await expect(table.light('Dave')).not.toHaveAttribute('data-refused', 'true');
    await expect(table.light('Jen')).toHaveAttribute('data-refused', 'true');
    const key = await table.key('Jen');
    await page.keyboard.down(key);
    await expect(table.light('Jen')).toHaveAttribute('data-holding', 'true');
    // The ring is red and full at once: no filling it for nothing.
    await expect(table.light('Jen').locator('.dev__ring-fill')).toHaveCSS('stroke-dashoffset', '0px');
    await page.clock.fastForward(HOLD_MS);
    await expect(table.light('Jen')).toHaveAttribute('data-react', 'denied');
    await page.keyboard.up(key);
    await table.expectActive('Dave');
    await expect(table.toast).toHaveCount(0);
  });

  test('the hold time follows the setting, and survives a reload', async ({ page }) => {
    const table = await openDemo(page);
    const panel = await openSettings(page);
    await setSlider(panel.locator('input[type=range]').first(), 1000);
    await expect(panel).toContainText('1.0s');
    await page.keyboard.press('Escape');
    await expect(table.center.locator('.center__hint')).toContainText('hold 1s to end the turn');
    await table.hold('Dave', 900);
    await table.expectActive('Dave');
    await table.hold('Dave', 1000);
    await table.expectActive('Kyle');
    expect((await readStorage(page, 'pb.settings.v3')).holdMs).toBe(1000);
    await page.reload();
    await expect(page.locator('.center__hint')).toContainText('hold 1s to end the turn');
  });
});

test('a laptop that saved its settings before keeps what it chose, and gets the new hold and brightness', async ({ page }) => {
  // 2 s and 100 % were the defaults then: nobody chose them. The volume and the layout somebody did.
  await seedStorage(page, { 'pb.settings.v1': { holdMs: 2000, brightness: 1, volume: 0.3, layout: 'table' } });
  await openDemo(page);
  await expect(page.locator('.center__hint')).toContainText('hold 0.9s to end the turn');
  let panel = await openSettings(page);
  await expect(panel.getByRole('slider', { name: /Your turn/ })).toHaveValue('0.6');
  await expect(panel.getByRole('slider', { name: /Volume/ })).toHaveValue('0.3');
  await expect(panel.getByRole('radio', { name: 'Seating' })).toHaveAttribute('aria-checked', 'true');
  expect(await readStorage(page, 'pb.settings.v1')).toBeNull();

  // Chosen by hand, it stays.
  await page.evaluate(() => {
    localStorage.removeItem('pb.settings.v3');
    localStorage.setItem('pb.settings.v1', JSON.stringify({ holdMs: 1500, brightness: 0.7 }));
  });
  await page.reload();
  await expect(page.locator('.center__hint')).toContainText('hold 1.5s to end the turn');
  panel = await openSettings(page);
  await expect(panel.getByRole('slider', { name: /Your turn/ })).toHaveValue('0.7');

  // A v2 laptop: 50 % and 10 % were its defaults, nobody chose them; a waiting level set by hand stays.
  await page.evaluate(() => {
    localStorage.removeItem('pb.settings.v3');
    localStorage.setItem('pb.settings.v2', JSON.stringify({ brightness: 0.5, waitingBrightness: 0.1, volume: 0.3 }));
  });
  await page.reload();
  panel = await openSettings(page);
  await expect(panel.getByRole('slider', { name: /Your turn/ })).toHaveValue('0.6');
  await expect(panel.getByRole('slider', { name: /Waiting/ })).toHaveValue('0.05');
  await expect(panel.getByRole('slider', { name: /Volume/ })).toHaveValue('0.3');
  expect(await readStorage(page, 'pb.settings.v2')).toBeNull();
  await page.evaluate(() => {
    localStorage.removeItem('pb.settings.v3');
    localStorage.setItem('pb.settings.v2', JSON.stringify({ brightness: 0.5, waitingBrightness: 0.2 }));
  });
  await page.reload();
  panel = await openSettings(page);
  await expect(panel.getByRole('slider', { name: /Waiting/ })).toHaveValue('0.2');
});

test.describe('taps', () => {
  test('a tap on your own turn is a reminder, nothing more', async ({ page }) => {
    const table = await openDemo(page);
    await table.tap('Dave');
    await table.expectToast('Hold to end your turn');
    await expect(table.light('Dave')).toHaveAttribute('data-react', 'hint');
    await table.expectActive('Dave');
  });

  test('two quick taps are a double-tap; two slow ones are not', async ({ page }) => {
    const table = await openDemo(page);
    await table.tap('Dave');
    await table.tap('Dave'); // the helper leaves 450 ms between taps: outside the 400 ms window
    await expect(table.center.locator('.play')).toHaveCount(0);
    await table.doubleTap('Dave');
    await expect(table.center.locator('.play__name')).toHaveText('Leadership');
  });

  test('a double-tap from anyone but the active player does nothing', async ({ page }) => {
    const table = await openDemo(page);
    await table.doubleTap('Sarah');
    await expect(table.center.locator('.play')).toHaveCount(0);
    await table.expectActive('Dave');
  });
});

test.describe('other ways to press', () => {
  test('mouse: click, double-click and press-and-hold on the dome', async ({ page }) => {
    const table = await openDemo(page);
    await table.dome('Dave').click();
    await table.expectToast('Hold to end your turn');

    await page.clock.fastForward(450);
    await table.dome('Dave').hover();
    await page.mouse.down();
    await page.clock.fastForward(HOLD_MS);
    await page.mouse.up();
    await table.expectActive('Kyle');

    await page.clock.fastForward(450);
    await table.dome('Kyle').dblclick();
    await expect(table.center.locator('.play__name')).toHaveText('Diplomacy');
  });

  test('keyboard: space on a focused button holds it', async ({ page }) => {
    const table = await openDemo(page);
    await table.dome('Dave').focus();
    await page.keyboard.down(' ');
    await page.clock.fastForward(HOLD_MS);
    await page.keyboard.up(' ');
    await table.expectActive('Kyle');
  });

  test("Dave's three-button device: the shortcuts play his card and try to pass", async ({ page }) => {
    const table = await openDemo(page);
    await expect(table.seat('Dave').locator('.dev__auxbtn')).toHaveCount(2);
    await expect(table.seat('Mike').locator('.dev__auxbtn')).toHaveCount(0);
    await table.seat('Dave').getByTitle('Shortcut button: pass').click();
    await table.expectToast("can't pass with an unplayed strategy card");
    await expect(table.light('Dave')).toHaveAttribute('data-react', 'denied');
    await table.seat('Dave').getByTitle('Shortcut button: play my strategy card').click();
    await expect(table.center.locator('.play__name')).toHaveText('Leadership');
  });

  test('late in the round the pass shortcut passes', async ({ page }) => {
    const table = await openDemo(page);
    await lab(page, 'Late in the round').click();
    await table.expectActive('Dave');
    await table.seat('Dave').getByTitle('Shortcut button: pass').click();
    await expect(table.seat('Dave')).toHaveAttribute('data-passed', 'true');
    await table.expectActive('Kyle');
  });
});

test('number keys typed into a text box do not press buttons, and "b" does not flip the scoreboard', async ({ page }) => {
  const table = await openDemo(page);
  const board = new Board(page);
  await page.keyboard.press('b');
  await expect(board.root).toBeVisible();
  await board.root.getByRole('button', { name: /Reveal a Stage I objective/ }).click();
  const search = board.root.getByPlaceholder(/Search Stage I/);
  await search.pressSequentially('b3b');
  await expect(search).toHaveValue('b3b');
  await expect(board.root).toBeVisible();
  await expect(table.light('Dave')).not.toHaveAttribute('data-pressed', 'true');
  await search.press('Escape');
  await page.keyboard.press('Escape');
  await expect(board.root).toBeHidden();
});
