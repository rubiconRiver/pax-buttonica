import { DEMO, DEMO_ORDER, Table, expect, lab, openDemo, openSettings, setSlider, test } from './helpers';
import { FANFARE_MS } from './flows';

/**
 * The end of a round, and the shape of the big screen. When the last player passes every light celebrates, then
 * scoring goes round in initiative order, one player at a time, then everyone tidies up and taps in. Each step is
 * the table's choice. The players are laid out in the order they act, or round the table, also by choice.
 */

test('the round ends in rainbows, then scoring goes round in initiative order', async ({ page }) => {
  const table = await openDemo(page);
  const board = page.locator('.boardwrap');
  await lab(page, 'Everyone has passed').click();
  await table.expectPhase('Status');
  await table.expectLights(Object.fromEntries(DEMO.map((n) => [n, 'rainbow' as const])));
  await expect(table.banner).toContainText('Status phase');
  await expect(table.banner).toContainText('Round 1 is over');
  await expect(table.center).toContainText('Everyone has passed');
  await expect(board, 'the scoreboard waits for the lights').toBeHidden();
  await expect(table.log).toContainText('Everyone has passed — status phase.');
  // Taps mean nothing yet.
  await table.tap('Dave');
  await table.expectLights({ Dave: 'rainbow' });

  await page.clock.fastForward(FANFARE_MS - 500);
  await expect(table.banner, 'the banner stays up as long as the lights celebrate').toBeVisible();
  await table.expectLights({ Dave: 'rainbow' });
  await page.clock.fastForward(600);
  await expect(board).toBeVisible();
  await expect(board.locator('.board__scoring')).toContainText('Scoring: Dave');
  await expect(board.locator('.stand[data-active] .stand__name')).toHaveText('Dave');
  await expect(table.log).toContainText('Scoring, in initiative order: Dave, Kyle, Mike, Sarah, Steph, Jen.');
  await table.expectLights({ Dave: 'pulse', Kyle: 'dim', Jen: 'dim' });
  await expect(table.light('Dave'), 'your turn to score: rings fall inward').toHaveAttribute('data-react', 'warp');
  await expect(table.seat('Dave').locator('.plate__why')).toHaveText('Your turn to score — tap when done');
  await expect(table.seat('Kyle').locator('.plate__why')).toHaveText('Waiting to score');

  // Out of turn: ignored. Dave's tap: on to Kyle.
  await table.tap('Mike');
  await table.expectLights({ Dave: 'pulse' });
  await table.tap('Dave');
  await expect(board.locator('.board__scoring')).toContainText('Scoring: Kyle');
  await table.expectLights({ Dave: 'dim', Kyle: 'pulse' });
  await expect(table.light('Kyle')).toHaveAttribute('data-react', 'warp');
  await expect(table.seat('Dave').locator('.plate__why')).toHaveText('Scored');
  await expect(table.log).toContainText('Dave is done scoring.');
  // The host can move things along from the scoreboard, and from the table.
  await board.getByRole('button', { name: 'Done' }).click();
  await expect(board.locator('.board__scoring')).toContainText('Scoring: Mike');
  await page.keyboard.press('Escape');
  await expect(board).toBeHidden();
  await expect(table.center.locator('.center__active')).toHaveText('Mike');
  await expect(table.center.locator('.voter[data-state="now"]')).toHaveText('Mike');
  await expect(table.center.locator('.voter[data-state="done"]')).toHaveText(['Dave', 'Kyle']);
  await expect(table.seat('Mike')).toHaveAttribute('data-active', 'true');
  await table.hold('Mike');
  await expect(table.center.locator('.center__active')).toHaveText('Sarah');
  await table.center.getByRole('button', { name: 'Sarah is done' }).click();
  await expect(table.center.locator('.center__active')).toHaveText('Steph');
  await table.center.getByRole('button', { name: 'Skip to the tidy-up' }).click();

  // The tidy-up is dark until everyone has tapped in; a tap shows as dim.
  await expect(table.center).toContainText('0/6 ready');
  await table.expectLights({ Steph: 'off', Dave: 'off' });
  await expect(table.seat('Dave').locator('.plate__why')).toHaveText('Tidy up — tap when ready');
  for (const name of DEMO) await table.tap(name);
  await table.expectPhase('Strategy');
  await expect(page.locator('.phases__round')).toHaveText('R2');
});

test('undo steps back through the scoring, not through the host\'s timer', async ({ page }) => {
  const table = await openDemo(page);
  await lab(page, 'Everyone has passed').click();
  await page.clock.fastForward(FANFARE_MS + 100);
  await page.keyboard.press('Escape');
  await table.tap('Dave');
  await table.tap('Kyle');
  await expect(table.center.locator('.center__active')).toHaveText('Mike');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(table.center.locator('.center__active')).toHaveText('Kyle');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(table.center.locator('.center__active')).toHaveText('Dave');
  // One more takes back the last pass: the action phase again, and the lights celebrate afresh when it comes back.
  await page.keyboard.press('ControlOrMeta+z');
  await table.expectPhase('Action');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await table.expectPhase('Status');
  await table.expectLights({ Dave: 'rainbow' });
  await page.clock.fastForward(FANFARE_MS + 100);
  await table.expectLights({ Dave: 'pulse' });
});

test('every step is the table\'s choice: shorter rainbows, no rainbows, everyone scoring at once', async ({ page }) => {
  const table = await openDemo(page);
  const panel = await openSettings(page);
  await setSlider(panel.getByRole('slider', { name: /Rainbows for/ }), 2000);
  await expect(panel.getByText(/Rainbows for/)).toContainText('2s');
  await panel.getByLabel('Score one player at a time, in initiative order').uncheck();
  await expect(panel.getByRole('radiogroup', { name: "Scorer's cue" })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await lab(page, 'Everyone has passed').click();
  await table.expectLights({ Dave: 'rainbow' });
  await page.clock.fastForward(2100);
  await expect(table.center, 'straight to the tidy-up').toContainText('0/6 ready');
  await table.expectLights({ Dave: 'off', Jen: 'off' });
  await expect(table.log).not.toContainText('Scoring, in initiative order');

  await page.keyboard.press('Escape'); // the scoreboard came up for the tidy-up
  await page.locator('.lab').getByRole('button', { name: 'Reset' }).click();
  await table.expectActive('Dave');
  await (await openSettings(page)).getByLabel('Rainbows when everyone has passed').uncheck();
  await page.keyboard.press('Escape');
  await lab(page, 'Everyone has passed').click();
  await table.expectPhase('Status');
  await expect(table.center).toContainText('0/6 ready');
  await table.expectLights({ Dave: 'off' });
  await expect(table.banner).toBeVisible();
  await page.clock.fastForward(1600);
  await expect(table.banner, 'a plain phase banner, gone in a moment and a half').toBeHidden();
});

test('the big screen shows the order of play, or the seating, and the order follows the phase', async ({ page }) => {
  const table = await openDemo(page);
  const tableBox = page.locator('.table');
  await expect(tableBox).toHaveAttribute('data-layout', 'order');
  await expect(page.locator('.hextable')).toHaveCount(0);
  // Left to right, first to act first; the rank badge says so, and the active one is lit.
  await expect(page.locator('.seat .plate__name')).toHaveText(DEMO_ORDER);
  await expect(page.locator('.seat__rank')).toHaveText(['1', '2', '3', '4', '5', '6']);
  await expect(table.seat('Dave').locator('.seat__rank')).toHaveAttribute('aria-label', '1st to act');
  await expect(table.seat('Kyle').locator('.seat__rank')).toHaveAttribute('aria-label', '2nd to act');
  const x = async (name: string) => (await table.seat(name).boundingBox())!.x;
  expect(await x('Dave')).toBeLessThan(await x('Kyle'));
  expect(await x('Steph')).toBeLessThan(await x('Jen'));
  // The number keys still belong to the seats, not to the ranks: Dave sits in seat three.
  expect(await table.key('Dave')).toBe('3');

  // A new round: the speaker chooses first, and the row follows the choosing order.
  await lab(page, 'Start of round').click();
  await table.expectPhase('Strategy');
  await expect(page.locator('.seat .plate__name')).toHaveText(['Mike', 'Sarah', 'Dave', 'Jen', 'Kyle', 'Steph']);

  const panel = await openSettings(page);
  await panel.getByRole('radio', { name: 'Seating' }).click();
  await page.keyboard.press('Escape');
  await expect(tableBox).toHaveAttribute('data-layout', 'table');
  await expect(page.locator('.hextable')).toHaveCount(1);
  await expect(page.locator('.seat__rank')).toHaveCount(0);
  await expect(page.locator('.seat .plate__name')).toHaveText(DEMO);
  await page.reload();
  await expect(tableBox, 'the choice sticks').toHaveAttribute('data-layout', 'table');
});
