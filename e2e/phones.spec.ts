import type { BrowserContext, Page } from '@playwright/test';
import { FakeApi } from './api';
import { Board, HOLD_MS, Table, expect, liveGame, liveSlot, openSettings, readStorage, setSlider, setUpGame, test } from './helpers';
import { FANFARE_MS, pickCards } from './flows';
import { gameCode, openPhone, tick, tinyWav } from './phones';

/**
 * Phones as buttons, and the game's copy on the site. The laptop tab and the phone tabs run the real app against
 * a stand-in for the site (FakeApi): the host writes the game, phones read it and post presses into the inbox.
 */

const NAMES = ['Ana', 'Ben', 'Cleo'];
const SIX = [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]] as [string, number][];

async function hostWithSite(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext, names = NAMES) {
  const api = new FakeApi();
  await api.install(context);
  await setUpGame(page, { names });
  const code = await gameCode(page);
  await page.clock.fastForward(300);
  await expect.poll(() => api.games.has(code), 'the game is on the site as soon as it begins').toBe(true);
  return { api, code, table: new Table(page) };
}

test('typing a code: only letters that can be read aloud, four of them', async ({ page }) => {
  await page.goto('/join');
  const input = page.getByLabel('Game code');
  const join = page.getByRole('button', { name: 'Join the table' });
  await expect(join).toBeDisabled();
  await input.pressSequentially('a0o1b');
  await expect(input, '0, O, 1, I and L are never in a code').toHaveValue('AB');
  await input.pressSequentially('-c d e');
  await expect(input).toHaveValue('ABCD');
  await join.click();
  await expect(page).toHaveURL(/\/join\/ABCD$/);
  await expect(page.locator('.join__help')).toContainText('Game ABCD');
});

test('a code nobody is using says so', async ({ page, context }) => {
  await new FakeApi().install(context);
  await page.goto('/join/ZZZZ');
  await expect(page.getByRole('heading', { name: 'No game with that code' })).toBeVisible();
});

test('the whole phone flow: who you are, your seat, your light, your presses', async ({ page, context }) => {
  test.setTimeout(120_000);
  const { api, code, table } = await hostWithSite(page, context);
  const phone = await openPhone(context, code);
  const both = [page, phone.page];

  await expect(phone.page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
  await expect(phone.page.locator('.who-list__item'), 'the people at this table first').toHaveText(['Ana', 'Ben', 'Cleo']);
  await phone.iAm('Ben');
  await tick(both);
  await expect(phone.link).toHaveText('Connected');
  await expect(phone.who).toHaveText('Ben');
  await phone.expectLight('solid');
  await expect(phone.why).toHaveText('Seat claimed');
  await expect(page.locator('.topbar')).toContainText(`${code} · 1`);
  await expect(table.log).toContainText('Ben joins on their own device.');
  const dev = (await phone.page.evaluate(() => sessionStorage.getItem('pb.phone.dev')))!;
  expect(api.state(code).devices[dev]).toEqual(expect.any(String));

  // Ben's seat took the first place at the on-screen table; the two breathing buttons left are keys 2 and 3.
  await expect(page.locator('.seat--open')).toHaveCount(2);
  await table.tapKey('2');
  await expect(table.center.locator('.center__active'), 'Ben is skipped: he already has a button').toHaveText('Cleo');
  await table.tapKey('3');
  await pickCards(table, SIX);
  await table.expectActive('Ana');
  await tick(both);
  await phone.expectLight('dim');
  await table.hold('Ana');
  await tick(both);
  await phone.expectLight('pulse');
  await expect(phone.why).toHaveText('Your turn — hold to end it');

  // A tap is a nudge, a short hold nothing, a real hold ends the turn: all through the inbox.
  await phone.tap();
  await tick(both);
  await table.expectToast('Ben: Hold to end your turn');
  await phone.hold(HOLD_MS - 200);
  await tick(both);
  await table.expectActive('Ben');
  await phone.hold();
  await tick(both);
  await table.expectActive('Cleo');
  await phone.expectLight('dim');

  // Cleo plays a card; Ben's phone blinks in the card's colour until he taps.
  await table.doubleTap('Cleo');
  await table.center.getByRole('button', { name: '3 Politics' }).click();
  await table.primaryDone('Cleo');
  await tick(both);
  await phone.expectLight('flash');
  await expect(phone.why).toHaveText('Politics played — tap when done');
  await phone.tap();
  await tick(both);
  await expect(table.center.locator('.ackpip', { hasText: 'Ben' })).toHaveAttribute('data-done', 'true');
  await phone.expectLight('dim');

  // Nothing about the laptop's secret reaches the phone side.
  const phoneReads = api.requests.filter((r) => r.method === 'GET' && r.url.includes('/api/game?code'));
  expect(phoneReads.length).toBeGreaterThan(3);
  expect(phoneReads.every((r) => !r.url.includes('key='))).toBe(true);
});

test('skipping the question: claim a seat by pressing, and the phone learns who it is', async ({ page, context }) => {
  const { code, table } = await hostWithSite(page, context);
  const phone = await openPhone(context, code);
  await phone.page.getByRole('button', { name: 'Skip: just be a button' }).click();
  await tick([page, phone.page]);
  await expect(phone.who).toHaveText('Unclaimed');
  await phone.expectLight('pulse');
  await expect(phone.why).toHaveText("Now calling Ana. If that's you, press.");
  await phone.tap();
  await tick([page, phone.page]);
  await expect(phone.who).toHaveText('Ana');
  await expect(phone.page.getByRole('button', { name: 'Ana · profile' })).toBeVisible();
  await expect(table.center.locator('.center__active')).toHaveText('Ben');
  expect((await liveGame(page)).bindings[0]).toMatch(/^web-/);
});

test('two phones, two players: each sees only their own light', async ({ page, context }) => {
  const { code, table } = await hostWithSite(page, context);
  const ana = await openPhone(context, code);
  await ana.iAm('Ana');
  const ben = await openPhone(context, code);
  await ben.iAm('Ben');
  const all = [page, ana.page, ben.page];
  await tick(all);
  await expect(page.locator('.topbar')).toContainText(`${code} · 2`);
  await table.tapKey('3');
  await pickCards(table, SIX);
  await tick(all);
  await ana.expectLight('pulse');
  await ben.expectLight('dim');
  // Only Ana's hold would count, so Ben's button says so while it is held.
  await expect(ana.light).not.toHaveAttribute('data-refused');
  await expect(ben.light).toHaveAttribute('data-refused', 'true');
  // Waiting is as bright, next to "your move", as the host has set it for the real buttons, down to the screen's floor.
  const lum = () => ben.light.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--lum')));
  expect(await lum()).toBeCloseTo(0.12, 3);
  await setSlider((await openSettings(page)).getByRole('slider', { name: /Waiting/ }), 0.3);
  await page.keyboard.press('Escape');
  await tick(all);
  await expect.poll(lum).toBeCloseTo(0.5, 3);
  await ana.hold();
  await tick(all);
  await ana.expectLight('dim');
  await ben.expectLight('pulse');
  await table.expectActive('Ben');
});

test('the cog on the phone: how your own light shows "your move", saved with your profile and mirrored on the big screen', async ({ page, context }) => {
  const { api, code, table } = await hostWithSite(page, context);
  const phone = await openPhone(context, code);
  await phone.iAm('Ana');
  await tick([page, phone.page]);
  await table.tapKey('2');
  await table.tapKey('3');
  await pickCards(table, SIX);
  await tick([page, phone.page]);
  await phone.expectLight('pulse');
  await expect(phone.light, "the table's default: breathe, then steady").toHaveAttribute('data-look', 'settle');

  await phone.page.getByRole('button', { name: 'Your light' }).click();
  const sheet = phone.page.getByRole('dialog', { name: 'Your light' });
  await sheet.getByRole('radio', { name: 'Breathe', exact: true }).click();
  await expect(phone.light).not.toHaveAttribute('data-look');
  await sheet.getByRole('radio', { name: 'Heartbeat' }).click();
  await expect(phone.light).toHaveAttribute('data-look', 'heartbeat');
  await setSlider(sheet.locator('input[type=range]'), 0.5);
  await tick([page, phone.page], 6);
  await expect(table.light('Ana'), 'her own choice wins on the big screen too').toHaveAttribute('data-look', 'heartbeat');
  expect(api.named('Ana')).toMatchObject({ light: 'heartbeat', brightness: 0.5 });
  // Back to the table's choice.
  await sheet.getByRole('radio', { name: "Table's" }).first().click();
  await expect(phone.light).toHaveAttribute('data-look', 'settle');

  // The start of her turn is hers to choose too. Picking one plays it on her phone at once…
  const starts = sheet.getByRole('radiogroup', { name: 'When your turn starts' });
  await expect(starts.getByRole('radio', { name: "Table's" })).toHaveAttribute('aria-checked', 'true');
  await starts.getByRole('radio', { name: 'Sparkles' }).click();
  await expect(phone.light).toHaveAttribute('data-react', 'sparkle');
  await expect(sheet, 'the sheet steps aside so she can see it').toHaveAttribute('data-peek');
  // …and on her seat on the big screen, a moment later, once the host has read the inbox.
  await tick([page, phone.page], 1);
  await expect(table.light('Ana')).toHaveAttribute('data-react', 'sparkle');
  await tick([page, phone.page], 3);
  expect(api.named('Ana')).toMatchObject({ turnFx: 'sparkle' });
  await expect(phone.light).not.toHaveAttribute('data-react');
  await expect(sheet).not.toHaveAttribute('data-peek');
  // Preview plays the current choice again.
  await sheet.getByRole('button', { name: 'Preview' }).click();
  await expect(phone.light).toHaveAttribute('data-react', 'sparkle');
  await tick([page, phone.page], 3);
  await starts.getByRole('radio', { name: 'Rainbow' }).click();
  await expect(phone.light).toHaveAttribute('data-react', 'rainbow');
  await tick([page, phone.page], 3);
  expect(api.named('Ana')).toMatchObject({ turnFx: 'rainbow' });
  await starts.getByRole('radio', { name: "Table's" }).click();
  await tick([page, phone.page], 3);
  expect(api.named('Ana')?.turnFx).toBeUndefined();
});

test('someone new adds themselves from their phone; they are saved, but not seated', async ({ page, context }) => {
  const { api, code } = await hostWithSite(page, context);
  const phone = await openPhone(context, code);
  await phone.page.getByLabel('Your name').fill('Dana');
  await phone.page.getByRole('button', { name: "That's me" }).click();
  await tick([page, phone.page]);
  await expect(phone.page.getByRole('button', { name: 'Dana · profile' })).toBeVisible();
  await expect(phone.why).toHaveText("Now calling Ana. If that's you, press.");
  await expect.poll(() => api.named('Dana')).toBeTruthy();
  await expect.poll(async () => (await readStorage<{ name: string }[]>(page, 'pb.profiles.v1'))!.map((p) => p.name), 'the laptop learns about her').toContain('Dana');

  // "Not Dana? Switch player" asks again, and she is on the list now.
  await phone.page.getByRole('button', { name: 'Dana · profile' }).click();
  await phone.page.getByRole('button', { name: /Not Dana\? Switch player/ }).click();
  await expect(phone.page.locator('.who-list__item')).toHaveText(['Ana', 'Ben', 'Cleo', 'Dana']);
});

test('changing your name and sounds from your phone changes the game on the big screen', async ({ page, context }) => {
  const { api, code, table } = await hostWithSite(page, context);
  const phone = await openPhone(context, code);
  await phone.iAm('Cleo');
  await tick([page, phone.page]);
  await phone.page.getByRole('button', { name: 'Cleo · profile' }).click();
  const sheet = phone.page.getByRole('dialog', { name: 'Your profile' });

  await sheet.getByRole('textbox').first().fill('Cleopatra');
  await sheet.getByRole('textbox').first().blur();
  await sheet.locator('select').first().selectOption({ label: 'Silent' });
  await sheet.getByRole('radio', { name: 'Pink' }).click();
  await tick([page, phone.page], 6);
  await expect(table.seat('Cleopatra').locator('.plate__name')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Not Cleopatra\?/ })).toBeVisible();
  expect((await liveGame(page)).players[2]).toMatchObject({ name: 'Cleopatra', intro: { kind: 'none' } });
  expect(api.named('Cleopatra')!.color).toBe('pink');

  // A clip goes to the site from the phone; the laptop fetches it when it needs to play it.
  await sheet.locator('input[type=file]').first().setInputFiles({ name: 'airhorn.wav', mimeType: 'audio/wav', buffer: tinyWav() });
  await expect(sheet.locator('select').first().locator('option:checked')).toHaveText('♪ airhorn');
  await expect.poll(() => api.clips.size).toBe(1);
  await tick([page, phone.page], 6);
  const [clipId] = [...api.clips.keys()];
  expect((await liveGame(page)).players[2].intro).toEqual({ kind: 'clip', id: clipId, name: 'airhorn' });

  // Not audio: refused on the phone, nothing sent.
  await sheet.locator('input[type=file]').nth(1).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(sheet.locator('.soundpick__error')).toHaveText('That is not an audio file.');
  expect(api.clips.size).toBe(1);
});

test('"The table" on a phone is the scoreboard, live and read-only', async ({ page, context }) => {
  const { code } = await hostWithSite(page, context);
  const board = new Board(page);
  await page.getByRole('button', { name: /Skip/ }).click();
  const phone = await openPhone(context, code);
  await phone.page.getByRole('button', { name: 'Skip: just be a button' }).click();
  await phone.page.getByRole('button', { name: 'The table' }).click();
  const view = phone.page.locator('.board');
  await expect(view.locator('.stand__name')).toHaveText(NAMES);
  await expect(view).not.toHaveAttribute('data-edit', 'true');
  await expect(view.getByRole('button')).toHaveCount(0);

  await board.open();
  await board.reveal(1, 'Expand Borders');
  await board.score('Expand Borders', 'Ben');
  await board.addLaw('Fleet Regulations');
  await tick([page, phone.page], 4);
  await expect(view.locator('.obj', { hasText: 'Expand Borders' }).locator('.who-chip[aria-pressed="true"]')).toHaveText('Ben');
  await expect(view.locator('.stand', { hasText: 'Ben' }).locator('.stand__vp')).toHaveText('1');
  await expect(view.locator('.law')).toContainText('Fleet Regulations');
});

test('the laptop reloads: same code, the phone never notices', async ({ page, context }) => {
  const { code, table } = await hostWithSite(page, context);
  const phone = await openPhone(context, code);
  await phone.iAm('Ana');
  await tick([page, phone.page]);
  await phone.expectLight('solid');
  await page.reload();
  await expect(page.locator('.topbar')).toContainText(code);
  await tick([page, phone.page]);
  await expect(phone.link).toHaveText('Connected');
  await expect(phone.who).toHaveText('Ana');
  await expect(page.locator('.topbar')).toContainText(`${code} · 1`);
  await expect(table.center.locator('.center__active')).toHaveText('Ben');
});

/** Ana on her phone, Ben and Cleo on the table's buttons, the action phase begun and Ana to act. */
async function anaToActOnHerPhone(page: Page, context: BrowserContext) {
  const site = await hostWithSite(page, context);
  const phone = await openPhone(context, site.code);
  await phone.iAm('Ana');
  await tick([page, phone.page]);
  await site.table.tapKey('2');
  await site.table.tapKey('3');
  await pickCards(site.table, SIX);
  await site.table.expectActive('Ana');
  await tick([page, phone.page]);
  await phone.expectLight('pulse');
  return { ...site, phone, dev: await phone.dev(), both: [page, phone.page] };
}

/** Every press the laptop has taken from a device, in order. */
async function pressesFrom(page: Page, dev: string): Promise<string[]> {
  const { events } = (await liveSlot(page)) as { events: { action: { type: string; dev?: string; input?: string } }[] };
  return events.filter((e) => e.action.type === 'DEVICE_INPUT' && e.action.dev === dev).map((e) => e.action.input!);
}

test('the laptop reloads mid-game: presses it already took are not taken again', async ({ page, context }) => {
  const { code, table, phone, dev, both } = await anaToActOnHerPhone(page, context);
  await phone.tap();
  await tick(both);
  await table.expectToast('Ana: Hold to end your turn');
  await phone.hold();
  await tick(both);
  await table.expectActive('Ben');
  await table.hold('Ben');
  await table.hold('Cleo');
  await table.expectActive('Ana');
  await tick(both);

  await page.reload();
  await expect(page.locator('.topbar')).toContainText(code);
  await tick(both);
  await table.expectActive('Ana'); // her hold from last time, taken again, would end this turn
  expect(await pressesFrom(page, dev)).toEqual(['tap', 'hold']);
  await expect(page.locator('.topbar'), 'the phone is still counted').toContainText(`${code} · 1`);
});

test('a press made while the laptop is away counts when it is back, once', async ({ page, context }) => {
  const { table, phone, dev, both } = await anaToActOnHerPhone(page, context);
  await phone.tap();
  await tick(both);
  await table.expectToast('Ana: Hold to end your turn');

  // The laptop reloads, and Ana holds while it is gone.
  await page.goto('about:blank');
  await phone.hold();
  await tick([phone.page]);
  await page.goto('/play');
  await tick(both);
  await table.expectActive('Ben');
  await phone.expectLight('dim');
  expect(await pressesFrom(page, dev)).toEqual(['tap', 'hold']);

  // Off to the home page and back: nothing is taken twice that way either.
  await page.getByTitle('Back to the home page').click();
  await page.getByRole('link', { name: 'Resume your game' }).click();
  await tick(both);
  await table.expectActive('Ben');
  expect(await pressesFrom(page, dev)).toEqual(['tap', 'hold']);
});

test('a slow site: one read of the inbox at a time, and nothing taken twice', async ({ page, context }) => {
  const { api, table, phone, dev, both } = await anaToActOnHerPhone(page, context);
  api.inboxDelayMs = 250;
  api.inboxMostAtOnce = 0;
  await phone.hold();
  await tick(both, 6);
  await table.expectActive('Ben');
  await tick(both, 3);
  expect(await pressesFrom(page, dev)).toEqual(['hold']);
  expect(api.inboxMostAtOnce, 'the laptop waits for one answer before asking again').toBe(1);
});

test('a press that sat in the inbox for a minute (the laptop was offline) is let go', async ({ page, context }) => {
  const { api, code, table, dev, both } = await anaToActOnHerPhone(page, context);
  api.post(code, { dev, type: 'input', input: 'hold' }, 60_000);
  await tick(both);
  await table.expectActive('Ana');
  api.post(code, { dev, type: 'input', input: 'hold' }, 5_000);
  await tick(both);
  await table.expectActive('Ben');
  expect(await pressesFrom(page, dev)).toEqual(['hold']);
});

test('a phone that stops checking in is no longer counted; one that comes back keeps its seat', async ({ page, context }) => {
  const { code, table } = await hostWithSite(page, context);
  const phone = await openPhone(context, code);
  await phone.iAm('Ana');
  await tick([page, phone.page]);
  await expect(page.locator('.topbar')).toContainText(`${code} · 1`);
  const identity = await phone.identity();
  await phone.page.close();
  await page.clock.fastForward(50_000);
  await expect(page.locator('.topbar')).toContainText(`${code} · 0`);

  const again = await openPhone(context, code, { identity });
  await tick([page, again.page]);
  await expect(again.who, 'the game remembers the device').toHaveText('Ana');
  await expect(table.center.locator('.center__active')).toHaveText('Ben');
});

test('ending the game retires its code; the next game has a new one and asks again', async ({ page, context }) => {
  const { api, code, table } = await hostWithSite(page, context);
  const phone = await openPhone(context, code);
  await phone.iAm('Ana');
  await tick([page, phone.page]);
  await phone.expectLight('solid');

  await page.getByTitle('Settings', { exact: true }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'End this game…' }).click();
  await expect(page.getByRole('heading', { name: "Who's at the table?" })).toBeVisible();
  await expect.poll(() => api.games.has(code)).toBe(false);
  await tick([page, phone.page]);
  await expect(phone.page.getByRole('heading', { name: 'No game with that code' })).toBeVisible();

  await setUpGame(page, { names: ['Dev', 'Eli', 'Fay'] });
  const next = await gameCode(page);
  expect(next).not.toBe(code);
  await page.clock.fastForward(300);
  await phone.page.goto(`/join/${next}`);
  await expect(phone.page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
  await expect(phone.page.locator('.who-list__item'), 'this table first, then everyone else').toHaveText(['Ana', 'Dev', 'Eli', 'Fay', 'Ben', 'Cleo']);
  await phone.iAm('Eli');
  await tick([page, phone.page]);
  await expect(phone.who).toHaveText('Eli');
  await expect(table.center.locator('.center__active')).toHaveText('Dev');
});

test.describe('the game on the site', () => {
  test('every change is saved a beat later, and the panel says so', async ({ page, context }) => {
    const { api, code } = await hostWithSite(page, context);
    expect(api.state(code).seating).not.toBeNull();
    await page.getByRole('button', { name: /Skip/ }).click();
    await page.clock.fastForward(300);
    await expect.poll(() => api.state(code).seating).toBeNull();
    await page.getByRole('button', { name: `${code} · 0` }).click();
    await expect(page.locator('.room__site')).toHaveText('Saved to the site');
    await expect(page.locator('.room__code')).toHaveText(code);
    await expect(page.locator('.room__qr')).toBeVisible();
  });

  test('with the site unreachable the game plays on, and says so', async ({ page }) => {
    await setUpGame(page, { names: NAMES });
    const code = await gameCode(page);
    await page.clock.fastForward(300);
    await page.getByRole('button', { name: `${code} · 0` }).click();
    await expect(page.locator('.room__site')).toContainText('Not reaching the site');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Skip/ }).click();
    await new Table(page).expectPhase('Strategy');
  });

  test('a browser that lost its data is offered the game back', async ({ page, context }) => {
    const { api, code, table } = await hostWithSite(page, context);
    await page.getByRole('button', { name: /Skip/ }).click();
    await pickCards(table, SIX);
    await page.clock.fastForward(300);
    await expect.poll(() => api.state(code).phase).toBe('action');

    // Everything but the host key goes (the key is what makes it "this browser").
    await page.evaluate(() => {
      const key = localStorage.getItem('pb.room.key.v1');
      localStorage.clear();
      localStorage.setItem('pb.room.key.v1', key!);
    });
    await page.goto('/play');
    const offer = page.locator('.setup__saved');
    await expect(offer).toContainText(`A game is saved on the site: ${code} · Ana, Ben, Cleo · round 1`);
    await offer.getByRole('button', { name: 'Resume it' }).click();
    await table.expectActive('Ana');
    await expect(table.seat('Ana').locator('.cardpip')).toHaveText(['1', '4']);
    await expect(page.locator('.topbar')).toContainText(code);
  });

  test('another laptop picks the game up by its code, phones and all; the old laptop is locked out', async ({ page, context, browser }) => {
    const { api, code, table } = await hostWithSite(page, context);
    await page.getByRole('button', { name: /Skip/ }).click();
    const phone = await openPhone(context, code);
    await phone.iAm('Ben');
    await tick([page, phone.page]);
    await expect(phone.who).toHaveText('Ben');

    // The other laptop: a fresh browser, nothing in it.
    const other = await browser.newContext({ baseURL: page.url().replace(/\/play$/, '') });
    await other.clock.install();
    await api.install(other);
    const laptop = await other.newPage();
    await laptop.goto('/play');
    await laptop.locator('.setup__pickup input').fill(code);
    await laptop.getByRole('button', { name: 'Pick up' }).click();
    const there = new Table(laptop);
    await expect(there.center.locator('.center__title')).toHaveText('Ana is choosing');
    await expect(laptop.locator('.topbar')).toContainText(code);
    await expect(there.roster('Ben')).toBeVisible();
    // Ben's phone is still Ben's, and its presses now reach the new laptop.
    await tick([laptop, phone.page]);
    await expect(laptop.locator('.topbar')).toContainText(`${code} · 1`);
    await expect(phone.who).toHaveText('Ben');
    // What was in the inbox, the old laptop already took: the new one takes none of it again.
    const dev = await phone.dev();
    const { events } = (await liveSlot(laptop)) as { events: { action: { type: string; dev?: string } }[] };
    expect(events.filter((e) => e.action.dev === dev).map((e) => e.action.type), 'Ben said who he is once').toEqual(['IDENTIFY']);

    // The old laptop can no longer save: the game belongs to the new one.
    await page.getByRole('button', { name: 'Give Ana a point' }).click();
    await page.clock.fastForward(1000);
    await page.getByTitle('Settings', { exact: true }).click();
    await expect(page.locator('.settings__save')).toHaveText('Picked up on another laptop: this copy no longer saves');
    expect(api.state(code).players[0].vp).toBe(0);
    await table.expectVp('Ana', 1); // locally it still plays, it just doesn't count on the site
    await other.close();
  });
});

test('a phone celebrates the end of the round with everyone, then waits for its turn to score', async ({ page, context }) => {
  const { code, table } = await hostWithSite(page, context);
  const phone = await openPhone(context, code);
  const both = [page, phone.page];
  await phone.iAm('Ben');
  await tick(both);
  await table.tapKey('2');
  await table.tapKey('3');
  await pickCards(table, SIX);
  await table.expectActive('Ana');

  await page.getByRole('button', { name: 'Referee', exact: true }).click();
  await page.getByRole('dialog', { name: 'Referee' }).getByRole('button', { name: 'Jump to the status phase' }).click();
  await page.keyboard.press('Escape');
  await tick(both);
  await phone.expectLight('rainbow');
  await expect(phone.why).toHaveText('The round is over!');
  // The host keeps time; the phone follows the record.
  await page.clock.fastForward(FANFARE_MS + 100);
  await tick(both);
  await phone.expectLight('off');
  await expect(phone.why).toHaveText('Waiting to score');
  await expect(table.center.locator('.center__active')).toHaveText('Ana');
  await table.tap('Ana');
  await tick(both);
  await phone.expectLight('pulse');
  await expect(phone.why).toHaveText('Your turn to score — tap when done');
  await phone.tap();
  await tick(both);
  await expect(table.center.locator('.center__active')).toHaveText('Cleo');
  await phone.expectLight('off');
  await expect(phone.why).toHaveText('Scored');
  await expect(table.log).toContainText('Ben is done scoring.');
});
