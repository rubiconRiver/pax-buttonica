import { Board, HOLD_MS, Table, expect, lab, openDemo, openSettings, readStorage, setSlider, test } from './helpers';

/**
 * Tap, double-tap and hold are the entire vocabulary of a button, and the on-screen button measures them with the
 * same thresholds a real one will. These tests pin the thresholds down to the millisecond, on a controlled clock.
 */

test.describe('hold to end the turn', () => {
  test('two seconds ends the turn; 1.9 does not', async ({ page }) => {
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

  test("somebody else's hold is ignored", async ({ page }) => {
    const table = await openDemo(page);
    await table.hold('Jen');
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
    expect((await readStorage(page, 'pb.settings.v1')).holdMs).toBe(1000);
    await page.reload();
    await expect(page.locator('.center__hint')).toContainText('hold 1s to end the turn');
  });
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
