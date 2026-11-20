import type { BrowserContext, Page } from '@playwright/test';
import { SECRET_DECK } from '../api/_secretsDeck';
import { FakeApi } from './api';
import { expect, test } from './helpers';

/**
 * Secret objectives, dealt ahead of game night (/secrets). The promise under test: whoever sets the deal up can do
 * everything, and at no point does their screen hold a card.
 */

const SIX = ['Garett', 'Alan', 'Branson', 'Cam', 'Devon', 'Jason'];
const CARD_NAMES = SECRET_DECK.map((c) => c.name);

/** A tab that is its own device: links lock to the first device that opens them. (Tabs share localStorage.) */
async function device(context: BrowserContext, url = 'about:blank'): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript(() => {
    const own = (s: Storage, k: string) => (s === localStorage && k === 'pb.secrets.dev' ? sessionStorage : s);
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = function (k) { return getItem.call(own(this, k), k); };
    Storage.prototype.setItem = function (k, v) { return setItem.call(own(this, k), k, v); };
  });
  if (url !== 'about:blank') await page.goto(url);
  return page;
}

/** No card's name is anywhere on the page: not shown, not hidden, not in an attribute. */
async function expectNoCards(page: Page) {
  const html = await page.content();
  expect(CARD_NAMES.filter((n) => html.includes(n))).toEqual([]);
}

async function setUp(page: Page, names = SIX, title = 'Game night') {
  await page.goto('/secrets');
  await page.getByLabel('Players, one on each line').fill(names.join('\n'));
  await page.getByLabel(/What to call it/).fill(title);
  await page.getByRole('button', { name: 'Deal the secrets' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
}
const seat = (page: Page, name: string) => page.locator('.secrets__seat').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) });
const linkOf = async (page: Page, name: string) => (await seat(page, name).getAttribute('data-link'))!;
const pullerLink = (api: FakeApi, page: Page) => {
  const d = [...api.drafts.values()].at(-1)!;
  return `${new URL(page.url()).origin}/secrets/${keyOf(d)}`;
};
const keyOf = (d: { id: string; revealToken: string }) => `${d.id}-${d.revealToken}`;
/** Open a player's link on a device of their own and return the two cards they were dealt. */
async function open(context: BrowserContext, link: string) {
  const page = await device(context, link);
  await page.getByRole('button', { name: 'Show me my two' }).click();
  await expect(page.locator('button.secret')).toHaveCount(2);
  return { page, cards: await page.locator('.secret__name').allInnerTexts() };
}
async function keep(page: Page, index: number) {
  const name = await page.locator('button.secret .secret__name').nth(index).innerText();
  await page.locator('button.secret').nth(index).click();
  await page.getByRole('button', { name: /^Confirm: keep/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('you kept');
  return name;
}
/** The dashboard asks the site every five seconds. */
const poll = async (page: Page) => {
  await page.clock.fastForward(5200);
};

test.describe('secret objectives, dealt early', () => {
  let api: FakeApi;
  test.beforeEach(async ({ context }) => {
    api = new FakeApi();
    await api.install(context);
  });

  test('setting up: two to eight players, no two alike', async ({ page }) => {
    await page.goto('/secrets');
    const go = page.getByRole('button', { name: 'Deal the secrets' });
    await expect(go).toBeDisabled();
    const names = page.getByLabel('Players, one on each line');
    await names.fill('Garett');
    await expect(go).toBeDisabled();
    await expect(page.getByTestId('count')).toHaveText('1 player');
    await names.fill(Array.from({ length: 9 }, (_, i) => `Player ${i + 1}`).join('\n'));
    await expect(go).toBeDisabled();
    await expect(page.getByTestId('count')).toHaveText('9 players: 8 at most');
    await names.fill('Garett\n\n  Alan \ngarett');
    await expect(page.getByTestId('count')).toHaveText('3 players');
    await go.click();
    await expect(page.getByRole('alert')).toHaveText('Two players are called garett. Tell them apart.');
    await names.fill('Garett\nAlan');
    await go.click();
    await expect(page.locator('.secrets__seat')).toHaveCount(2);
    // The deal is remembered on this device, so the dashboard can be found again.
    const dashboard = page.url();
    await page.goto('/secrets');
    await page.getByRole('link', { name: 'Secret objectives' }).click();
    await expect(page).toHaveURL(dashboard);
  });

  test('a whole deal: links out, picks in, and the dashboard never holds a card', async ({ page, context }) => {
    await setUp(page);
    await expect(page.locator('.secrets__seat')).toHaveCount(6);
    await expect(page.locator('.secrets__progress')).toContainText('0 of 6 have picked');
    await expect(seat(page, 'Alan')).toContainText('Not opened');
    await expect(page.locator('.secrets__revealed')).toHaveText('Not revealed yet');
    await expectNoCards(page);

    // Alan opens his link: nothing until he asks, then two cards.
    const alan = await device(context, await linkOf(page, 'Alan'));
    await expect(alan.getByRole('heading', { level: 1 })).toHaveText('Alan, your secrets are ready');
    await expectNoCards(alan);
    await alan.getByRole('button', { name: 'Show me my two' }).click();
    await expect(alan.locator('button.secret')).toHaveCount(2);
    const [first, second] = await alan.locator('.secret__name').allInnerTexts();
    const texts = await alan.locator('.secret__text').allInnerTexts();
    expect(texts[0]).toBe(SECRET_DECK.find((c) => c.name.toUpperCase() === first.toUpperCase())!.text);
    await poll(page);
    await expect(seat(page, 'Alan')).toContainText('Choosing');
    await expectNoCards(page);

    // Nothing is kept until he confirms, and he can change his mind until then.
    const confirm = alan.getByRole('button', { name: /Choose a card|Confirm/ });
    await expect(confirm).toBeDisabled();
    await alan.locator('button.secret').nth(0).click();
    await expect(confirm).toHaveText(new RegExp(`Confirm: keep ${first}`, 'i'));
    await alan.locator('button.secret').nth(1).click();
    await expect(alan.locator('button.secret').nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(alan.locator('button.secret').nth(0)).toHaveAttribute('aria-pressed', 'false');
    await poll(page);
    await expect(seat(page, 'Alan')).toContainText('Choosing');
    await confirm.click();
    await expect(alan.getByRole('heading', { level: 1 })).toHaveText('Alan, you kept');
    await expect(alan.locator('.secret__name')).toHaveText(new RegExp(`^${second}$`, 'i'));
    await expect(alan.getByTestId('back')).toContainText(new RegExp(first, 'i'));
    // It is still his after a reload, and there is no way to choose again.
    await alan.reload();
    await expect(alan.locator('.secret__name')).toHaveText(new RegExp(`^${second}$`, 'i'));
    await expect(alan.locator('button.secret')).toHaveCount(0);

    await poll(page);
    await expect(page.locator('.secrets__progress')).toContainText('1 of 6 have picked');
    await expect(seat(page, 'Alan')).toHaveAttribute('data-state', 'picked');
    await expect(seat(page, 'Alan')).toContainText('Picked');
    await expectNoCards(page);

    // Everyone else: twelve cards dealt, no two the same.
    const dealt = [first, second];
    for (const name of SIX.filter((n) => n !== 'Alan')) {
      const p = await open(context, await linkOf(page, name));
      dealt.push(...p.cards);
      await keep(p.page, 0);
      await p.page.close();
    }
    expect(new Set(dealt.map((n) => n.toUpperCase())).size).toBe(12);
    await poll(page);
    await expect(page.locator('.secrets__progress')).toContainText('6 of 6 have picked');
    await expect(page.locator('.secrets__progress')).toHaveAttribute('data-done', 'true');
    await expectNoCards(page);
  });

  test("a link locks to the device that opened it: a second look shows nothing", async ({ page, context }) => {
    await setUp(page);
    const link = await linkOf(page, 'Cam');
    const cam = await open(context, link);

    const snoop = await device(context, link);
    await expect(snoop.getByRole('heading', { level: 1 })).toHaveText('Already opened somewhere else');
    await expectNoCards(snoop);
    // The dashboard's own browser is no different.
    await page.goto(link);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Already opened somewhere else');
    await expectNoCards(page);
    // And Cam still has his.
    await cam.page.reload();
    await expect(cam.page.locator('button.secret')).toHaveCount(2);
  });

  test('dealing again: a new link and two fresh cards, and the old link is dead', async ({ page, context }) => {
    await setUp(page);
    const oldLink = await linkOf(page, 'Devon');
    const wrongHands = await open(context, oldLink);
    await poll(page);
    await expect(seat(page, 'Devon')).toContainText('Choosing');

    await seat(page, 'Devon').getByRole('button', { name: 'Deal again…' }).click();
    await expect(seat(page, 'Devon')).toContainText('New cards and a new link for Devon?');
    await seat(page, 'Devon').getByRole('button', { name: 'Keep it' }).click();
    await expect(seat(page, 'Devon')).toContainText('Choosing');
    await seat(page, 'Devon').getByRole('button', { name: 'Deal again…' }).click();
    await seat(page, 'Devon').getByRole('button', { name: 'Deal again', exact: true }).click();
    await expect(seat(page, 'Devon')).toContainText('Not opened');
    await expect(seat(page, 'Devon')).toContainText('dealt again 1×');
    const newLink = await linkOf(page, 'Devon');
    expect(newLink).not.toBe(oldLink);
    await expectNoCards(page);

    await wrongHands.page.reload();
    await expect(wrongHands.page.getByRole('heading', { level: 1 })).toHaveText('This link was replaced');
    await expectNoCards(wrongHands.page);

    const devon = await open(context, newLink);
    for (const card of devon.cards) expect(wrongHands.cards).not.toContain(card);
  });

  test('the card puller: sees nothing until revealing, then every pick, and the dashboard says so', async ({ page, context }) => {
    await setUp(page);
    const kept: Record<string, string> = {};
    for (const name of ['Garett', 'Alan', 'Branson']) {
      const p = await open(context, await linkOf(page, name));
      kept[name] = await keep(p.page, 1);
      await p.page.close();
    }
    const link = pullerLink(api, page);

    const puller = await device(context, link);
    await expect(puller.getByRole('heading', { level: 1 })).toHaveText("Everyone's picks");
    await expect(puller.locator('.secrets__tally')).toContainText('3 of 6 have picked');
    await expect(puller.locator('.secrets__tally')).toContainText('Still to pick: Cam, Devon, Jason');
    await expectNoCards(puller);
    await poll(page);
    await expect(page.locator('.secrets__revealed')).toHaveText('Not revealed yet');

    await puller.getByRole('button', { name: 'Reveal the picks' }).click();
    await expect(puller.getByRole('heading', { level: 1 })).toHaveText('Pull these cards');
    const row = (name: string) => puller.locator('.secrets__pull').filter({ has: puller.locator('.secrets__pullwho', { hasText: new RegExp(`^${name}$`) }) });
    for (const [name, card] of Object.entries(kept)) await expect(row(name).locator('b')).toHaveText(new RegExp(`^${card}$`, 'i'));
    await expect(row('Cam')).toContainText("Hasn't opened the link yet");
    // Ticking a card off is remembered.
    await row('Alan').getByRole('checkbox').check();
    await expect(puller.locator('.secrets__tally')).toContainText('1 of 6 pulled');
    await puller.reload();
    await expect(row('Alan').getByRole('checkbox')).toBeChecked();

    // The dashboard knows it happened, and still holds no card.
    await poll(page);
    await expect(page.locator('.secrets__revealed')).toContainText('Revealed');
    await expectNoCards(page);

    // A pick made afterwards turns up on the puller's list.
    const cam = await open(context, await linkOf(page, 'Cam'));
    kept.Cam = await keep(cam.page, 0);
    await puller.clock.fastForward(8500);
    await expect(row('Cam').locator('b')).toHaveText(new RegExp(`^${kept.Cam}$`, 'i'));

    // Anyone else with the puller's link, the dashboard included, is told it has been used and shown nothing.
    await page.getByRole('link', { name: 'Hand this device to the puller' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Already revealed somewhere else');
    await expectNoCards(page);
  });

  test('a link the site does not know, and the site out of reach', async ({ page }) => {
    await page.goto('/secrets/abcd2345-notarealtokenatall99');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No such link');
    api.online = false;
    await page.goto('/secrets/abcd2345-notarealtokenatall99');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Can't reach the site");
    api.online = true;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No such link');
  });

  test("a phone-sized screen holds a player's two cards without scrolling sideways", async ({ page, context }) => {
    await setUp(page);
    const p = await open(context, await linkOf(page, 'Jason'));
    await p.page.setViewportSize({ width: 375, height: 740 });
    expect(await p.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(p.page.getByRole('button', { name: 'Choose a card' })).toBeVisible();
  });
});
