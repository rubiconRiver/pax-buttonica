import { FakeApi, profileRow } from './api';
import { Table, expect, liveGame, readStorage, setUpGame, test } from './helpers';
import type { Page } from '@playwright/test';
import { tinyWav } from './phones';

/**
 * Saved players live in the site's database and are mirrored in each browser. These tests stand in for the database
 * (e2e/api.ts) and check the sync rules: local first, newest edit wins, deletions travel, offline is not an error.
 */

const PRIYA = '11111111-1111-4111-8111-111111111111';
const T0 = new Date('2026-10-01T12:00:00Z').getTime();
/** The browser's clock is the test's clock, not this machine's: timestamps that must be "newer" come from the page. */
const pageNow = (page: Page) => page.evaluate(() => Date.now());

test('setting yourself up at home: /me creates a profile and saves it to the site', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  await page.goto('/me');
  await expect(page.locator('.eyebrow')).toHaveText('Pax Buttonica');
  await expect(page.getByText('Nobody here yet. Be the first.')).toBeVisible();
  await page.getByLabel('Your name').fill('Garett');
  await page.getByRole('button', { name: "That's me" }).click();

  const sheet = page.getByRole('dialog', { name: 'Your profile' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('radio', { name: 'Green' }).click();
  await sheet.locator('select').first().selectOption({ label: 'Silent' });
  // Edits are bundled: nothing goes up until the typing stops.
  expect(api.requests.filter((r) => r.method === 'PUT')).toHaveLength(0);
  await page.clock.fastForward(800);
  await expect.poll(() => api.named('Garett')).toMatchObject({ color: 'green', intro: { kind: 'none' } });
  expect(api.requests.filter((r) => r.method === 'PUT').length).toBe(1);
  await expect(page.locator('.join--ask > .eyebrow')).toHaveText('Saved');

  // The phone remembers who it is.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Garett' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /Not Garett\? Switch player/ }).click();
  await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
  await expect(page.locator('.who-list__item')).toHaveText(['Garett']);
});

test('players saved elsewhere show up here, and the newest edit wins in both directions', async ({ page, context }) => {
  const api = new FakeApi();
  api.put(profileRow(PRIYA, 'Priya', 'purple', T0));
  await api.install(context);
  await page.goto('/play');
  await expect(page.locator('.setup__sync')).toHaveText('1 saved player · synced');
  await expect(page.locator('.seatcard').first().getByLabel('Who is sitting here?').locator('option')).toHaveText(['New player', 'Priya']);

  // She renames herself on her phone at home; this laptop picks it up on its next look.
  api.put(profileRow(PRIYA, 'Priyanka', 'purple', (await pageNow(page)) + 60_000));
  await page.clock.fastForward(21_000);
  await expect(page.locator('.seatcard').first().getByLabel('Who is sitting here?').locator('option')).toHaveText(['New player', 'Priyanka']);

  // An edit made here is newer still, so it goes up…
  await page.clock.fastForward(120_000);
  await page.locator('.seatcard').first().getByLabel('Who is sitting here?').selectOption({ label: 'Priyanka' });
  await page.locator('.seatcard').first().getByRole('radio', { name: 'Pink' }).click();
  await page.clock.fastForward(800);
  await expect.poll(() => api.named('Priyanka')?.color).toBe('pink');

  // …but a stale copy from another browser does not overwrite it.
  const before = api.named('Priyanka')!.updatedAt;
  api.put({ ...api.named('Priyanka')!, color: 'red', updatedAt: before - 1 });
  await page.clock.fastForward(21_000);
  await expect.poll(() => api.named('Priyanka')?.color, 'the newer local copy is pushed back up').toBe('pink');
});

test('forgetting a player deletes them from the site, and a deletion made elsewhere arrives here', async ({ page, context }) => {
  const api = new FakeApi();
  api.put(profileRow(PRIYA, 'Priya', 'pink', T0));
  api.put(profileRow('22222222-2222-4222-8222-222222222222', 'Marc', 'black', T0));
  await api.install(context);
  await page.goto('/play');
  const seat = page.locator('.seatcard').first();
  await seat.getByLabel('Who is sitting here?').selectOption({ label: 'Marc' });
  await seat.getByRole('button', { name: 'Forget' }).click();
  await page.clock.fastForward(800);
  await expect.poll(() => api.requests.some((r) => r.method === 'DELETE' && r.url.includes('22222222'))).toBe(true);
  expect(api.named('Marc')).toBeUndefined();

  api.put({ id: PRIYA, updatedAt: (await pageNow(page)) + 1000, deleted: true });
  await page.clock.fastForward(21_000);
  await expect(page.locator('.setup__sync')).toHaveText('0 saved players · synced');
  expect(await readStorage(page, 'pb.profiles.v1')).toEqual([]);
});

test('offline is not an error: everything works locally and catches up later', async ({ page, context }) => {
  const api = new FakeApi();
  api.online = false;
  await api.install(context);
  await page.goto('/me');
  await expect(page.locator('.eyebrow')).toHaveText('Offline: changes stay on this device for now');
  await page.getByLabel('Your name').fill('Lise');
  await page.getByRole('button', { name: "That's me" }).click();
  await expect(page.locator('.join--ask > .eyebrow')).toHaveText('Offline: will save when back online');
  await page.clock.fastForward(800);
  expect(api.rows.size).toBe(0);

  api.online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => api.named('Lise')).toBeTruthy();
  await expect(page.locator('.join--ask > .eyebrow')).toHaveText('Saved');
});

test('an uploaded clip is kept in the browser and copied to the site', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  await page.goto('/me');
  await page.getByLabel('Your name').fill('Owen');
  await page.getByRole('button', { name: "That's me" }).click();
  const sheet = page.getByRole('dialog', { name: 'Your profile' });
  await sheet.locator('input[type=file]').first().setInputFiles({ name: 'imperial-march.wav', mimeType: 'audio/wav', buffer: tinyWav() });
  await expect(sheet.locator('select').first().locator('option:checked')).toHaveText('♪ imperial-march');
  await expect.poll(() => api.clips.size).toBe(1);
  const [clip] = [...api.clips.values()];
  expect(clip).toMatchObject({ type: 'audio/wav', bytes: tinyWav().length, name: 'imperial-march' });
  expect(await readStorage(page, 'pb.clips.pending.v1'), 'nothing left waiting to upload').toEqual([]);

  // Too big is refused before anything is stored or sent.
  await sheet.locator('input[type=file]').nth(1).setInputFiles({ name: 'whole-album.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(4 * 1024 * 1024 + 1) });
  await expect(sheet.locator('.soundpick__error')).toHaveText('Keep clips under 4 MB. Trim it to the good part.');
  expect(api.clips.size).toBe(1);
});

test('a clip uploaded while offline waits, and goes up when the site is reachable', async ({ page, context }) => {
  const api = new FakeApi();
  api.online = false;
  await api.install(context);
  await page.goto('/me');
  await page.getByLabel('Your name').fill('Owen');
  await page.getByRole('button', { name: "That's me" }).click();
  await page.getByRole('dialog').locator('input[type=file]').first().setInputFiles({ name: 'horn.wav', mimeType: 'audio/wav', buffer: tinyWav() });
  await expect.poll(async () => ((await readStorage<unknown[]>(page, 'pb.clips.pending.v1')) ?? []).length).toBe(1);
  api.online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => api.clips.size).toBe(1);
  await expect.poll(async () => await readStorage(page, 'pb.clips.pending.v1')).toEqual([]);
});

test('a player who renames themselves mid-game is renamed on the table', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  await setUpGame(page, { names: ['Ana', 'Ben', 'Cleo'] });
  await page.getByRole('button', { name: /Skip/ }).click();
  const table = new Table(page);
  await page.clock.fastForward(800);
  await expect.poll(() => api.named('Ben')).toBeTruthy();

  // Ben, on his phone, on the site (not through the room): new name, no exit sound.
  api.put({ ...api.named('Ben')!, name: 'Benoit', outro: { kind: 'none' }, updatedAt: (await pageNow(page)) + 5000 });
  await page.clock.fastForward(21_000);
  await expect(table.seat('Benoit').locator('.plate__name')).toBeVisible();
  await expect(table.roster('Benoit')).toBeVisible();
  const g = await liveGame(page);
  expect(g.players[1]).toMatchObject({ name: 'Benoit', outro: { kind: 'none' } });
  // A rename is not an undo step. Undo goes straight past it to the last real move (skipping the seat claiming),
  // and the new name survives the trip back in time.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(table.center).toContainText('Claim your seat · 1 of 3');
  await expect(table.center.locator('.voter').nth(1)).toHaveText('Benoit');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});
