import { Table, expect, liveGame, setUpGame, test } from './helpers';
import { everyonePasses, everyoneReady, pickCards, playStrategyCard, scard, takeTurn, type Picks } from './flows';

/** Three and four players hold two strategy cards each: two laps of choosing, a "which card?" step, and no passing until both are played. */

const NAMES = ['Ana', 'Ben', 'Cleo', 'Dev'];
const PICKS: Picks = [['Ana', 5], ['Ben', 2], ['Cleo', 3], ['Dev', 4], ['Ana', 1], ['Ben', 6], ['Cleo', 7], ['Dev', 8]];

test('a four-player round with two cards each', async ({ page }) => {
  test.setTimeout(120_000);
  await setUpGame(page, { names: NAMES, speaker: 0 });
  await page.getByRole('button', { name: /Skip/ }).click();
  const table = new Table(page);

  await test.step('two laps of choosing', async () => {
    await pickCards(table, PICKS.slice(0, 4));
    // Half-way: everyone has one card, nobody is "done", and the speaker is up again.
    await table.expectPhase('Strategy');
    await expect(scard(table, 5)).toBeDisabled();
    await expect(scard(table, 5).locator('.scard__holder')).toHaveText('Ana');
    await pickCards(table, PICKS.slice(4));
    await table.expectPhase('Action');
    await expect(table.seat('Ana').locator('.cardpip')).toHaveText(['1', '5']);
  });

  await test.step('a double-tap asks which card', async () => {
    // Ana holds Leadership, so she goes first even though she chose Trade first.
    await table.expectActive('Ana');
    await table.doubleTap('Ana');
    await expect(table.center.locator('.center__title')).toHaveText('Ana is playing…');
    await expect(table.center.locator('.playbtn--big')).toHaveText(['1 Leadership', '5 Trade']);
    await table.hold('Ana');
    await table.expectToast('Ana: choose which strategy card first');
    await table.center.getByRole('button', { name: 'Never mind' }).click();
    await table.expectActive('Ana');

    await table.doubleTap('Ana');
    await table.center.getByRole('button', { name: '5 Trade' }).click();
    await expect(table.center.locator('.play__name')).toHaveText('Trade');
    await table.primaryDone('Ana');
    for (const name of ['Ben', 'Cleo', 'Dev']) await table.tap(name);
    await table.hold('Ana');
    await expect(table.seat('Ana').locator('.cardpip[data-used]')).toHaveText(['5']);
  });

  await test.step('with one card left the double-tap plays it straight away', async () => {
    for (const [name, card] of [['Ben', 2], ['Cleo', 3], ['Dev', 4]] as const) {
      await table.expectActive(name);
      await table.center.getByRole('button', { name: new RegExp(`Play ${card} `) }).click();
      await table.center.getByRole('button', { name: 'Primary done' }).click();
      await table.center.getByRole('button', { name: "Everyone's done" }).click();
      await table.hold(name);
    }
    await table.expectActive('Ana');
    await expect(table.center.getByRole('button', { name: 'Pass', exact: true }), 'one card still in hand').toBeDisabled();
    await playStrategyCard(table, 'Ana', 1, NAMES);
    await playStrategyCard(table, 'Ben', 6, NAMES);
    await playStrategyCard(table, 'Cleo', 7, NAMES);
    await playStrategyCard(table, 'Dev', 8, NAMES);
  });

  await test.step('round two: every card was taken, so none gathered trade goods', async () => {
    await takeTurn(table, 'Ana');
    await everyonePasses(table, ['Ben', 'Cleo', 'Dev', 'Ana']);
    await page.keyboard.press('Escape');
    await everyoneReady(table, NAMES);
    await table.expectPhase('Strategy');
    await expect(page.locator('.scard__tg')).toHaveCount(0);
    await expect(page.locator('.scard:not([disabled])')).toHaveCount(8);
    const g = await liveGame(page);
    expect(g.round).toBe(2);
    expect(g.players.every((p: { cards: number[]; passed: boolean }) => p.cards.length === 0 && !p.passed)).toBe(true);
  });
});
