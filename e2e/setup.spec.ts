import { Table, expect, liveGame, readStorage, seedStorage, setUpGame, test } from './helpers';

/** The setup screen, saved players, and the real game surviving reloads. */

const begin = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /Begin round one/ });
const names = (page: import('@playwright/test').Page) => page.locator('.seatcard__name');

const PROFILE = (id: string, name: string, color: string) => ({
  id,
  name,
  color,
  faction: 'The Nomad',
  intro: { kind: 'jingle', id: 'herald' },
  outro: { kind: 'jingle', id: 'sealed' },
  buttons: 1,
  updatedAt: 1_700_000_000_000,
});

test('a table cannot start until everyone has a name, and no two share a name or a faction', async ({ page }) => {
  await page.goto('/play');
  await expect(names(page)).toHaveCount(6);
  await expect(begin(page)).toBeDisabled();
  await expect(page.locator('.setup__problems')).toHaveText('Everyone needs a name');

  await page.locator('.setup__options .opt').filter({ hasText: 'Players' }).getByRole('button', { name: '3', exact: true }).click();
  await expect(names(page)).toHaveCount(3);
  await expect(page.locator('.opt__note').first()).toHaveText('2 strategy cards each');
  await names(page).nth(0).fill('Ana');
  await names(page).nth(1).fill('ana ');
  await names(page).nth(2).fill('Cleo');
  await expect(page.locator('.setup__problems')).toHaveText('Two players share a name');
  await names(page).nth(1).fill('Ben');
  await expect(begin(page)).toBeEnabled();

  // Seat 2's card is open after typing in it; give Ben the same faction as Ana.
  await page.locator('.seatcard').nth(0).getByRole('button', { name: 'Edit' }).click();
  const anaFaction = await page.locator('.seatcard').nth(0).locator('.seatcard__more select').first().inputValue();
  await page.locator('.seatcard').nth(1).getByRole('button', { name: 'Edit' }).click();
  await page.locator('.seatcard').nth(1).locator('.seatcard__more select').first().selectOption(anaFaction);
  await expect(page.locator('.setup__problems')).toHaveText('Two players share a faction');
  await expect(begin(page)).toBeDisabled();
});

test('player counts change the cards each, and the colours in use are not offered twice', async ({ page }) => {
  await page.goto('/play');
  const count = (n: number) => page.locator('.setup__options .opt').filter({ hasText: 'Players' }).getByRole('button', { name: String(n), exact: true });
  for (const [n, note] of [[3, '2 strategy cards each'], [4, '2 strategy cards each'], [5, '1 strategy card each'], [8, '1 strategy card each']] as const) {
    await count(n).click();
    await expect(names(page)).toHaveCount(n);
    await expect(page.locator('.opt__note').first()).toHaveText(note);
  }
  // Eight players, eight colours: every seat has exactly its own colour left.
  await expect(page.locator('.seatcard').first().locator('.swatch:not([disabled])')).toHaveCount(1);
  await count(4).click();
  const first = page.locator('.seatcard').nth(0);
  const taken = await page.locator('.seatcard').nth(1).locator('.swatch[aria-checked="true"]').getAttribute('aria-label');
  await expect(first.getByRole('radio', { name: taken! })).toBeDisabled();
  await first.locator('.swatch:not([disabled]):not([aria-checked="true"])').first().click();
  await expect(first.locator('.swatch[aria-checked="true"]')).toHaveCount(1);
});

test('choices on the setup screen reach the game', async ({ page }) => {
  await page.goto('/play');
  await page.locator('.setup__options .opt').filter({ hasText: 'Players' }).getByRole('button', { name: '3', exact: true }).click();
  await page.locator('.setup__options .opt').filter({ hasText: 'Victory points' }).getByRole('button', { name: '12', exact: true }).click();
  for (const [i, n] of ['Ana', 'Ben', 'Cleo'].entries()) await names(page).nth(i).fill(n);
  await page.locator('.setup__options select').selectOption({ label: 'Cleo' });
  const ben = page.locator('.seatcard').nth(1);
  await ben.getByRole('button', { name: 'Edit' }).click();
  await ben.locator('.seatcard__more select').first().selectOption('The Winnu');
  await ben.getByRole('button', { name: '+ strategy & pass' }).click();
  await ben.getByLabel(/Entrance/).selectOption({ label: 'Silent' });
  await begin(page).click();
  await page.getByRole('button', { name: /Skip/ }).click();

  const table = new Table(page);
  const g = await liveGame(page);
  expect(g.vpTarget).toBe(12);
  expect(g.speaker).toBe(2);
  expect(g.players[1]).toMatchObject({ name: 'Ben', faction: 'The Winnu', buttons: 3, intro: { kind: 'none' } });
  await expect(table.center.locator('.center__title')).toHaveText('Cleo is choosing');
  await expect(table.seat('Ben').locator('.dev__auxbtn')).toHaveCount(2);
  await expect(table.roster('Ben').locator('.roster__faction')).toHaveText('Winnu');
});

test('a random first speaker is always someone at the table', async ({ page }) => {
  await page.goto('/play');
  await page.locator('.setup__options .opt').filter({ hasText: 'Players' }).getByRole('button', { name: '3', exact: true }).click();
  for (const [i, n] of ['Ana', 'Ben', 'Cleo'].entries()) await names(page).nth(i).fill(n);
  await begin(page).click();
  const g = await liveGame(page);
  expect([0, 1, 2]).toContain(g.speaker);
  expect(g.seating).not.toBeNull();

  // The table disagrees with the dice: the gavel moves the token, and the new speaker chooses first.
  await page.getByRole('button', { name: /Skip/ }).click();
  const table = new Table(page);
  const other = ['Ana', 'Ben', 'Cleo'][(g.speaker + 1) % 3];
  await table.roster(other).locator('.roster__speaker').click();
  await expect(table.center.locator('.center__title')).toHaveText(`${other} is choosing`);
});

test('the game survives a reload, the landing page offers to resume it, and ending it asks first', async ({ page }) => {
  await setUpGame(page, { names: ['Ana', 'Ben', 'Cleo'] });
  const table = new Table(page);
  await table.tapKey('2');
  await page.reload();
  await expect(table.center).toContainText('Claim your seat · 2 of 3');
  expect(await table.key('Ana')).toBe('2');

  await page.goto('/');
  await page.getByRole('link', { name: 'Resume your game' }).click();
  await expect(table.center).toContainText('Claim your seat · 2 of 3');

  await page.getByTitle('Settings', { exact: true }).click();
  page.once('dialog', (d) => void d.dismiss());
  await page.getByRole('button', { name: 'End this game…' }).click();
  await expect(table.center).toContainText('Claim your seat');
  page.once('dialog', (d) => {
    expect(d.message()).toContain('End this game?');
    void d.accept();
  });
  await page.getByRole('button', { name: 'End this game…' }).click();
  await expect(page.getByRole('heading', { name: "Who's at the table?" })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Start a real game' })).toBeVisible();
});

test.describe('saved players', () => {
  test.beforeEach(async ({ page }) => {
    await seedStorage(page, { 'pb.profiles.v1': [PROFILE('11111111-1111-4111-8111-111111111111', 'Priya', 'pink'), PROFILE('22222222-2222-4222-8222-222222222222', 'Marc', 'green')] });
  });

  test('picking a saved player fills the seat, and nobody can sit twice', async ({ page }) => {
    await page.goto('/play');
    await expect(page.locator('.setup__sync')).toHaveText('Offline: using the players saved in this browser');
    const seat1 = page.locator('.seatcard').nth(0);
    const seat2 = page.locator('.seatcard').nth(1);
    await seat1.getByLabel('Who is sitting here?').selectOption({ label: 'Priya' });
    await expect(seat1.locator('.seatcard__name')).toHaveValue('Priya');
    await expect(seat1.getByRole('radio', { name: 'Pink' }), "her favourite colour comes with her, since nobody else has it").toHaveAttribute('aria-checked', 'true');
    await expect(seat1.locator('.seatcard__more')).toContainText('Saved player: changes here are kept.');
    await expect(seat2.getByLabel('Who is sitting here?').locator('option')).toHaveText(['New player', 'Marc']);

    // Editing a linked seat edits the saved player.
    await seat1.getByRole('radio', { name: 'Black' }).click();
    expect((await readStorage<{ name: string; color: string }[]>(page, 'pb.profiles.v1'))!.find((p) => p.name === 'Priya')!.color).toBe('black');

    // Marc likes green, but seat four already has it: he keeps the seat's colour rather than doubling up.
    await seat2.getByLabel('Who is sitting here?').selectOption({ label: 'Marc' });
    await expect(seat2.getByRole('radio', { name: 'Orange' })).toHaveAttribute('aria-checked', 'true');

    // Unlinking clears the name for someone new.
    await seat1.getByLabel('Who is sitting here?').selectOption({ label: 'New player' });
    await expect(seat1.locator('.seatcard__name')).toHaveValue('');
  });

  test('forgetting a saved player removes them for good', async ({ page }) => {
    await page.goto('/play');
    const seat1 = page.locator('.seatcard').nth(0);
    await seat1.getByLabel('Who is sitting here?').selectOption({ label: 'Marc' });
    await seat1.getByRole('button', { name: 'Forget' }).click();
    await expect(seat1.getByLabel('Who is sitting here?').locator('option')).toHaveText(['New player', 'Priya']);
    expect((await readStorage<{ name: string }[]>(page, 'pb.profiles.v1'))!.map((p) => p.name)).toEqual(['Priya']);
  });

  test('starting a game links typed names to saved players instead of duplicating them', async ({ page }) => {
    await page.goto('/play');
    await page.locator('.setup__options .opt').filter({ hasText: 'Players' }).getByRole('button', { name: '3', exact: true }).click();
    await page.locator('.seatcard').nth(0).getByLabel('Who is sitting here?').selectOption({ label: 'Priya' });
    await names(page).nth(1).fill('marc'); // typed, not picked, and in lower case
    await names(page).nth(2).fill('Lise');
    await begin(page).click();
    const profiles = (await readStorage<{ id: string; name: string }[]>(page, 'pb.profiles.v1'))!;
    expect(profiles.map((p) => p.name).sort()).toEqual(['Lise', 'Priya', 'marc']);
    const g = await liveGame(page);
    expect(g.players[0].profileId).toBe('11111111-1111-4111-8111-111111111111');
    expect(g.players[1].profileId).toBe('22222222-2222-4222-8222-222222222222');
    expect(g.players[2].profileId).toBe(profiles.find((p) => p.name === 'Lise')!.id);
  });
});
