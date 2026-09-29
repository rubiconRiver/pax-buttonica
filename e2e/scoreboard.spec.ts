import { Board, DEMO, DEMO_ORDER, Table, expect, lab, liveGame, openDemo, openSettings, setUpGame, test } from './helpers';
import { FANFARE_MS } from './flows';

/** Objectives, points and laws: the part of the game people argue about, so the arithmetic has to be right. */

test('opens and closes by button, by B and by Escape', async ({ page }) => {
  await openDemo(page);
  const board = new Board(page);
  await page.getByRole('button', { name: 'Scoreboard', exact: true }).click();
  await expect(board.root).toBeVisible();
  await page.keyboard.press('b');
  await expect(board.root).toBeHidden();
  await page.keyboard.press('B');
  await expect(board.root).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(board.root).toBeHidden();
  await page.keyboard.press('b');
  await board.root.getByRole('button', { name: /Back to the table/ }).click();
  await expect(board.root).toBeHidden();
});

test('revealing objectives: search, pick, and never the same card twice', async ({ page }) => {
  await openDemo(page);
  const board = new Board(page);
  await board.open();
  await expect(board.root.locator('.board__empty').first()).toHaveText('Nothing revealed yet.');

  const col = board.root.locator('.board__col[data-stage="1"]');
  await col.getByRole('button', { name: /Reveal a Stage I objective/ }).click();
  const search = col.getByPlaceholder(/Search Stage I/);
  await expect(search).toBeFocused();
  await expect(col.locator('.reveal__item')).toHaveCount(20);
  // Search looks at the requirement text too: "8 resources" finds Erect a Monument.
  await search.fill('8 resources');
  await expect(col.locator('.reveal__item')).toHaveCount(1);
  await col.locator('.reveal__item').click();
  await expect(board.objective('Erect a Monument').locator('.obj__text')).toHaveText('Spend 8 resources.');
  await expect(board.objective('Erect a Monument').locator('.obj__pts')).toHaveText('1');

  await col.getByRole('button', { name: /Reveal a Stage I objective/ }).click();
  await col.getByPlaceholder(/Search Stage I/).fill('monument');
  await expect(col.locator('.reveal__item')).toHaveCount(0);
  await expect(col).toContainText('No match. Add it by hand below.');

  // Stage II cards are not offered under Stage I, and are worth two.
  await col.getByPlaceholder(/Search Stage I/).fill('Golden Age');
  await expect(col.locator('.reveal__item')).toHaveCount(0);
  await col.getByRole('button', { name: 'Done' }).click();
  await board.reveal(2, 'Found a Golden Age');
  await expect(board.objective('Found a Golden Age').locator('.obj__pts')).toHaveText('2');
  await expect(new Table(page).log).toContainText('Objective revealed: Found a Golden Age.');
});

test('an objective that is not on the list can be typed in', async ({ page }) => {
  await openDemo(page);
  const board = new Board(page);
  await board.open();
  const col = board.root.locator('.board__col[data-stage="2"]');
  await col.getByRole('button', { name: /Reveal a Stage II objective/ }).click();
  const add = col.getByRole('button', { name: 'Add', exact: true });
  await expect(add).toBeDisabled();
  await col.getByPlaceholder('Not listed? Name').fill("Thunder's Edge Thing");
  await col.getByPlaceholder('What it asks for').fill('Do the new thing twice.');
  await add.click();
  await expect(board.objective("Thunder's Edge Thing").locator('.obj__text')).toHaveText('Do the new thing twice.');
  await board.score("Thunder's Edge Thing", 'Jen');
  await board.expectVp('Jen', 2);
});

test('points add up from publics, secrets and everything else, and come off again', async ({ page }) => {
  const table = await openDemo(page);
  const board = new Board(page);
  await board.open();
  await board.reveal(1, 'Expand Borders');
  await board.reveal(2, 'Conquer the Weak');

  await board.score('Expand Borders', 'Sarah');
  await board.score('Conquer the Weak', 'Sarah');
  await expect(board.objective('Expand Borders').locator('.who-chip', { hasText: 'Sarah' })).toHaveAttribute('aria-pressed', 'true');
  await board.addSecret('Sarah', 'Spark a Rebellion');
  await board.addSecret('Sarah');
  await board.addExtra('Sarah', 'Custodians of Mecatol Rex');
  await board.addExtra('Sarah', 'Agenda', '−1');
  await board.expectVp('Sarah', 5);
  await expect(board.stand('Sarah').locator('.stand__split')).toHaveText(/Public 3.*Secret 2.*Other 0/);
  await expect(board.other('Sarah')).toContainText('Secret: Spark a Rebellion +1');
  await expect(board.other('Sarah')).toContainText('Agenda -1');
  await expect(board.stand('Sarah')).toHaveAttribute('data-lead', 'true');

  // Take things away one at a time.
  await board.other('Sarah').locator('.tag', { hasText: 'Agenda' }).getByRole('button', { name: 'Remove' }).click();
  await board.expectVp('Sarah', 6);
  await board.other('Sarah').locator('.tag--secret').first().getByRole('button', { name: 'Remove' }).click();
  await board.expectVp('Sarah', 5);
  await board.score('Conquer the Weak', 'Sarah');
  await board.expectVp('Sarah', 3);
  // Removing a whole objective takes its points from everyone who scored it.
  await board.score('Expand Borders', 'Mike');
  await board.objective('Expand Borders').getByRole('button', { name: 'Remove Expand Borders' }).click();
  await board.expectVp('Sarah', 2);
  await board.expectVp('Mike', 0);

  // The same numbers show on the table and the roster.
  await board.close();
  await table.expectVp('Sarah', 2);
  await expect(table.roster('Sarah').locator('.stepper__n')).toHaveText('2');
});

test('points never go below zero', async ({ page }) => {
  const table = await openDemo(page);
  await expect(page.getByRole('button', { name: 'Remove a point from Mike' })).toBeDisabled();
  const board = new Board(page);
  await board.open();
  await board.addExtra('Mike', 'Agenda', '−1');
  await board.expectVp('Mike', 0);
  await board.close();
  await table.expectVp('Mike', 0);
});

test('the quick +/- on the roster is its own line in the breakdown', async ({ page }) => {
  await openDemo(page);
  const board = new Board(page);
  await page.getByRole('button', { name: 'Give Jen a point' }).click();
  await page.getByRole('button', { name: 'Give Jen a point' }).click();
  await page.getByRole('button', { name: 'Remove a point from Jen' }).click();
  await board.open();
  await board.expectVp('Jen', 1);
  await expect(board.other('Jen')).toContainText('Other +1');
  await board.close();
  await page.getByRole('button', { name: 'Remove a point from Jen' }).click();
  await board.open();
  await expect(board.other('Jen').locator('.tag:not(.tag--add)')).toHaveCount(0);
});

test('laws: passed, annotated, repealed', async ({ page }) => {
  await openDemo(page);
  const board = new Board(page);
  await board.open();
  await expect(board.root).toContainText('No laws have been passed.');
  await expect(board.root.getByRole('button', { name: 'Add law' })).toBeDisabled();
  await board.addLaw('Minister of Commerce', 'Steph');
  await board.addLaw('Fleet Regulations');
  await expect(board.root.locator('.law')).toHaveCount(2);
  await expect(board.root.locator('.law').first()).toContainText('Minister of Commerce');
  await expect(board.root.locator('.law').first()).toContainText('Steph');
  await board.root.getByRole('button', { name: 'Repeal Minister of Commerce' }).click();
  await expect(board.root.locator('.law')).toHaveCount(1);
  await expect(board.root.locator('.law')).toContainText('Fleet Regulations');
});

test('the scoreboard goes up by itself for the status phase, unless told not to', async ({ page }) => {
  await openDemo(page);
  const board = new Board(page);
  await lab(page, 'Everyone has passed').click();
  await page.clock.fastForward(FANFARE_MS + 100);
  await expect(board.root).toBeVisible();
  await expect(board.root.locator('.board__scoring')).toContainText('Scoring: Dave');
  await board.close();

  const panel = await openSettings(page);
  await panel.getByLabel('Show the scoreboard during the status phase').uncheck();
  await page.keyboard.press('Escape');
  await page.locator('.lab').getByRole('button', { name: 'Reset' }).click();
  await lab(page, 'Everyone has passed').click();
  await new Table(page).expectPhase('Status');
  await page.clock.fastForward(FANFARE_MS + 100);
  await expect(board.root).toBeHidden();
});

test('a scoreboard opened by hand stays up when the round moves on', async ({ page }) => {
  const table = await openDemo(page);
  const board = new Board(page);
  await lab(page, 'Everyone has passed').click();
  await page.clock.fastForward(FANFARE_MS + 100);
  await board.close();
  await board.open();
  await table.center.getByRole('button', { name: "Everyone's ready" }).click({ force: true }).catch(() => {});
  // The table is covered by the scoreboard, so use the buttons instead: scoring in initiative order, then everyone taps in.
  for (const name of DEMO_ORDER) await table.tap(name);
  for (const name of DEMO) await table.tap(name);
  await table.expectPhase('Strategy');
  await expect(board.root).toBeVisible();
});

test('the target decides the winner: first to 14 is not over at 10', async ({ page }) => {
  await setUpGame(page, { names: ['Ana', 'Ben', 'Cleo'], vp: 14 });
  await page.getByRole('button', { name: /Skip/ }).click();
  const table = new Table(page);
  await expect(page.locator('.side__players .panel__head')).toContainText('First to 14');
  for (let i = 0; i < 13; i++) await page.getByRole('button', { name: 'Give Ben a point' }).click();
  await table.expectVp('Ben', 13);
  await table.expectPhase('Strategy');
  await page.getByRole('button', { name: 'Give Ben a point' }).click();
  await expect(table.center).toContainText('claims the throne in round 1');
  await expect(page.getByRole('button', { name: 'Give Ana a point' }), 'no more points once someone has won').toBeDisabled();
  expect((await liveGame(page)).winner).toBe(1);

  // That last point was a mistake: taking it back picks the game up where it was.
  await page.getByRole('button', { name: 'Remove a point from Ben' }).click();
  await table.expectVp('Ben', 13);
  await table.expectPhase('Strategy');
  await expect(page.getByRole('button', { name: 'Give Ana a point' })).toBeEnabled();
  expect((await liveGame(page)).winner).toBeNull();
});
