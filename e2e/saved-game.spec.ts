import { FakeApi } from './api';
import { Table, expect, liveGame, setUpGame, test } from './helpers';
import { pickCards } from './flows';
import { openPhone, openRoom } from './phones';

/** The game in progress is copied to the site, so it can come back after a cleared browser or on another laptop. */

const NAMES = ['Ana', 'Ben', 'Cleo'];

test('every change is saved to the site a second later, and ending the game removes it', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  await setUpGame(page, { names: NAMES });
  await page.clock.fastForward(1100);
  await expect.poll(() => api.games.size).toBe(1);
  const key = [...api.games.keys()][0];
  expect(api.games.get(key)!.game.players.map((p: { name: string }) => p.name)).toEqual(NAMES);

  await page.getByRole('button', { name: /Skip/ }).click();
  await page.clock.fastForward(1100);
  await expect.poll(() => api.games.get(key)!.game.seating).toBeNull();

  await page.getByTitle('Settings', { exact: true }).click();
  await expect(page.locator('.settings__save')).toHaveText('Saved to the site');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'End this game…' }).click();
  await expect.poll(() => api.games.size).toBe(0);
});

test('a browser that lost its data is offered the game back', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  await setUpGame(page, { names: NAMES });
  await page.getByRole('button', { name: /Skip/ }).click();
  const table = new Table(page);
  await pickCards(table, [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]]);
  await page.clock.fastForward(1100);
  await expect.poll(() => api.games.size).toBe(1);

  // Everything but the host key goes (the key is what makes it "this browser").
  await page.evaluate(() => {
    const key = localStorage.getItem('pb.room.key.v1');
    localStorage.clear();
    localStorage.setItem('pb.room.key.v1', key!);
  });
  await page.goto('/play');
  const offer = page.locator('.setup__saved');
  await expect(offer).toContainText('A game is saved on the site: Ana, Ben, Cleo · round 1');
  await offer.getByRole('button', { name: 'Resume it' }).click();
  await table.expectActive('Ana');
  await expect(table.seat('Ana').locator('.cardpip')).toHaveText(['1', '4']);
  expect((await liveGame(page)).round).toBe(1);
});

test('another laptop picks the game up by its room code, phones and all', async ({ page, context, browser }) => {
  const api = new FakeApi();
  await api.install(context);
  await setUpGame(page, { names: NAMES });
  const code = await openRoom(page);
  await page.getByRole('button', { name: /Skip/ }).click();
  const table = new Table(page);
  await table.hold('Ana').catch(() => {});
  await page.clock.fastForward(1100);
  await expect.poll(() => [...api.games.values()][0]?.code).toBe(code);
  const phone = await openPhone(context, code, { directLink: false });
  for (let i = 0; i < 3; i++) await Promise.all([page.clock.fastForward(1100), phone.page.clock.fastForward(1100)]);
  await phone.iAm('Ben');

  // The other laptop: a fresh browser, nothing in it.
  const other = await browser.newContext({ baseURL: page.url().replace(/\/play$/, '') });
  await other.clock.install();
  await api.install(other);
  await other.route(/peerjs\.com/, (r) => r.abort());
  const laptop = await other.newPage();
  await laptop.goto('/play');
  await laptop.locator('.setup__pickup input').fill(code);
  await laptop.getByRole('button', { name: 'Pick up' }).click();
  const there = new Table(laptop);
  await expect(there.center.locator('.center__title')).toHaveText('Ana is choosing');
  // The room came with it: same code, and Ben's phone is still Ben's.
  await expect(laptop.locator('.topbar')).toContainText(code);
  await laptop.clock.fastForward(1100);
  await phone.page.clock.fastForward(1100);
  await laptop.clock.fastForward(1100);
  await expect(laptop.locator('.topbar')).toContainText(`${code} · 1`);
  await expect(laptop.locator('.log__row', { hasText: 'Ben joins' })).toBeVisible();

  // The old laptop can no longer write: the game belongs to the new one.
  await page.getByRole('button', { name: 'Give Ana a point' }).click();
  await page.clock.fastForward(1100);
  await page.getByTitle('Settings', { exact: true }).click();
  await expect(page.locator('.settings__save')).toHaveText('Picked up on another laptop: this copy no longer saves');
  expect(api.games.size).toBe(1);
  expect([...api.games.values()][0].game.players[0].vp).toBe(0);
  await other.close();
});
