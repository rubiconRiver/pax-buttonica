import { Board, Table, claimSeatsInOrder, expect, liveGame, readStorage, setUpGame, test } from './helpers';
import { everyonePasses, everyoneReady, everyoneScores, initiativeOrder, pass, pickCards, playStrategyCard, scard, statusFanfare, takeTurn, type Picks, voteRound } from './flows';

/**
 * A whole six-player game, played the way the table will play it: through the setup screen, the seat-claiming
 * ritual, four rounds of strategy / action / status (and agenda once Mecatol falls), scoring as it goes, to a
 * winner on ten points. Buttons are pressed with the number keys, which drive the same code as a finger on the dome.
 */

const NAMES = ['Garett', 'Priya', 'Marc', 'Chantal', 'Owen', 'Lise'];
const [GARETT, PRIYA, MARC, CHANTAL, OWEN, LISE] = NAMES;

test('a complete six-player game, from setup to the throne', async ({ page }) => {
  test.setTimeout(process.env.CI ? 600_000 : 240_000); // a whole game, and CI's runner is a few times slower than a laptop
  const table = new Table(page);
  const board = new Board(page);

  // ── Setup and the seat-claiming ritual ────────────────────────────────────
  await test.step('set up the table and claim seats', async () => {
    await setUpGame(page, { names: NAMES, speaker: 0 });
    await table.expectLights({}); // nobody seated yet: six unclaimed buttons
    await expect(page.locator('.seat--open')).toHaveCount(6);
    await expect(page.locator('.seat--open .dev[data-mode="pulse"]')).toHaveCount(6);
    await claimSeatsInOrder(page, NAMES);
    await expect(page.locator('.seat--open')).toHaveCount(0);
    await expect(table.log).toContainText('Everyone is seated.');
    // Everyone at the table was given a saved profile.
    expect((await readStorage<{ name: string }[]>(page, 'pb.profiles.v1'))!.map((p) => p.name).sort()).toEqual([...NAMES].sort());
  });

  // ── Round 1 ───────────────────────────────────────────────────────────────
  const r1: Picks = [[GARETT, 4], [PRIYA, 1], [MARC, 3], [CHANTAL, 5], [OWEN, 7], [LISE, 2]];
  await test.step('round 1: strategy phase', async () => {
    await expect(page.locator('.phases__round')).toHaveText('R1');
    await expect(table.roster(GARETT).locator('.roster__speaker')).toHaveAttribute('aria-pressed', 'true');
    // Pressing a button now only nudges: cards are chosen on the big screen.
    await table.tap(GARETT);
    await table.expectToast('Pick a card on the big screen');
    await pickCards(table, r1);
    await table.expectPhase('Action');
  });

  await test.step('round 1: everyone plays their card, with the lock checked every time', async () => {
    const order = initiativeOrder(r1);
    expect(order).toEqual([PRIYA, LISE, MARC, GARETT, CHANTAL, OWEN]);
    for (const [i, name] of order.entries()) {
      const card = r1.find(([n]) => n === name)![1];
      await playStrategyCard(table, name, card, NAMES, { tryToLeaveEarly: true, ackOnScreen: i % 2 ? [GARETT, OWEN] : [] });
      if (name === MARC) {
        // Politics: Marc hands the speaker token to Chantal.
        await table.roster(CHANTAL).locator('.roster__speaker').click();
        await expect(table.roster(CHANTAL).locator('.roster__speaker')).toHaveAttribute('aria-pressed', 'true');
        await expect(table.roster(GARETT).locator('.roster__speaker')).toHaveAttribute('aria-pressed', 'false');
      }
    }
  });

  await test.step('round 1: ordinary turns, with the wrong gestures along the way', async () => {
    // Priya is up again. Her card is spent, so a double-tap means nothing…
    await table.expectActive(PRIYA);
    await table.doubleTap(PRIYA);
    await expect(table.center.locator('.play')).toHaveCount(0);
    // …a tap is just a reminder…
    await table.tap(PRIYA);
    await table.expectToast('Hold to end your turn');
    // …someone else holding does nothing…
    await table.hold(OWEN);
    await table.expectActive(PRIYA);
    // …and letting go early doesn't count.
    await table.hold(PRIYA, 1500);
    await table.expectActive(PRIYA);
    await takeTurn(table, PRIYA);

    // Lise ends her turn by mistake; the host undoes it and the turn comes back to her.
    await takeTurn(table, LISE);
    await table.expectActive(MARC);
    await page.getByRole('button', { name: 'Undo' }).click();
    await table.expectActive(LISE);
    await takeTurn(table, LISE);

    // Pizza arrives during Marc's turn: the clock stops, then carries on.
    await table.expectActive(MARC);
    await page.getByTitle('Pause the turn clock').click();
    await expect(table.center.locator('.center__hint')).toHaveText('Paused');
    const frozen = await table.center.locator('.center__clock').innerText();
    await page.clock.fastForward(60_000);
    await expect(table.center.locator('.center__clock')).toHaveText(frozen);
    await page.getByTitle('Resume the turn clock').click();
    await expect(table.center.locator('.center__hint')).toContainText('hold 2s to end the turn');
    await takeTurn(table, MARC);

    for (const name of [GARETT, CHANTAL, OWEN]) await takeTurn(table, name);
  });

  await test.step('round 1: everyone passes', async () => {
    await everyonePasses(table, initiativeOrder(r1));
    await table.expectPhase('Status');
    await expect(table.banner).toContainText('Status phase');
    await expect(table.banner).toContainText('Round 1 is over');
    await expect(board.root, 'the lights get their moment before the scoreboard comes up').toBeHidden();
  });

  await test.step('round 1: status phase, first objectives scored', async () => {
    await statusFanfare(table, NAMES);
    await expect(board.root, 'the scoreboard puts itself up for scoring').toBeVisible();
    await expect(board.root.locator('.board__scoring')).toContainText(`Scoring: ${initiativeOrder(r1)[0]}`);
    await board.reveal(1, 'Expand Borders');
    await board.reveal(1, 'Erect a Monument');
    await board.score('Expand Borders', GARETT);
    await board.score('Expand Borders', PRIYA);
    await board.score('Erect a Monument', LISE);
    // A slip of the finger, corrected.
    await board.score('Erect a Monument', OWEN);
    await board.expectVp(OWEN, 1);
    await board.score('Erect a Monument', OWEN);
    await board.expectVp(OWEN, 0);
    await board.expectVp(GARETT, 1);
    await board.expectVp(PRIYA, 1);
    await board.expectVp(LISE, 1);

    await everyoneScores(table, initiativeOrder(r1));
    await expect(board.root.locator('.board__ready')).toHaveText('0/6 ready');
    await everyoneReady(table, NAMES);
    // Custodians still on Mecatol, so no agenda phase: straight to round two, and the scoreboard steps aside.
    await table.expectPhase('Strategy');
    await expect(page.locator('.phases__round')).toHaveText('R2');
    await expect(board.root).toBeHidden();
  });

  // ── Round 2 ───────────────────────────────────────────────────────────────
  // Chantal is speaker now, so she chooses first and the order runs clockwise from her.
  const r2: Picks = [[CHANTAL, 8], [OWEN, 6], [LISE, 1], [GARETT, 2], [PRIYA, 3], [MARC, 4]];
  await test.step('round 2: the cards nobody took have gathered trade goods', async () => {
    await expect(scard(table, 6).locator('.scard__tg')).toHaveText('+1');
    await expect(scard(table, 8).locator('.scard__tg')).toHaveText('+1');
    await expect(scard(table, 1).locator('.scard__tg')).toHaveCount(0);
    await pickCards(table, r2);
    await expect(table.log).toContainText('Chantal takes 8 · Imperial (+1 trade good).');
    // A taken card can't be taken twice (the button was disabled the moment it went).
    await table.expectPhase('Action');
  });

  await test.step('round 2: action phase, a reload in the middle, and Mecatol Rex falls', async () => {
    const order = initiativeOrder(r2);
    expect(order).toEqual([LISE, GARETT, PRIYA, MARC, OWEN, CHANTAL]);
    await playStrategyCard(table, LISE, 1, NAMES);

    // Garett's laptop sleeps, the tab reloads. The game is exactly where it was.
    await table.expectActive(GARETT);
    await page.reload();
    await table.expectActive(GARETT);
    await table.expectLights({ [LISE]: 'dim', [PRIYA]: 'dim' });
    await expect(page.locator('.phases__round')).toHaveText('R2');
    await board.open();
    await board.expectVp(GARETT, 1);
    await expect(board.objective('Expand Borders')).toBeVisible();
    await board.close();

    await playStrategyCard(table, GARETT, 2, NAMES);
    await playStrategyCard(table, PRIYA, 3, NAMES);
    await playStrategyCard(table, MARC, 4, NAMES);
    await playStrategyCard(table, OWEN, 6, NAMES);
    // Imperial: Chantal scores a public objective in the middle of the action phase.
    await playStrategyCard(table, CHANTAL, 8, NAMES);
    await board.open();
    await board.score('Erect a Monument', CHANTAL);
    await board.expectVp(CHANTAL, 1);
    await board.close();

    // Second lap. Garett takes Mecatol Rex on his turn.
    await takeTurn(table, LISE);
    await table.expectActive(GARETT);
    await expect(page.locator('.phases__step', { hasText: 'Agenda' })).toHaveAttribute('data-locked', 'true');
    await page.getByRole('button', { name: /Custodians on Rex/ }).click();
    await expect(page.getByRole('button', { name: /Custodians gone/ })).toBeVisible();
    await expect(page.locator('.phases__step', { hasText: 'Agenda' })).not.toHaveAttribute('data-locked', 'true');
    await board.open();
    await board.addExtra(GARETT, 'Custodians of Mecatol Rex');
    await board.expectVp(GARETT, 2);
    await board.close();
    await takeTurn(table, GARETT);
    for (const name of [PRIYA, MARC, OWEN, CHANTAL]) await takeTurn(table, name);

    // Passing, with a player who has already passed still answering… nothing: just pass in order.
    await everyonePasses(table, order);
  });

  await test.step('round 2: status, then the first agenda phase', async () => {
    await statusFanfare(table, NAMES);
    await board.score('Erect a Monument', GARETT);
    await board.addSecret(GARETT, 'Become a Legend');
    await board.expectVp(GARETT, 4);
    await expect(board.stand(GARETT).locator('.stand__split')).toHaveText(/Public 2.*Secret 1.*Other 1/);
    await board.reveal(1, 'Sway the Council');
    await everyoneScores(table, initiativeOrder(r2));
    await expect(board.root.locator('.board__ready')).toHaveText('0/6 ready');
    await everyoneReady(table, NAMES);

    await table.expectPhase('Agenda');
    await expect(board.root, 'the scoreboard came up by itself, so it goes away by itself').toBeHidden();
    await expect(table.center.locator('.center__title')).toHaveText('Agenda 1 of 2');
    // Voting starts on the speaker's left and ends with the speaker (Chantal).
    const voting = [OWEN, LISE, GARETT, PRIYA, MARC, CHANTAL];
    // Out of turn: ignored.
    await table.tap(CHANTAL);
    await expect(table.center.locator('.voter[data-state="now"]')).toHaveText(OWEN);
    await voteRound(table, voting);
    await expect(table.center.locator('.center__title')).toHaveText('Agenda 2 of 2');
    await board.open();
    await board.addLaw('Minister of Commerce', 'Lise');
    await expect(board.root.locator('.law')).toContainText('Minister of Commerce');
    await expect(board.root.locator('.law')).toContainText('Lise');
    await board.close();
    await voteRound(table, voting);
    await table.expectPhase('Strategy');
    await expect(page.locator('.phases__round')).toHaveText('R3');
  });

  // ── Round 3 ───────────────────────────────────────────────────────────────
  const r3: Picks = [[CHANTAL, 1], [OWEN, 2], [LISE, 3], [GARETT, 8], [PRIYA, 4], [MARC, 5]];
  await test.step('round 3: Garett takes Imperial', async () => {
    await pickCards(table, r3);
    const order = initiativeOrder(r3);
    for (const name of order) {
      const card = r3.find(([n]) => n === name)![1];
      if (name === GARETT) {
        // Use the big-screen buttons this time, as the host would if a button's batteries died.
        await table.expectActive(GARETT);
        await table.center.getByRole('button', { name: /Play 8 Imperial/ }).click();
        await table.expectLights({ [GARETT]: 'flash' });
        await table.center.getByRole('button', { name: 'Primary done' }).click();
        await table.expectLights({ [GARETT]: 'solid', [PRIYA]: 'flash' });
        await expect(table.center.getByRole('button', { name: 'End turn' })).toHaveCount(0);
        await table.center.getByRole('button', { name: "Everyone's done" }).click();
        await table.expectLights({ [GARETT]: 'pulse', [PRIYA]: 'dim' });
        await board.open();
        await board.addExtra(GARETT, 'Imperial (holding Mecatol Rex)');
        await board.expectVp(GARETT, 5);
        await board.close();
        await table.center.getByRole('button', { name: 'End turn' }).click();
      } else {
        await playStrategyCard(table, name, card, NAMES);
      }
    }
    // Owen passes first and still has to answer… nothing left to answer; everyone simply passes.
    await everyonePasses(table, order);

    await statusFanfare(table, NAMES);
    await board.score('Sway the Council', GARETT);
    await board.reveal(2, 'Found a Golden Age');
    await board.score('Found a Golden Age', GARETT);
    await board.score('Found a Golden Age', MARC);
    await board.expectVp(GARETT, 8);
    await board.expectVp(MARC, 2);
    await everyoneScores(table, order);
    await everyoneReady(table, NAMES);

    // The table is tired of politics: the host skips the agenda phase.
    await table.expectPhase('Agenda');
    await expect(board.root).toBeHidden();
    await table.center.getByRole('button', { name: 'Vote done' }).click();
    await expect(table.center.locator('.voter[data-state="now"]')).toHaveText(LISE);
    await table.center.getByRole('button', { name: 'Skip to next round' }).click();
    await table.expectPhase('Strategy');
    await expect(page.locator('.phases__round')).toHaveText('R4');
  });

  // ── Round 4 ───────────────────────────────────────────────────────────────
  const r4: Picks = [[CHANTAL, 2], [OWEN, 1], [LISE, 4], [GARETT, 3], [PRIYA, 8], [MARC, 7]];
  await test.step('round 4: a passed player still answers secondaries', async () => {
    await pickCards(table, r4);
    const order = initiativeOrder(r4); // Owen, Chantal, Garett, Lise, Marc, Priya
    expect(order).toEqual([OWEN, CHANTAL, GARETT, LISE, MARC, PRIYA]);
    await playStrategyCard(table, OWEN, 1, NAMES);
    await playStrategyCard(table, CHANTAL, 2, NAMES);
    await playStrategyCard(table, GARETT, 3, NAMES);
    await playStrategyCard(table, LISE, 4, NAMES);
    await playStrategyCard(table, MARC, 7, NAMES);
    // Priya sits on Imperial for now and takes an ordinary turn instead.
    await takeTurn(table, PRIYA);
    // With her card unplayed she can't pass, on screen or otherwise.
    for (const name of [OWEN, CHANTAL, GARETT, LISE, MARC]) {
      await pass(table, name);
      await table.expectLights({ [name]: 'off' });
    }
    await table.expectActive(PRIYA);
    await expect(table.center.getByRole('button', { name: 'Pass', exact: true })).toBeDisabled();
    // Everyone else has passed, and they all still get the Imperial secondary.
    await playStrategyCard(table, PRIYA, 8, NAMES, { passed: [OWEN, CHANTAL, GARETT, LISE, MARC] });
    await board.open();
    await board.addExtra(GARETT, 'Support for the Throne');
    await board.expectVp(GARETT, 9);
    await board.close();
    await pass(table, PRIYA);
    await statusFanfare(table, NAMES);
  });

  await test.step('the tenth point ends the game', async () => {
    // Scoring has come round to Garett, and the point that wins doesn't wait for anyone.
    await everyoneScores(table, initiativeOrder(r4).slice(0, initiativeOrder(r4).indexOf(GARETT)));
    await board.addSecret(GARETT);
    await expect(table.center).toContainText('claims the throne in round 4');
    await expect(table.center.locator('.center__active')).toHaveText(GARETT);
    await table.expectLights({ [GARETT]: 'rainbow', [PRIYA]: 'dim', [MARC]: 'dim', [CHANTAL]: 'dim', [OWEN]: 'dim', [LISE]: 'dim' });
    await expect(table.log).toContainText('Garett claims the throne!');
    // The scoreboard gets out of the way of the coronation; it's still there if anyone wants the final standings.
    await expect(board.root).toBeHidden();
    await board.open();
    await board.expectVp(GARETT, 10);
    await expect(board.stand(GARETT)).toHaveAttribute('data-lead', 'true');

    const g = await liveGame(page);
    expect(g.phase).toBe('finished');
    expect(g.winner).toBe(0);
    expect(g.round).toBe(4);
    // Three turns each in rounds one and two (card, plain turn, pass), two in rounds three and four (card, pass).
    // Priya took an extra turn in round four before playing Imperial. Lise's undone turn is not counted twice.
    expect(g.players.map((p: { turns: number }) => p.turns)).toEqual([10, 11, 10, 10, 10, 10]);
    expect(g.players.every((p: { timeMs: number }) => p.timeMs > 0)).toBe(true);
    expect(g.players.map((p: { vp: number }) => p.vp)).toEqual([10, 1, 2, 1, 0, 1]);
  });

  await test.step('not so fast: undo the win, win again, start over', async () => {
    await board.close();
    await table.center.getByRole('button', { name: /Undo/ }).click();
    await table.expectPhase('Status');
    await table.expectVp(GARETT, 9);
    // Back in the status phase, so the scoreboard is back up. This time use the side panel's quick stepper.
    await board.close();
    await page.getByRole('button', { name: 'Give Garett a point' }).click();
    await expect(table.center).toContainText('claims the throne');

    page.once('dialog', (d) => void d.accept());
    await table.center.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('heading', { name: "Who's at the table?" })).toBeVisible();
    expect(await liveGame(page)).toBeNull();
    // Tonight's players are offered as saved players for the next game.
    await expect(page.locator('.seatcard__profile').first().locator('option')).toHaveCount(7);
  });
});
