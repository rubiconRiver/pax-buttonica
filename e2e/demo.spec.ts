import { Table, expect, lab, liveGame, openDemo, openSettings, seedStorage, test } from './helpers';
import { FANFARE_MS } from './flows';

/** The demo is the recruiting pitch: the guided tour has to follow what the visitor does, and every lab button has to work. */

test('the tour follows along as the visitor plays', async ({ page }) => {
  const table = await openDemo(page, { tour: true });
  const tour = page.locator('.tour');
  await expect(tour).toContainText('How it works · 1/6');
  await expect(tour.locator('h3')).toHaveText('Whose turn is it?');
  await expect(tour).toContainText('press and hold their button for 2 seconds');

  await table.hold('Dave');
  await expect(tour.locator('h3')).toHaveText('Playing a strategy card');
  await expect(tour).toContainText("Now it's Kyle");

  await table.doubleTap('Kyle');
  await expect(tour.locator('h3')).toHaveText('Primary first');

  await table.primaryDone('Kyle');
  await expect(tour.locator('h3')).toHaveText('Nobody gets skipped');
  await expect(tour).toContainText('5 to go');
  await table.hold('Kyle'); // "try holding their button and watch it refuse"
  await table.expectToast(/waiting on/i);
  for (const [i, name] of ['Mike', 'Sarah', 'Dave', 'Jen'].entries()) {
    await table.tap(name);
    await expect(tour).toContainText(`${4 - i} to go`);
  }
  await table.tap('Steph');

  await expect(tour.locator('h3')).toHaveText('Released');
  await table.hold('Kyle');
  await expect(tour.locator('h3')).toHaveText("That's the whole idea");
  await expect(tour).toContainText('How it works · 6/6');

  await tour.getByRole('button', { name: 'Close the tour' }).click();
  await expect(tour).toHaveCount(0);
});

test('scenario lab: a turn', async ({ page }) => {
  const table = await openDemo(page);
  await lab(page, 'Tap instead of hold').click();
  await table.expectToast('Dave: Hold to end your turn');
  await lab(page, 'Wrong player holds').click();
  await table.expectActive('Dave');
  await lab(page, 'End turn').click();
  await table.expectActive('Kyle');
  await lab(page, 'Start of round').click();
  await table.expectPhase('Strategy');
  await expect(table.center.locator('.center__title')).toHaveText('Mike is choosing');
  await expect(lab(page, 'End turn')).toBeDisabled();
  await lab(page, 'Fresh turn').click();
  await table.expectActive('Dave');
});

test('scenario lab: the strategy card sequence', async ({ page }) => {
  const table = await openDemo(page);
  await expect(lab(page, 'Primary done')).toBeDisabled();
  await expect(lab(page, 'One player responds')).toBeDisabled();
  await lab(page, 'Double-tap: play card').click();
  await table.expectLights({ Dave: 'flash' });
  await expect(lab(page, 'Double-tap: play card')).toBeDisabled();
  await lab(page, 'Try to end turn early').click();
  await table.expectToast(/finish the primary first/);
  await lab(page, 'Primary done').click();
  await table.expectLights({ Mike: 'flash', Steph: 'flash' });
  await lab(page, 'Try to end turn early').click();
  await table.expectToast(/waiting on/);
  await lab(page, 'One player responds').click();
  await table.expectLights({ Mike: 'dim', Sarah: 'flash' });
  await lab(page, 'Everyone responds').click();
  await table.expectLights({ Dave: 'pulse', Sarah: 'dim' });
  await expect(lab(page, 'Try to end turn early')).toBeDisabled();
  await lab(page, 'End turn').click();
  await table.expectActive('Kyle');
});

test('scenario lab: passing, the status phase, agenda and victory', async ({ page }) => {
  const table = await openDemo(page);
  await expect(lab(page, 'Pass', )).toBeDisabled();
  await lab(page, 'Pass too early').click();
  await table.expectToast("Dave: can't pass with an unplayed strategy card");

  await lab(page, 'Late in the round').click();
  await table.expectActive('Dave');
  await expect(page.locator('.seat .cardpip[data-used]')).toHaveCount(6);
  await expect(lab(page, 'Pass too early')).toBeDisabled();
  await lab(page, 'Pass').click();
  await expect(table.seat('Dave')).toHaveAttribute('data-passed', 'true');
  await table.expectActive('Kyle');

  await lab(page, 'Everyone has passed').click();
  await table.expectPhase('Status');
  await table.expectLights({ Dave: 'rainbow', Jen: 'rainbow' });
  await expect(lab(page, 'One player ready')).toBeDisabled();
  await page.clock.fastForward(FANFARE_MS + 100);
  await page.keyboard.press('Escape'); // the scoreboard put itself up
  await expect(table.center.locator('.center__active')).toHaveText('Dave');
  await lab(page, 'Next scorer is done').click();
  await expect(table.center.locator('.center__active')).toHaveText('Kyle');
  await table.center.getByRole('button', { name: 'Skip to the tidy-up' }).click();
  await expect(table.center).toContainText('0/6 ready');
  await lab(page, 'One player ready').click();
  await expect(table.center).toContainText('1/6 ready');
  await table.expectLights({ Mike: 'dim', Sarah: 'pulse' });

  await lab(page, 'Agenda phase').click();
  await table.expectPhase('Agenda');
  await expect(table.center.locator('.center__title')).toHaveText('Agenda 1 of 2');
  // Mike is speaker, so Sarah votes first and Mike last.
  await expect(table.center.locator('.voter').first()).toHaveText('Sarah');
  await expect(table.center.locator('.voter').last()).toHaveText('Mike');

  await lab(page, 'Victory').click();
  await expect(table.center).toContainText('claims the throne');
  await expect(page.locator('.dev[data-mode="rainbow"]')).toHaveCount(1);
  await expect(lab(page, 'Victory')).toBeDisabled();

  await page.locator('.lab').getByRole('button', { name: 'Reset' }).click();
  await table.expectActive('Dave');
  await table.expectVp('Mike', 0);
});

test('undo steps back through the demo, by button and by ⌘Z', async ({ page }) => {
  const table = await openDemo(page);
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo, 'a fresh demo has nothing to undo').toBeDisabled();
  await table.hold('Dave');
  await table.hold('Kyle');
  await table.expectActive('Mike');
  await undo.click();
  await table.expectActive('Kyle');
  await page.keyboard.press('ControlOrMeta+z');
  await table.expectActive('Dave');
  await expect(undo).toBeDisabled();
  // A refused action changes nothing, so it isn't an undo step.
  await table.tap('Dave');
  await expect(undo).toBeDisabled();
});

test('the demo never touches a real game in progress', async ({ page }) => {
  await seedStorage(page, {});
  await page.goto('/play');
  for (const [i, name] of ['Ana', 'Ben', 'Cleo'].entries()) {
    if (i === 0) await page.locator('.setup__options .opt').filter({ hasText: 'Players' }).getByRole('button', { name: '3', exact: true }).click();
    await page.locator('.seatcard__name').nth(i).fill(name);
  }
  await page.getByRole('button', { name: /Begin round one/ }).click();
  await page.getByRole('button', { name: /Skip/ }).click();
  const before = JSON.stringify(await liveGame(page));

  const table = await openDemo(page);
  await table.hold('Dave');
  await lab(page, 'Victory').click();
  const panel = await openSettings(page);
  await panel.getByRole('button', { name: 'Leave the demo' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(JSON.stringify(await liveGame(page))).toBe(before);
  await expect(page.getByRole('link', { name: 'Resume your game' })).toBeVisible();

  // And the demo starts fresh next time.
  await page.goto('/demo');
  await new Table(page).expectActive('Dave');
});

test('"your move" is drawn solid by default; breathing and heartbeat are a setting that sticks', async ({ page }) => {
  const table = await openDemo(page);
  await table.expectLights({ Dave: 'pulse' });
  await expect(table.light('Dave')).toHaveAttribute('data-look', 'solid');
  const panel = await openSettings(page);
  await panel.getByRole('radio', { name: 'Breathe' }).click();
  await expect(table.light('Dave')).not.toHaveAttribute('data-look');
  await panel.getByRole('radio', { name: 'Heartbeat' }).click();
  await expect(table.light('Dave')).toHaveAttribute('data-look', 'heartbeat');
  await page.keyboard.press('Escape');
  await page.reload();
  await new Table(page).expectActive('Dave');
  await expect(table.light('Dave')).toHaveAttribute('data-look', 'heartbeat');
});

test('mute, and the captions under the buttons, are settings that stick', async ({ page }) => {
  const table = await openDemo(page);
  await expect(table.seat('Dave').locator('.plate__why')).toHaveText('Your turn — hold to end it');
  await expect(table.seat('Mike').locator('.plate__why')).toHaveText('Waiting');
  const panel = await openSettings(page);
  await panel.getByLabel('Explain each light under its button').uncheck();
  await expect(page.locator('.plate__why')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTitle('Mute', { exact: true }).click();
  await expect(page.getByTitle('Unmute', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTitle('Unmute', { exact: true })).toBeVisible();
  await expect(page.locator('.plate__why')).toHaveCount(0);
});
