import { FakeApi } from './api';
import { Table, expect, liveGame, liveSlot, openDemo, setUpGame, test } from './helpers';
import { pickCards, takeTurn } from './flows';
import { gameCode, openPhone, tick } from './phones';

/**
 * The game is a log of what happened. Undo and redo cut and restore it; any line of the Ship's log can be
 * rewound to; the referee's levers are ordinary logged actions; and the log leaves the table as a file.
 */

const NAMES = ['Ana', 'Ben', 'Cleo'];
const SIX = [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]] as [string, number][];

async function inAction(page: import('@playwright/test').Page) {
  await setUpGame(page, { names: NAMES });
  await page.getByRole('button', { name: /Skip/ }).click();
  const table = new Table(page);
  await pickCards(table, SIX);
  await table.expectActive('Ana');
  return table;
}

test('the log is a list of events with times, and the state is its replay', async ({ page }) => {
  const table = await inAction(page);
  await takeTurn(table, 'Ana');
  await table.tap('Ben'); // a nudge: refused, but on record
  const slot = await liveSlot(page);
  expect(slot.base.round).toBe(1);
  expect(slot.base.phase).toBe('strategy');
  const types = slot.events.map((e: { action: { type: string } }) => e.action.type);
  expect(types.slice(1, 7)).toEqual(Array(6).fill('PICK_CARD'));
  expect(types.slice(-2)).toEqual(['INPUT', 'INPUT']);
  expect(slot.events.at(-1).noop).toBe(true);
  expect(slot.events.every((e: { at: number }) => Number.isInteger(e.at) && e.at > 0)).toBe(true);
  expect(slot.events[0].action.type).toBe('SKIP_SEATING');
});

test('undo and redo, by button and by keyboard', async ({ page }) => {
  const table = await inAction(page);
  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await takeTurn(table, 'Ana');
  await takeTurn(table, 'Ben');
  await table.expectActive('Cleo');
  await undo.click();
  await table.expectActive('Ben');
  await expect(redo).toBeVisible();
  await redo.click();
  await table.expectActive('Cleo');
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await table.expectActive('Ana');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await table.expectActive('Ben');
  // Doing something new throws the rest of the future away.
  await table.hold('Ben');
  await expect(redo).toHaveCount(0);
  await table.expectActive('Cleo');
  expect((await liveSlot(page)).future).toEqual([]);
});

test('rewind from the Ship\'s log: two clicks, and everything since is gone', async ({ page }) => {
  const table = await inAction(page);
  await table.doubleTap('Ana');
  await table.center.getByRole('button', { name: '1 Leadership' }).click();
  await table.primaryDone('Ana');
  await table.tap('Ben');
  await table.tap('Cleo');
  await table.hold('Ana');
  await takeTurn(table, 'Ben');
  // Cleo is marked as passed by mistake (the referee, since she still holds cards).
  await page.getByRole('button', { name: 'Referee', exact: true }).click();
  await page.getByRole('dialog', { name: 'Referee' }).locator('li', { hasText: 'Cleo' }).getByLabel('passed').check();
  await page.keyboard.press('Escape');
  await table.expectActive('Ana');
  await takeTurn(table, 'Ana');
  await table.expectActive('Ben');
  await expect(table.seat('Cleo')).toHaveAttribute('data-passed', 'true');

  const passRow = table.log.locator('.log__row', { hasText: 'Referee: Cleo passes.' });
  const rewind = passRow.getByRole('button', { name: /Rewind to before/ });
  await passRow.hover();
  await rewind.click();
  await expect(rewind).toHaveText(/Rewind to here\?/);
  await rewind.click();

  await table.expectActive('Cleo');
  await expect(table.seat('Cleo')).not.toHaveAttribute('data-passed', 'true');
  await expect(table.log).not.toContainText('Referee: Cleo passes.');
  // What came before stays, including Ana's card play.
  await expect(table.log).toContainText('Ana plays 1 · Leadership.');
  await expect(table.seat('Ana').locator('.cardpip').first()).toHaveAttribute('data-used', 'true');
  // And it can be put back, one step at a time.
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(table.seat('Cleo')).toHaveAttribute('data-passed', 'true');
  await table.expectActive('Ana');
  await page.getByRole('button', { name: 'Redo' }).click();
  await table.expectActive('Ben');
  await expect(page.getByRole('button', { name: 'Redo' })).toHaveCount(0);
});

test('a phone keeps its seat through a rewind', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  await setUpGame(page, { names: NAMES });
  const code = await gameCode(page);
  await page.clock.fastForward(300);
  const phone = await openPhone(context, code);
  await phone.iAm('Ben');
  await tick([page, phone.page]);
  const table = new Table(page);
  await table.tapKey('2');
  await table.tapKey('3');
  await pickCards(table, SIX);
  await takeTurn(table, 'Ana');
  await table.expectActive('Ben');
  await takeTurn(table, 'Ben');
  // Rewind to before the cards were picked: Ben's phone said who it was before that, and stays his.
  const row = table.log.locator('.log__row', { hasText: 'Ana takes 1' });
  await row.hover();
  const btn = row.getByRole('button', { name: /Rewind/ });
  await btn.click();
  await btn.click();
  await table.expectPhase('Strategy');
  expect((await liveGame(page)).bindings[1]).toMatch(/^web-/);
  await tick([page, phone.page]);
  await expect(phone.who).toHaveText('Ben');
  // The site's copy of the log was cut too.
  await expect.poll(() => api.events.get(code)!.length).toBe((await liveSlot(page)).events.length);
});

test('the referee: hand the turn over, un-pass, cancel a card, mark a card, jump a phase', async ({ page }) => {
  const table = await inAction(page);
  const open = async () => {
    await page.getByRole('button', { name: 'Referee', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Referee' });
    await expect(panel).toBeVisible();
    return panel;
  };
  let panel = await open();
  await panel.getByLabel('Give the turn to').selectOption({ label: 'Cleo' });
  await panel.getByRole('button', { name: 'Give them the turn' }).click();
  await table.expectActive('Cleo');
  await expect(table.log).toContainText('Referee: the turn goes to Cleo.');
  await page.keyboard.press('Escape');

  await table.doubleTap('Cleo');
  await table.center.getByRole('button', { name: '3 Politics' }).click();
  panel = await open();
  await panel.getByRole('button', { name: /Cancel Politics: back to Cleo, unplayed/ }).click();
  await expect(table.center.locator('.play')).toHaveCount(0);
  await expect(table.seat('Cleo').locator('.cardpip').first()).not.toHaveAttribute('data-used', 'true');

  await panel.locator('li', { hasText: 'Ben' }).getByLabel('passed').check();
  await expect(table.seat('Ben')).toHaveAttribute('data-passed', 'true');
  await panel.locator('li', { hasText: 'Ben' }).getByLabel('passed').uncheck();
  await expect(table.seat('Ben')).not.toHaveAttribute('data-passed', 'true');

  await panel.getByRole('button', { name: "Ana's Leadership, unplayed" }).click();
  await expect(table.seat('Ana').locator('.cardpip').first()).toHaveAttribute('data-used', 'true');

  await panel.getByRole('button', { name: 'Jump to the status phase' }).click();
  await table.expectPhase('Status');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); // the scoreboard came up for the status phase
  // All of it is undoable: eight referee moves and card plays back to Cleo's plain turn, one more to Ana's.
  for (let i = 0; i < 7; i++) await page.keyboard.press('ControlOrMeta+z');
  await table.expectActive('Cleo');
  await page.keyboard.press('ControlOrMeta+z');
  await table.expectActive('Ana');
});

test('the log leaves the table as a file, during the game and after it', async ({ page }) => {
  const table = await inAction(page);
  await takeTurn(table, 'Ana');
  const code = (await liveGame(page)).code;

  await page.getByTitle('Settings', { exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the game log' }).click()]);
  expect(download.suggestedFilename()).toMatch(new RegExp(`^pax-buttonica-${code}-\\d{4}-\\d{2}-\\d{2}\\.json$`));
  const doc = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()));
  expect(doc.format).toBe('pax-buttonica-game-log/1');
  expect(doc.players).toEqual(NAMES);
  expect(doc.events.some((e: { action: { type: string; input?: string } }) => e.action.type === 'INPUT' && e.action.input === 'hold')).toBe(true);
  expect(doc.final.active).toBe(1);

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'End this game…' }).click();
  const past = page.locator('.setup__archive');
  await expect(past).toContainText(`${code}`);
  await expect(past).toContainText('Ana, Ben, Cleo · 1 round · unfinished');
  const [again] = await Promise.all([page.waitForEvent('download'), past.getByRole('button', { name: 'Download log' }).click()]);
  expect(again.suggestedFilename()).toContain(code);
  await past.getByRole('button', { name: `Forget game ${code}` }).click();
  await expect(past).toHaveCount(0);
});

test('another laptop picks up the log with the game, and can rewind it', async ({ page, context, browser }) => {
  const api = new FakeApi();
  await api.install(context);
  const table = await inAction(page);
  const code = await gameCode(page);
  await takeTurn(table, 'Ana');
  await page.clock.fastForward(300);
  await expect.poll(() => api.events.get(code)?.length).toBeGreaterThan(6);

  const other = await browser.newContext({ baseURL: page.url().replace(/\/play$/, '') });
  await other.clock.install();
  await api.install(other);
  const laptop = await other.newPage();
  await laptop.goto('/play');
  await laptop.locator('.setup__pickup input').fill(code);
  await laptop.getByRole('button', { name: 'Pick up' }).click();
  const there = new Table(laptop);
  await there.expectActive('Ben');
  await laptop.getByRole('button', { name: 'Undo' }).click();
  await there.expectActive('Ana');
  await expect(there.log).toContainText('Ana takes 1');
  await other.close();
});

test('the demo has undo but no rewind marks or referee', async ({ page }) => {
  const table = await openDemo(page);
  await table.hold('Dave');
  await expect(page.getByRole('button', { name: 'Referee', exact: true })).toHaveCount(0);
  await expect(table.log.locator('.log__rewind')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await table.expectActive('Dave');
});
