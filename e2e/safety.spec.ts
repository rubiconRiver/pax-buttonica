import type { Page } from '@playwright/test';
import { Board, Table, expect, liveSlot, setUpGame, test } from './helpers';
import { pickCards, takeTurn } from './flows';
import { gameCode, openPhone } from './phones';

/**
 * Game-night safety nets: a state that breaks the screen shows a way out instead of a blank page (and keeps doing so
 * across reloads, since the game is saved); the undo shortcut takes back one thing, and never while someone types;
 * the host's screen and the phones stay awake.
 */

const NAMES = ['Ana', 'Ben', 'Cleo'];
const SIX = [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]] as [string, number][];

async function inAction(page: Page) {
  await setUpGame(page, { names: NAMES });
  await page.getByRole('button', { name: /Skip/ }).click();
  const table = new Table(page);
  await pickCards(table, SIX);
  await table.expectActive('Ana');
  return table;
}

test('a saved game that breaks the table shows a way out, and Undo last action brings the table back', async ({ page, problems }) => {
  const table = await inAction(page);
  await takeTurn(table, 'Ana');
  await table.expectActive('Ben');
  const code = await gameCode(page);

  // The saved game loses a piece the table needs to draw (a stand-in for any state that makes the page throw).
  await page.evaluate(() => {
    const slot = JSON.parse(localStorage.getItem('pb.game.v4')!);
    delete slot.game.log;
    localStorage.setItem('pb.game.v4', JSON.stringify(slot));
  });
  const crash = page.getByRole('alert');
  // It would break the page on every reload: each time, the crash screen shows instead of nothing.
  for (let i = 0; i < 2; i++) {
    await page.reload();
    await expect(crash).toContainText('The screen hit a snag');
    await expect(crash).toContainText('The game is safe in this browser');
  }

  // The log can still leave the table from here…
  const [download] = await Promise.all([page.waitForEvent('download'), crash.getByRole('button', { name: 'Download log' }).click()]);
  expect(download.suggestedFilename()).toContain(code);

  // …and undo rebuilds the game from its log without the last action.
  await crash.getByRole('button', { name: 'Undo last action' }).click();
  await expect(crash).toHaveCount(0);
  await table.expectActive('Ana');
  // Nothing is lost: redo replays the log, so Ana's turn comes back on a whole game.
  await page.locator('.topbar').getByRole('button', { name: 'Redo' }).click();
  await table.expectActive('Ben');
  await expect(table.log).toContainText('Ana');
  expect((await liveSlot(page)).game.log.length).toBeGreaterThan(0);

  // React reports what it caught (that is how the fault gets found later), and nothing else went wrong.
  expect(problems.length).toBeGreaterThan(0);
  expect(problems.filter((p) => !/not iterable|CrashGuard/.test(p))).toEqual([]);
  problems.length = 0;
});

test('Ctrl+Z held down undoes once, says what it undid, and offers it back', async ({ page }) => {
  const table = await inAction(page);
  await takeTurn(table, 'Ana');
  await takeTurn(table, 'Ben');
  await table.expectActive('Cleo');

  await page.keyboard.down('ControlOrMeta');
  await page.keyboard.down('z');
  await page.keyboard.down('z'); // the key repeating while it's held
  await page.keyboard.down('z');
  await page.keyboard.up('z');
  await page.keyboard.up('ControlOrMeta');
  await table.expectActive('Ben');
  expect((await liveSlot(page)).future).toHaveLength(1);

  const note = page.locator('.undone');
  await expect(note).toContainText("Undone: Ben's hold");
  await note.getByRole('button', { name: 'Redo' }).click();
  await table.expectActive('Cleo');
  await expect(note).toHaveCount(0);
  expect((await liveSlot(page)).future).toEqual([]);
});

test('Ctrl+Z while typing a law undoes the typing, not the game', async ({ page }) => {
  const table = await inAction(page);
  await takeTurn(table, 'Ana');
  const before = (await liveSlot(page)).events.length;

  const board = new Board(page);
  await board.open();
  const law = board.root.locator('.addlaw').getByPlaceholder('Law');
  await law.pressSequentially('Minister');
  await law.press('ControlOrMeta+z');
  await expect(law).not.toHaveValue('Minister');

  const slot = await liveSlot(page);
  expect(slot.events.length).toBe(before);
  expect(slot.future).toEqual([]);
  await expect(page.locator('.undone')).toHaveCount(0);
  await board.close();
  await table.expectActive('Ben');
});

/** A stand-in for the Screen Wake Lock API that counts the locks taken and lets a test drop them, as the system does. */
function fakeWakeLock() {
  const locks: { released: boolean; release(): Promise<void> }[] = [];
  Object.assign(window, { __locks: locks });
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async () => {
        const lock = { released: false, release: async () => void (lock.released = true), addEventListener() {}, removeEventListener() {} };
        locks.push(lock);
        return lock;
      },
    },
  });
}
const heldLocks = (page: Page) => page.evaluate(() => (window as unknown as { __locks: { released: boolean }[] }).__locks.filter((l) => !l.released).length);
const takenLocks = (page: Page) => page.evaluate(() => (window as unknown as { __locks: unknown[] }).__locks.length);

test('the host screen stays awake while a game is on, and a phone stays awake even while it can\'t reach the table', async ({ page, context }) => {
  await context.addInitScript(fakeWakeLock);
  await page.goto('/play');
  await expect(page.getByRole('button', { name: /Begin round one/ })).toBeVisible();
  expect(await heldLocks(page)).toBe(0);

  const table = await inAction(page);
  await expect.poll(() => heldLocks(page)).toBe(1);
  // The system lets go when the page is hidden; coming back takes it again.
  await page.evaluate(() => {
    (window as unknown as { __locks: { released: boolean }[] }).__locks[0].released = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => takenLocks(page)).toBe(2);
  expect(await heldLocks(page)).toBe(1);
  await takeTurn(table, 'Ana');
  expect(await takenLocks(page)).toBe(2);

  // A phone with the site out of reach is still a button: it keeps its screen on while it waits.
  const phone = await openPhone(context, await gameCode(page));
  await expect.poll(() => heldLocks(phone.page)).toBe(1);

  page.once('dialog', (d) => void d.accept());
  await page.getByTitle('Settings', { exact: true }).click();
  await page.getByRole('button', { name: 'End this game…' }).click();
  await expect(page.getByRole('button', { name: /Begin round one/ })).toBeVisible();
  await expect.poll(() => heldLocks(page)).toBe(0);
});
