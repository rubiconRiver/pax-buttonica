import { Table, expect, openSettings, setSlider, setUpGame, test } from './helpers';
import { pickCards } from './flows';
import { feed, feedRaw, hello, installFakeHub, lastLed, press, sent, unplug } from './hub';

/**
 * Real buttons, minus the buttons. These tests speak the wire protocol in docs/BUTTON_STANDARD.md to the app's real
 * Web Serial code, so a change that would confuse the firmware shows up here long before it shows up at the table.
 */

const A = 'a1:b2:c3:00:00:01';
const B = 'a1:b2:c3:00:00:02';
const C = 'a1:b2:c3:00:00:03';
const RED = 'ff3b3b';
const ORANGE = 'ff8a1f';
const YELLOW = 'ffd21f';

async function startWithHub(page: import('@playwright/test').Page) {
  await installFakeHub(page);
  await setUpGame(page, { names: ['Ana', 'Ben', 'Cleo'] });
  await page.getByRole('button', { name: 'Hub', exact: true }).click();
  await feed(page, { t: 'hub', v: 0, fw: '0.1.0' }, hello(A), hello(B), hello(C, { btn: 3, led: 'ring', audio: 'none' }));
  await expect(page.getByRole('button', { name: 'Hub · 3' })).toBeVisible();
  return new Table(page);
}

test('connecting asks the hub to announce itself and configures every button that says hello', async ({ page }) => {
  await startWithHub(page);
  const out = await sent(page);
  expect(out[0]).toEqual({ t: 'hub?' });
  // Settings for the table, and how to draw "your move" (solid, unless the host or the player says otherwise) at full brightness.
  for (const dev of [A, B, C]) expect(out).toContainEqual({ t: 'cfg', dev, hold: 2000, flash: 2000, bright: 100, pulse: 'solid' });
  // A later hello may be a heartbeat, or the same button back from a battery swap with its memory wiped.
  // Either way it is told its settings and its light again.
  const leds = (await sent(page)).filter((m) => m.t === 'led' && m.dev === A).length;
  await feed(page, hello(A));
  await expect.poll(async () => (await sent(page)).filter((m) => m.t === 'cfg' && m.dev === A).length).toBe(2);
  await expect.poll(async () => (await sent(page)).filter((m) => m.t === 'led' && m.dev === A).length).toBe(leds + 1);
});

test('seat claiming with real buttons: white breathing, then your colour', async ({ page }) => {
  const table = await startWithHub(page);
  for (const dev of [A, B, C]) {
    await expect.poll(() => lastLed(page, dev), 'a button is told its light as soon as it says hello').toBeTruthy();
    const led = await lastLed(page, dev);
    expect(led).toMatchObject({ c: 'ffffff', m: 'pulse' });
    expect(led!.p, 'breathing lights carry their phase so every button breathes together').toBeGreaterThanOrEqual(0);
    expect(led!.p).toBeLessThan(1700);
  }

  // Ana is called first, and presses the button that happens to be B.
  await feed(page, press(B, 'tap'));
  await expect(table.center.locator('.center__active')).toHaveText('Ben');
  expect(await lastLed(page, B)).toEqual({ t: 'led', dev: B, c: RED, m: 'solid' });
  expect(await lastLed(page, A)).toMatchObject({ c: 'ffffff', m: 'pulse' });
  expect(await sent(page)).toContainEqual({ t: 'fx', dev: B, k: 'ack' });

  // Pressing B again claims nothing.
  await feed(page, press(B, 'tap'));
  await expect(table.center.locator('.center__active')).toHaveText('Ben');

  // Ben uses an on-screen button (his real one has flat batteries); Cleo takes C.
  await table.tapKey('2');
  await feed(page, press(C, 'hold'));
  await table.expectPhase('Strategy');

  // Ana chooses first: her button breathes red, Cleo's is dark, and the spare button A is dark too.
  expect(await lastLed(page, B)).toMatchObject({ c: RED, m: 'pulse' });
  expect(await lastLed(page, C)).toMatchObject({ c: YELLOW, m: 'off' });
  expect(await lastLed(page, A)).toMatchObject({ c: '000000', m: 'off' });
  void ORANGE;
});

test('a turn played entirely on real buttons', async ({ page }) => {
  const table = await startWithHub(page);
  await feed(page, press(A, 'tap'));
  await feed(page, press(B, 'tap'));
  await feed(page, press(C, 'tap'));
  await pickCards(table, [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]]);
  await table.expectActive('Ana');
  expect(await lastLed(page, A)).toMatchObject({ c: RED, m: 'pulse' });
  expect(await lastLed(page, B)).toMatchObject({ c: ORANGE, m: 'dim' });

  // Two cards in hand: the double-tap asks which, on the big screen.
  await feed(page, press(A, 'double'));
  await table.center.getByRole('button', { name: '1 Leadership' }).click();
  expect(await lastLed(page, A)).toMatchObject({ c: 'e5484d', m: 'flash' });
  expect((await lastLed(page, A))!.p).toBeLessThan(2000);

  // Locked in: the button is told to shake its head.
  await feed(page, press(A, 'hold'));
  await table.expectToast(/finish the primary first/);
  expect((await sent(page)).filter((m) => m.t === 'fx' && m.dev === A && m.k === 'denied')).toHaveLength(1);

  await page.clock.fastForward(700);
  await feed(page, press(A, 'tap'));
  expect(await lastLed(page, B)).toMatchObject({ c: 'e5484d', m: 'flash' });
  expect(await lastLed(page, A)).toMatchObject({ c: 'e5484d', m: 'solid' });
  await feed(page, press(B, 'tap'));
  expect(await lastLed(page, B)).toMatchObject({ c: ORANGE, m: 'dim' });
  await feed(page, press(C, 'tap'));
  expect(await lastLed(page, A)).toMatchObject({ c: RED, m: 'pulse' });
  await feed(page, press(A, 'hold'));
  await table.expectActive('Ben');

  // Cleo's device has the two extra buttons. Button 2 is "pass": refused, she still holds cards.
  await feed(page, press(B, 'hold'));
  await table.expectActive('Cleo');
  await feed(page, press(C, 'tap', 2));
  await table.expectToast("Cleo: can't pass with an unplayed strategy card");
  // Button 1 is "play my strategy card". A double-tap or hold on an extra button means nothing.
  await feed(page, press(C, 'hold', 1));
  await expect(table.center.locator('.center__title')).toHaveCount(0);
  await feed(page, press(C, 'tap', 1));
  await expect(table.center.locator('.center__title')).toHaveText('Cleo is playing…');
  // A button index the standard has no job for is ignored.
  await feed(page, press(C, 'tap', 7));
  await expect(table.center.locator('.center__title')).toHaveText('Cleo is playing…');
});

test('the start of a turn reaches a real button as its player\'s effect', async ({ page }) => {
  const table = await startWithHub(page);
  for (const dev of [A, B, C]) await feed(page, press(dev, 'tap'));
  await pickCards(table, [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]]);
  await table.expectActive('Ana');
  // Only the turn effects, not the acks every button got for claiming its seat.
  const effects = async (dev: string) => (await sent(page)).filter((m) => m.t === 'fx' && m.dev === dev && m.k !== 'ack' && m.k !== 'denied');
  // The table's default is the ring, which every button draws as its burst.
  expect(await effects(A)).toEqual([{ t: 'fx', dev: A, k: 'burst' }]);
  expect(await effects(B)).toEqual([]);

  const panel = await openSettings(page);
  await panel.getByRole('radio', { name: 'Sparkles' }).click();
  await page.keyboard.press('Escape');
  await feed(page, press(A, 'hold'));
  await table.expectActive('Ben');
  expect(await effects(B)).toEqual([{ t: 'fx', dev: B, k: 'sparkle' }]);

  await (await openSettings(page)).getByRole('radio', { name: 'None' }).click();
  await page.keyboard.press('Escape');
  await feed(page, press(B, 'hold'));
  await table.expectActive('Cleo');
  expect(await effects(C)).toEqual([]);
});

test('only changes go down the wire', async ({ page }) => {
  const table = await startWithHub(page);
  for (const dev of [A, B, C]) await feed(page, press(dev, 'tap'));
  await table.expectPhase('Strategy');
  const count = async () => (await sent(page)).filter((m) => m.t === 'led').length;
  const before = await count();
  // A nudge changes the screen (a toast) but no light.
  await feed(page, press(A, 'tap'));
  await table.expectToast('Pick a card on the big screen');
  expect(await count()).toBe(before);
});

test('settings reach the buttons live', async ({ page }) => {
  await startWithHub(page);
  const panel = await openSettings(page);
  await setSlider(panel.locator('input[type=range]').first(), 1500);
  await setSlider(panel.locator('input[type=range]').nth(1), 3000);
  for (const dev of [A, B, C]) expect(await sent(page)).toContainEqual({ t: 'cfg', dev, hold: 1500, flash: 3000, bright: 100, pulse: 'solid' });
});

test('the look of "your move" and the brightness are configuration, not a different light', async ({ page }) => {
  const table = await startWithHub(page);
  for (const dev of [A, B, C]) await feed(page, press(dev, 'tap'));
  await table.expectPhase('Strategy');
  // The wire still says pulse: the button decides what that looks like from its cfg.
  expect(await lastLed(page, A)).toMatchObject({ c: RED, m: 'pulse' });
  const panel = await openSettings(page);
  await panel.getByRole('radio', { name: 'Breathe' }).click();
  await panel.getByRole('radio', { name: 'Heartbeat' }).click();
  await setSlider(panel.locator('input[type=range]').nth(2), 0.5);
  const cfgs = (await sent(page)).filter((m) => m.t === 'cfg' && m.dev === A);
  expect(cfgs.at(-1)).toEqual({ t: 'cfg', dev: A, hold: 2000, flash: 2000, bright: 50, pulse: 'heartbeat' });
  expect(cfgs.some((m) => m.pulse === 'pulse')).toBe(true);
  // No new light was sent for it: the colour and meaning didn't change.
  expect(await lastLed(page, A)).toMatchObject({ c: RED, m: 'pulse' });
  // The screen's button follows the same choice.
  await expect(table.light('Ana')).toHaveAttribute('data-look', 'heartbeat');
});

test('a button that drops off is left alone, and caught up when it returns', async ({ page }) => {
  const table = await startWithHub(page);
  for (const dev of [A, B, C]) await feed(page, press(dev, 'tap'));
  await table.expectPhase('Strategy');
  await feed(page, { t: 'lost', dev: C });
  const before = (await sent(page)).filter((m) => m.dev === C).length;
  await pickCards(table, [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]]);
  expect((await sent(page)).filter((m) => m.dev === C).length, 'nothing is sent to a button that is not answering').toBe(before);
  // It comes back (new batteries): the first thing it hears is what it should look like now.
  await feed(page, hello(C, { btn: 3, led: 'ring', audio: 'none' }));
  await expect.poll(() => lastLed(page, C)).toMatchObject({ c: YELLOW, m: 'dim' });
});

test('low batteries are called out by player name', async ({ page }) => {
  const table = await startWithHub(page);
  for (const dev of [A, B, C]) await feed(page, press(dev, 'tap'));
  await table.expectPhase('Strategy');
  await feed(page, { t: 'bat', dev: A, mv: 5100 }, { t: 'bat', dev: B, mv: 4350 });
  await expect(page.locator('.chip', { hasText: 'Low battery' })).toHaveText('Low battery: Ben');
  await feed(page, { t: 'bat', dev: B, mv: 5000 });
  await expect(page.locator('.chip', { hasText: 'Low battery' })).toHaveCount(0);
});

test('noise on the line is survived: boot chatter, split lines, broken JSON', async ({ page }) => {
  const table = await startWithHub(page);
  await feedRaw(page, 'ESP-ROM:esp32c3-api1-20210207\nrst:0x1 (POWERON)\n{"t":"btn","dev":"' + A + '","b":0,');
  await expect(table.center.locator('.center__active')).toHaveText('Ana');
  await feedRaw(page, '"e":"tap"}\n{broken json}\n{"t":"btn","dev":"' + B + '","b":0,"e":"tap"}\r\n');
  await expect(table.center.locator('.center__active')).toHaveText('Cleo');
});

test('unplugging the hub mid-game leaves the game playable on screen', async ({ page }) => {
  const table = await startWithHub(page);
  for (const dev of [A, B, C]) await feed(page, press(dev, 'tap'));
  await unplug(page);
  await expect(page.getByRole('button', { name: 'Hub', exact: true })).toBeVisible();
  await table.expectLights({ Ana: 'pulse' });
  await table.tap('Ana');
  await table.expectToast('Pick a card on the big screen');
});

test.describe('the test bench', () => {
  test('shows what each button says about itself and sends exactly what is clicked', async ({ page }) => {
    await installFakeHub(page);
    await page.goto('/bench');
    await page.getByRole('button', { name: 'Connect the hub' }).click();
    await expect(page.getByText('No buttons yet.')).toBeVisible();
    await feed(page, { t: 'hub', v: 0, fw: '0.1.0' }, hello(A), { t: 'bat', dev: A, mv: 5230 }, { t: 'rssi', dev: A, dbm: -58 });

    const card = page.locator('.bench__dev');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(A);
    await expect(card).toContainText('fw 0.1.0');
    await expect(card).toContainText('1 btn · ring · none');
    await expect(card).toContainText('5.23 V');
    await expect(card).toContainText('-58 dBm · strong');
    await expect(page.locator('.bench__hub')).toContainText('Hub firmware 0.1.0 · 1 button heard');
    await feed(page, { t: 'rssi', dev: A, dbm: -84 });
    await expect(card).toContainText('-84 dBm · weak');

    await page.getByRole('radio', { name: 'Green' }).click();
    await card.getByRole('button', { name: 'flash', exact: true }).click();
    await card.getByRole('button', { name: 'solid', exact: true }).click();
    await card.getByRole('button', { name: 'Identify' }).click();
    await card.getByRole('button', { name: 'fx: denied' }).click();
    await card.getByRole('button', { name: 'Play jingle' }).click();
    const out = await sent(page);
    expect(out).toContainEqual({ t: 'led', dev: A, c: '2fe06b', m: 'flash' });
    expect(out).toContainEqual({ t: 'led', dev: A, c: '2fe06b', m: 'solid' });
    expect(out).toContainEqual({ t: 'id', dev: A });
    expect(out).toContainEqual({ t: 'fx', dev: A, k: 'denied' });
    const snd = out.find((m) => m.t === 'snd');
    expect(snd.dev).toBe(A);
    expect(snd.n.length).toBeGreaterThan(2);
    expect(snd.n.every((n: unknown) => Array.isArray(n) && n.length === 2)).toBe(true);

    await feed(page, press(A, 'tap'), press(A, 'double'), press(A, 'hold'));
    await expect(card.locator('.bench__presses .chip')).toHaveText(['hold', 'double', 'tap']);
    await expect(page.locator('.bench__lines')).toContainText('"e":"double"');

    await feed(page, { t: 'lost', dev: A });
    await expect(card).toContainText('not answering');
  });
});
