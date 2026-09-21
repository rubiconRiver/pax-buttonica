import { Table, expect, liveGame, openDemo, lab, openSettings, setUpGame, test } from './helpers';
import { pickCards } from './flows';

/** The seat-claiming ritual: buttons breathe white, players press in seat order, and the app learns who holds what. */

const FOUR = ['Ana', 'Ben', 'Cleo', 'Dev'];

test('whatever button you press becomes yours, wherever it is on the table', async ({ page }) => {
  await setUpGame(page, { names: FOUR });
  const table = new Table(page);
  await expect(table.center).toContainText('Claim your seat · 1 of 4');
  await expect(page.locator('.seat--open .dev[data-mode="pulse"]')).toHaveCount(4);

  // Ana grabs button 3.
  await table.tapKey('3');
  expect(await table.key('Ana')).toBe('3');
  await table.expectLights({ Ana: 'solid' });
  await expect(table.center).toContainText('Claim your seat · 2 of 4');
  await expect(table.center.locator('.voter[data-state="claimed"]')).toHaveText('Ana');
  await expect(table.center.locator('.voter[data-state="now"]')).toHaveText('Ben');

  // Ana, excited, presses again. Her button is taken; Ben is still being called.
  await table.tapKey('3');
  await expect(table.center.locator('.center__active')).toHaveText('Ben');

  await table.tapKey('1');
  await table.tapKey('4');
  await table.tapKey('2');
  expect(await Promise.all(FOUR.map((n) => table.key(n)))).toEqual(['3', '1', '4', '2']);
  await expect(table.log).toContainText('Ana claims seat 1.');
  await expect(table.log).toContainText('Everyone is seated.');
  await table.expectPhase('Strategy');
  expect((await liveGame(page)).bindings).toEqual(['sim-2', 'sim-0', 'sim-3', 'sim-1']);

  // The keys keep following the buttons: Ana chooses first, and key 3 is hers.
  await table.expectLights({ Ana: 'pulse' });
  await table.tapKey('3');
  await table.expectToast('Ana: Pick a card on the big screen');
});

test('a hold or a double-tap claims a seat too', async ({ page }) => {
  await setUpGame(page, { names: ['Ana', 'Ben', 'Cleo'] });
  const table = new Table(page);
  await page.keyboard.down('2');
  await page.clock.fastForward(2100);
  await page.keyboard.up('2');
  expect(await table.key('Ana')).toBe('2');
});

test('skip seats everyone in order', async ({ page }) => {
  await setUpGame(page, { names: FOUR });
  const table = new Table(page);
  await page.getByRole('button', { name: /Skip — seat everyone in order/ }).click();
  expect(await Promise.all(FOUR.map((n) => table.key(n)))).toEqual(['1', '2', '3', '4']);
  await table.expectPhase('Strategy');
});

test('re-claiming mid-game keeps the game and stops the clock while chairs move', async ({ page }) => {
  await setUpGame(page, { names: FOUR });
  const table = new Table(page);
  await page.getByRole('button', { name: /Skip/ }).click();
  await pickCards(table, [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Dev', 4], ['Ana', 5], ['Ben', 6], ['Cleo', 7], ['Dev', 8]]);
  await table.expectActive('Ana');
  await page.clock.fastForward(30_000);

  const panel = await openSettings(page);
  await panel.getByRole('button', { name: 'Re-claim seats' }).click();
  await expect(table.center).toContainText('Claim your seat · 1 of 4');
  const before = (await liveGame(page)).clockBanked;
  await page.clock.fastForward(120_000);
  for (const key of ['4', '3', '2', '1']) await table.tapKey(key);

  // Same game, same turn, new buttons.
  await table.expectActive('Ana');
  expect(await table.key('Ana')).toBe('4');
  const g = await liveGame(page);
  expect(g.round).toBe(1);
  expect(g.players[0].cards).toEqual([1, 5]);
  expect(g.clockBanked).toBe(before);
  await table.hold('Ana');
  await table.expectActive('Ben');
  // Ana's turn is charged for the 30 seconds before the shuffle, not the two minutes of it.
  const ana = (await liveGame(page)).players[0].timeMs;
  expect(ana).toBeGreaterThan(30_000);
  expect(ana).toBeLessThan(60_000);
});

test('the scenario lab can start a claiming round in the demo', async ({ page }) => {
  const table = await openDemo(page);
  await lab(page, 'Seat claiming').click();
  await expect(table.center).toContainText('Claim your seat · 1 of 6');
  await expect(lab(page, 'Seat claiming')).toBeDisabled();
  await expect(lab(page, 'End turn')).toBeDisabled();
  for (const key of ['6', '5', '4', '3', '2', '1']) await table.tapKey(key);
  expect(await table.key('Mike')).toBe('6');
  await table.expectActive('Dave');
});
