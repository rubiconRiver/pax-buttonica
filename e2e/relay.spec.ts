import { FakeApi } from './api';
import { Board, Table, expect, liveGame, readStorage, setUpGame, test } from './helpers';
import { pickCards } from './flows';
import { openPhone, openRoom, tinyWav } from './phones';

/**
 * Phones that cannot reach the laptop directly (most guest Wi-Fi) go through the site: the host writes each
 * phone's light to /api/room and reads presses from an inbox, the phone polls. Here the direct link is dead on
 * purpose (fake-peerjs never completes a connection) and the site is FakeApi.
 */

const NAMES = ['Ana', 'Ben', 'Cleo'];
const SIX = [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]] as [string, number][];

/**
 * Time has to pass for polls to happen. One round: the laptop reads its inbox and writes the room; the phone reads
 * it. Three rounds cover a message and its answer whichever order the two pages happen to run in.
 */
async function tick(pages: import("@playwright/test").Page[], rounds = 3) {
  for (let i = 0; i < rounds; i++) await Promise.all(pages.map((p) => p.clock.fastForward(1100)));
}

test('the whole phone flow, with no direct link at all', async ({ page, context }) => {
  test.setTimeout(120_000);
  const api = new FakeApi();
  await api.install(context);
  await setUpGame(page, { names: NAMES });
  const table = new Table(page);
  const code = await openRoom(page);
  await page.clock.fastForward(400);
  await page.getByRole('button', { name: `${code} · 0` }).click();
  await expect(page.locator('.popover--phones .room__ways span').first()).toHaveText('Via the site: ready');
  await expect(page.locator('.popover--phones .room__ways span').nth(1), 'the laptop can reach the broker; it is the phone that cannot get through').toHaveText('Direct link: ready');
  await page.keyboard.press('Escape');

  const phone = await openPhone(context, code, { directLink: false });
  const both = [page, phone.page];
  await tick(both);
  await expect(phone.page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
  await phone.iAm('Ben');
  await tick(both);
  await expect(phone.page.locator('.join__link')).toHaveText('Connected via the site');
  await expect(page.getByRole('button', { name: `${code} · 1` })).toBeVisible();
  await expect(table.log).toContainText('Ben joins on their own device.');
  await expect(phone.who).toHaveText('Ben');
  await phone.expectLight('solid');

  await table.tapKey('2');
  await table.tapKey('3');
  await pickCards(table, SIX);
  await table.expectActive('Ana');
  await table.hold('Ana');
  await tick(both);
  await phone.expectLight('pulse');
  await expect(phone.why).toHaveText('Your turn — hold to end it');

  // A hold on the phone reaches the laptop through the inbox.
  await phone.hold();
  await tick(both);
  await table.expectActive('Cleo');
  await tick(both);
  await phone.expectLight('dim');

  // The card flow, both ways.
  await table.doubleTap('Cleo');
  await table.center.getByRole('button', { name: '3 Politics' }).click();
  await table.primaryDone('Cleo');
  await tick(both);
  await phone.expectLight('flash');
  await phone.tap();
  await tick(both);
  await expect(table.center.locator('.ackpip', { hasText: 'Ben' })).toHaveAttribute('data-done', 'true');
  await tick(both);
  await phone.expectLight('dim');

  // Profile edits and a clip, through the site: the clip goes up to /api/clips and the host is told its id.
  await phone.page.getByRole('button', { name: 'Ben · profile' }).click();
  const sheet = phone.page.getByRole('dialog', { name: 'Your profile' });
  await sheet.getByRole('radio', { name: 'Pink' }).click();
  await sheet.locator('input[type=file]').first().setInputFiles({ name: 'horn.wav', mimeType: 'audio/wav', buffer: tinyWav() });
  await tick(both);
  await expect.poll(async () => (await readStorage<{ name: string; color: string }[]>(page, 'pb.profiles.v1'))!.find((p) => p.name === 'Ben')!.color).toBe('pink');
  await expect.poll(() => api.clips.size).toBe(1);
  const [clipId] = [...api.clips.keys()];
  await expect.poll(async () => (await liveGame(page)).players[1].intro).toEqual({ kind: 'clip', id: clipId, name: 'horn' });

  // "The table" comes through the same room record.
  const board = new Board(page);
  await board.open();
  await board.reveal(1, 'Expand Borders');
  await board.close();
  await phone.page.getByRole('button', { name: 'Done' }).click();
  await phone.page.getByRole('button', { name: 'The table' }).click();
  await tick(both);
  await expect(phone.page.locator('.board .obj')).toContainText('Expand Borders');

  // Nothing about the laptop's secret leaks to the phone side.
  const phoneReads = api.requests.filter((r) => r.method === 'GET' && r.url.includes('dev='));
  expect(phoneReads.length).toBeGreaterThan(3);
  expect(phoneReads.every((r) => !r.url.includes('key='))).toBe(true);
});

test('a phone that stops checking in is dropped; one that comes back keeps its seat', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  await setUpGame(page, { names: NAMES });
  const table = new Table(page);
  const code = await openRoom(page);
  const phone = await openPhone(context, code, { directLink: false });
  await tick([page, phone.page]);
  await phone.iAm('Ana');
  await tick([page, phone.page]);
  await expect(page.getByRole('button', { name: `${code} · 1` })).toBeVisible();

  const identity = await phone.identity();
  await phone.page.close();
  await page.clock.fastForward(50_000);
  await expect(page.getByRole('button', { name: `${code} · 0` })).toBeVisible();

  const again = await openPhone(context, code, { directLink: false, identity });
  await tick([page, again.page]);
  await expect(again.who).toHaveText('Ana');
  await expect(table.center.locator('.center__active')).toHaveText('Ben');
});

test('a phone moves from the site to the direct link when one comes up, without saying who it is twice', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  await setUpGame(page, { names: NAMES });
  const code = await openRoom(page);
  const phone = await openPhone(context, code, { directLink: false });
  await tick([page, phone.page]);
  await phone.iAm('Cleo');
  await tick([page, phone.page]);
  await expect(phone.page.locator('.join__link')).toHaveText('Connected via the site');
  await expect(page.locator('.topbar')).toContainText(`${code} · 1`);

  // The network improves: the next dial goes through.
  await phone.page.evaluate(() => sessionStorage.removeItem('fake-peer-dead'));
  // The dead dial gives up after a few seconds and the phone dials again. Time moves in small steps so the
  // laptop's answer (real time, between tabs) can land before the phone's dial times out.
  for (let i = 0; i < 12; i++) {
    await phone.page.clock.fastForward(1000);
    await phone.page.waitForTimeout(80);
  }
  await expect(phone.page.locator('.join__link')).toHaveText('Connected');
  await expect(phone.who).toHaveText('Cleo');
  await page.getByRole('button', { name: `${code} · 1` }).click();
  await expect(page.locator('.popover--phones')).toContainText('1 direct, 0 via the site');
  expect(await page.locator('.log__row', { hasText: 'joins on their own device' }).count()).toBe(1);
});

test('with the site unreachable, the direct link still works and the panel says which is which', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const code = await openRoom(page);
  const phone = await openPhone(context, code);
  await phone.iAm('Ana');
  await expect(phone.page.locator('.join__link')).toHaveText('Connected');
  await page.getByRole('button', { name: `${code} · 1` }).click();
  await expect(page.locator('.room__ways span').first()).toHaveText('Via the site: not reachable');
  await expect(page.locator('.room__ways span').nth(1)).toHaveText('Direct link: ready');
});
