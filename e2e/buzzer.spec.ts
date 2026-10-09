import { expect, test } from './helpers';
import { feed, hello, installFakeHub, lastLed, press, sent } from './hub';

/**
 * The quiz night on the buttons (/buzzer): the host's button and the keyboard open the floor, the first `down` after
 * that wins, early presses are refused, right and wrong answers score, and every light goes out through the hub.
 */

const H = 'a1:b2:c3:00:00:10';
const A = 'a1:b2:c3:00:00:11';
const B = 'a1:b2:c3:00:00:12';
const C = 'a1:b2:c3:00:00:13';
const WHITE = 'e9f0ff';
const RED = 'ff3b3b';
const ORANGE = 'ff8a1f';
const YELLOW = 'ffd21f';

async function start(page: import('@playwright/test').Page) {
  await installFakeHub(page);
  await page.goto('/buzzer');
  await page.getByRole('button', { name: 'Connect the hub' }).click();
  await feed(page, { t: 'hub', v: 0, fw: '0.2.6' }, hello(H, undefined, '0.3.16'), hello(A, undefined, '0.3.16'), hello(B, undefined, '0.3.16'), hello(C, undefined, '0.3.16'));
  await expect(page.getByTestId('hub-chip')).toHaveText('Hub · 4 buttons');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
}

/** The host's button, then three players, in colour order. */
async function seat(page: import('@playwright/test').Page) {
  await feed(page, press(H, 'down'), press(H, 'tap'));
  await feed(page, press(A, 'down'), press(A, 'tap'));
  await feed(page, press(B, 'down'), press(B, 'tap'));
  await feed(page, press(C, 'down'), press(C, 'tap'));
  await expect(page.locator('.buzzer__tile')).toHaveCount(3);
}

const names = async (page: import('@playwright/test').Page, expected: string[]) => {
  await expect(page.locator('.buzzer__name')).toHaveCount(expected.length);
  for (const [i, name] of expected.entries()) await expect(page.locator('.buzzer__name').nth(i)).toHaveValue(name);
};

const fxTo = async (page: import('@playwright/test').Page, dev: string) => (await sent(page)).filter((m) => m.t === 'fx' && m.dev === dev).map((m) => m.k);

test('every button is kept awake, the first press is the host, the next ones are players, and the lights say so', async ({ page }) => {
  await start(page);
  // The quiz's settings: radios always on, a hold means nothing on a player's button; a button nobody has claimed breathes white.
  for (const dev of [H, A, B, C]) {
    expect(await sent(page)).toContainEqual({ t: 'cfg', dev, hold: 10000, flash: 2000, bright: 70, dim: 12, fx: 90, pulse: 'pulse', ps: 0 });
    expect(await lastLed(page, dev)).toMatchObject({ c: 'ffffff', m: 'pulse' });
  }
  await seat(page);
  await names(page, ['Red', 'Orange', 'Yellow']);
  // The host's button has a short hold (next question); everyone's light is dim, the host's dim white.
  expect(await sent(page)).toContainEqual(expect.objectContaining({ t: 'cfg', dev: H, hold: 1500, ps: 0 }));
  expect(await lastLed(page, H)).toMatchObject({ c: WHITE, m: 'dim' });
  expect(await lastLed(page, A)).toMatchObject({ c: RED, m: 'dim' });
  expect(await lastLed(page, C)).toMatchObject({ c: YELLOW, m: 'dim' });
  expect(await fxTo(page, A)).toEqual(['ack']);
  // The buttons panel knows who is who.
  await expect(page.getByLabel('Role of 000010')).toHaveValue('host');
  await expect(page.getByLabel('Role of 000011')).toHaveValue('player');
});

test('a question: the host opens the floor, the first down wins, late and early presses are shown for what they are', async ({ page }) => {
  await start(page);
  await seat(page);
  // Early: B presses before the floor is open. Refused, and dark for a second.
  await feed(page, press(B, 'down'), press(B, 'tap'));
  await expect(page.getByTestId('tile-a1b2c3000012')).toHaveAttribute('data-out', 'true');
  await expect(page.getByTestId('tile-a1b2c3000012')).toContainText('early');
  expect(await fxTo(page, B)).toEqual(['ack', 'denied']);
  expect(await lastLed(page, B)).toMatchObject({ c: ORANGE, m: 'off' });

  // The host taps: the floor is open, everyone who may answer breathes, the host's button is solid white.
  await feed(page, press(H, 'down'), press(H, 'tap'));
  await expect(page.locator('.buzzer__go')).toHaveText('Go');
  expect(await lastLed(page, H)).toMatchObject({ c: WHITE, m: 'solid' });
  expect(await lastLed(page, A)).toMatchObject({ c: RED, m: 'pulse' });
  expect(await lastLed(page, B), 'still locked out').toMatchObject({ c: ORANGE, m: 'off' });

  // A then C press. A wins; C is listed as late with the margin. B's tap on release counts for nothing.
  await feed(page, press(A, 'down'), press(C, 'down'), press(A, 'tap'), press(C, 'tap'));
  await expect(page.getByTestId('winner')).toHaveText('Red');
  await expect(page.locator('.buzzer__presses li')).toHaveCount(2);
  await expect(page.locator('.buzzer__presses li').nth(1)).toContainText(/Yellow \+\d+ ms/);
  expect(await lastLed(page, A)).toMatchObject({ c: RED, m: 'solid' });
  expect(await lastLed(page, C)).toMatchObject({ c: YELLOW, m: 'dim' });
  expect(await lastLed(page, H), "the host's button shows the winner's colour").toMatchObject({ c: RED, m: 'solid' });
  expect(await fxTo(page, A)).toEqual(['ack', 'burst']);

  // Right: Red scores the 200 on offer, the floor closes.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tile-a1b2c3000011').getByTestId('score')).toHaveText('200');
  await expect(page.locator('h1')).toHaveText('Question 2');
  await expect(page.locator('.buzzer__closed')).toBeVisible();
  expect(await lastLed(page, A)).toMatchObject({ c: RED, m: 'dim' });
});

test('wrong: they lose it, sit the question out, and the floor reopens for the rest; the keyboard runs the whole thing', async ({ page }) => {
  await start(page);
  await seat(page);
  await page.keyboard.press('5');
  await expect(page.getByRole('radio', { name: /500/ })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Space');
  await expect(page.locator('.buzzer__go')).toBeVisible();
  await feed(page, press(C, 'down'));
  await expect(page.getByTestId('winner')).toHaveText('Yellow');
  await page.keyboard.press('Backspace');
  await expect(page.getByTestId('tile-a1b2c3000013').getByTestId('score')).toHaveText('-500');
  await expect(page.locator('.buzzer__open')).toContainText('Yellow out for this question');
  expect(await lastLed(page, C)).toMatchObject({ c: YELLOW, m: 'off' });
  expect(await fxTo(page, C)).toEqual(['ack', 'burst', 'denied']);
  // C again: nothing. A takes it and is right.
  await feed(page, press(C, 'down'), press(A, 'down'));
  await expect(page.getByTestId('winner')).toHaveText('Red');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tile-a1b2c3000011').getByTestId('score')).toHaveText('500');
  // Space closes an open floor without anyone scoring; Escape is the next question.
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await expect(page.locator('.buzzer__closed')).toBeVisible();
  await page.keyboard.press('Space');
  await feed(page, press(B, 'down'));
  await page.keyboard.press('Escape');
  await expect(page.locator('.buzzer__closed')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Question 3');
  await expect(page.getByTestId('tile-a1b2c3000012').getByTestId('score')).toHaveText('0');
});

test('a button on older firmware buzzes on its tap; names, roles and scores survive a reload; leaving lets the radios sleep', async ({ page }) => {
  await start(page);
  await seat(page);
  await feed(page, hello('a1:b2:c3:00:00:14', undefined, '0.3.15'));
  await feed(page, press('a1:b2:c3:00:00:14', 'tap'));
  await expect(page.locator('.buzzer__tile')).toHaveCount(4);
  await page.keyboard.press('Space');
  await feed(page, press('a1:b2:c3:00:00:14', 'tap'), press(A, 'down'));
  await expect(page.getByTestId('winner')).toHaveText('Green');
  await page.keyboard.press('Enter');

  await page.locator('.buzzer__name').first().fill('Ana');
  await page.getByRole('button', { name: 'Ana plus 200' }).click();
  await page.getByLabel('Role of 000013').selectOption('spare');
  await expect(page.locator('.buzzer__tile')).toHaveCount(3);

  await page.reload();
  await names(page, ['Ana', 'Orange', 'Green']);
  await expect(page.locator('.buzzer__tile').first().getByTestId('score')).toHaveText('200');
  await expect(page.locator('h1')).toHaveText('Question 2');

  // Back to the game: every button is told it may sleep, and the game's own settings follow.
  await page.getByRole('button', { name: 'Connect the hub' }).click();
  await feed(page, { t: 'hub', v: 0, fw: '0.2.6' }, hello(A, undefined, '0.3.16'));
  await expect(page.getByTestId('hub-chip')).toBeVisible();
  await page.getByRole('link', { name: 'Bench' }).click();
  await expect(page.locator('h1')).toHaveText('Is this thing on?');
  const out = await sent(page);
  expect(out).toContainEqual({ t: 'cfg', dev: A, hold: 900, ps: 1 });
  expect(out.filter((m) => m.t === 'cfg' && m.dev === A).pop()).toMatchObject({ hold: 900, pulse: 'settle' });
});
