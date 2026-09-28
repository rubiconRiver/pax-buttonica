import { FakeApi } from './api';
import { Table, expect, liveGame, setUpGame, test } from './helpers';
import { pickCards } from './flows';
import { feed, hello, installFakeHub, press } from './hub';
import { gameCode, openPhone, tick } from './phones';

/**
 * The tag on a real button. Every button carries /b/<its id> on an NFC sticker or QR code. Scanning it registers
 * the button to a player the first time; after that it opens the game the button is in, on the phone, as its owner,
 * alongside the button rather than instead of it. A registered button also sits down at its owner's seat by itself.
 */

const NAMES = ['Ana', 'Ben', 'Cleo'];
const SIX = [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]] as [string, number][];
const A = 'a1:b2:c3:00:00:01';
const B = 'a1:b2:c3:00:00:02';
const TAG_A = 'a1b2c3000001';
const row = (id: string, name: string, color: string, extra: Record<string, unknown> = {}) =>
  ({ id, updatedAt: 1, name, color, faction: 'The Winnu', buttons: 1, intro: { kind: 'none' }, outro: { kind: 'none' }, ...extra });

test('a registered button sits down by itself, and its tag opens the game on its owner\'s phone, alongside it', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  api.put(row('ana-00000000', 'Ana', 'red', { buttonIds: [TAG_A] }));
  await installFakeHub(page);
  await setUpGame(page, { names: NAMES });
  const code = await gameCode(page);
  await page.clock.fastForward(300);
  await page.getByRole('button', { name: 'Hub', exact: true }).click();
  await feed(page, { t: 'hub', v: 0, fw: '0.1.0' }, hello(A), hello(B));
  const table = new Table(page);
  await expect(table.log).toContainText('Ana joins on their own device.');
  await expect(table.center.locator('.center__active'), 'Ana is seated without pressing: the ritual starts with Ben').toHaveText('Ben');
  expect((await liveGame(page)).bindings[0]).toBe(A);

  // Ana taps her phone on her button's tag.
  const phone = await openPhone(context, code, { path: `/b/${TAG_A}` });
  const both = [page, phone.page];
  await expect(phone.page).toHaveURL(new RegExp(`/join/${code}$`));
  await tick(both);
  await expect(phone.who).toHaveText('Ana');
  await expect(phone.page.locator('.join__help')).toContainText('Alongside your button');
  await phone.expectLight('solid');
  expect((await liveGame(page)).bindings[0], 'the real button keeps the seat').toBe(A);
  await expect(table.log).toContainText("Ana's phone joins alongside their button.");

  // Her phone never claims a seat for somebody else.
  await phone.tap();
  await tick(both);
  await expect(table.center.locator('.center__active')).toHaveText('Ben');
  await feed(page, press(B, 'tap'));
  await table.tapKey('3');
  await pickCards(table, SIX);
  await table.expectActive('Ana');
  await tick(both);
  await phone.expectLight('pulse');
  await expect(phone.why).toHaveText('Your turn — hold to end it');
  // Presses on the phone count for her seat.
  await phone.hold();
  await tick(both);
  await table.expectActive('Ben');
  expect((await liveGame(page)).bindings[0]).toBe(A);
});

test('an unregistered button asks whose it is; from then on its tag knows, and the owner can change', async ({ page, context }) => {
  const api = new FakeApi();
  await api.install(context);
  api.put(row('ben-00000000', 'Ben', 'blue'));
  api.put(row('cleo-0000000', 'Cleo', 'green'));
  const phone = await openPhone(context, '', { path: '/b/A1B2C3D4E5F6' });
  await expect(phone.page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
  await expect(phone.page.locator('.join--ask .eyebrow')).toHaveText('Whose button is this?');
  await phone.iAm('Ben');
  await expect(phone.page.getByRole('heading', { name: "Ben's button" })).toBeVisible();
  await expect(phone.page.locator('.join')).toContainText('Not in a game right now');
  await phone.page.clock.fastForward(1000);
  await expect.poll(() => api.named('Ben')?.buttonIds, 'saved with his profile').toEqual(['a1b2c3d4e5f6']);

  // Scanning it again goes straight to Ben.
  await phone.page.reload();
  await expect(phone.page.getByRole('heading', { name: "Ben's button" })).toBeVisible();

  // It was Cleo's all along: a button belongs to one person.
  await phone.page.getByRole('button', { name: 'Not yours? Claim it' }).click();
  await phone.iAm('Cleo');
  await expect(phone.page.getByRole('heading', { name: "Cleo's button" })).toBeVisible();
  await phone.page.clock.fastForward(1000);
  await expect.poll(() => api.named('Cleo')?.buttonIds).toEqual(['a1b2c3d4e5f6']);
  await expect.poll(() => api.named('Ben')?.buttonIds).toEqual([]);

  // Her profile lists it, and can forget it.
  await phone.page.getByRole('link', { name: 'Your profile' }).click();
  await expect(phone.page.getByRole('heading', { name: 'Cleo' })).toBeVisible();
  await expect(phone.page.locator('.me__list code')).toHaveText('a1b2c3d4e5f6');
  await phone.page.getByRole('button', { name: 'Forget' }).click();
  await expect(phone.page.locator('.me__list')).toHaveCount(0);
  await phone.page.clock.fastForward(1000);
  await expect.poll(() => api.named('Cleo')?.buttonIds).toEqual([]);
});

test('a tag nobody can look up says so, and offers to try again', async ({ page }) => {
  await page.goto('/b/A1B2C3D4E5F6');
  await expect(page.getByRole('heading', { name: "Can't reach the site" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
