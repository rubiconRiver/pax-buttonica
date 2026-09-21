import { expect, type Table } from './helpers';

export const CARDS: Record<number, string> = {
  1: 'Leadership',
  2: 'Diplomacy',
  3: 'Politics',
  4: 'Construction',
  5: 'Trade',
  6: 'Warfare',
  7: 'Technology',
  8: 'Imperial',
};

export type Picks = [player: string, card: number][];

export const scard = (table: Table, card: number) =>
  table.page.locator('.scard').filter({ has: table.page.locator('.scard__name', { hasText: new RegExp(`^${CARDS[card]}$`) }) });

/** Strategy phase: each chooser in turn breathes, and the host clicks the card they took. */
export async function pickCards(table: Table, picks: Picks) {
  await table.expectPhase('Strategy');
  for (const [name, card] of picks) {
    await expect(table.center.locator('.center__title')).toHaveText(`${name} is choosing`);
    await table.expectLights({ [name]: 'pulse' });
    await scard(table, card).click();
  }
}

/** Seats in the order they act: lowest card first. */
export const initiativeOrder = (picks: Picks): string[] => {
  const lowest = new Map<string, number>();
  for (const [name, card] of picks) lowest.set(name, Math.min(card, lowest.get(name) ?? 99));
  return [...lowest.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
};

interface PlayOptions {
  /** Also prove that the owner is locked in during both beats. */
  tryToLeaveEarly?: boolean;
  /** Who answers the secondary from the big screen instead of their own button. */
  ackOnScreen?: string[];
  /** Players who have already passed (their lights are off, not dim, during the primary). */
  passed?: string[];
}

/**
 * The rule the whole project exists for. The owner double-taps; only their button blinks while they do the
 * primary; they tap; everyone else blinks until each has tapped; only then can the owner end the turn.
 */
export async function playStrategyCard(table: Table, owner: string, card: number, everyone: string[], opts: PlayOptions = {}) {
  const others = everyone.filter((n) => n !== owner);
  const passed = opts.passed ?? [];
  await table.expectActive(owner);

  await table.doubleTap(owner);
  await expect(table.banner).toContainText(`${card} · ${CARDS[card]}`);
  await expect(table.banner).toContainText(`${owner} plays their strategy card`);
  await expect(table.center.locator('.play__name')).toHaveText(CARDS[card]);
  await expect(table.center.locator('.play__by')).toContainText(owner);
  await expect(table.center.locator('.ability__label')).toHaveText('Primary ability');
  await table.expectLights({ [owner]: 'flash', ...Object.fromEntries(others.map((n) => [n, passed.includes(n) ? 'off' : 'dim'])) });

  if (opts.tryToLeaveEarly) {
    await table.hold(owner);
    await table.expectToast(/finish the primary first/i);
    await expect(table.center.locator('.ability__label')).toHaveText('Primary ability');
  }

  await table.primaryDone(owner);
  await expect(table.center.locator('.ability__label')).toHaveText('Secondary ability');
  await table.expectLights({ [owner]: 'solid', ...Object.fromEntries(others.map((n) => [n, 'flash'])) });

  if (opts.tryToLeaveEarly) {
    await table.hold(owner);
    await table.expectToast(new RegExp(`waiting on ${others.join(', ')}`, 'i'));
  }

  for (const [i, name] of others.entries()) {
    await expect(table.center.locator('.center__status')).toContainText(`Waiting on ${others.length - i}`);
    if (opts.ackOnScreen?.includes(name)) await table.center.locator('.ackpip').filter({ hasText: name }).click();
    else await table.tap(name);
    await table.expectLights({ [name]: 'dim' });
    await expect(table.center.locator('.ackpip').filter({ hasText: name })).toHaveAttribute('data-done', 'true');
  }

  await expect(table.center.locator('.center__status')).toContainText('All clear');
  await table.expectLights({ [owner]: 'pulse' });
  await table.hold(owner);
}

/** A plain turn: do something on the board, hold to end. */
export async function takeTurn(table: Table, name: string) {
  await table.expectActive(name);
  await table.hold(name);
}

/** One-button players pass from the big screen. */
export async function pass(table: Table, name: string) {
  await table.expectActive(name);
  await table.center.getByRole('button', { name: 'Pass', exact: true }).click();
  await expect(table.seat(name)).toHaveAttribute('data-passed', 'true');
}

/** Everyone passes in turn; each button goes dark, and the last pass ends the action phase. */
export async function everyonePasses(table: Table, order: string[]) {
  for (const [i, name] of order.entries()) {
    await pass(table, name);
    if (i < order.length - 1) await table.expectLights({ [name]: 'off' });
  }
  await table.expectPhase('Status');
}

/** Status phase: everyone breathes white until they tap in. */
export async function everyoneReady(table: Table, names: string[]) {
  await table.expectPhase('Status');
  for (const [i, name] of names.entries()) {
    await table.expectLights({ [name]: 'pulse' });
    await table.tap(name);
    if (i < names.length - 1) await table.expectLights({ [name]: 'dim' });
  }
}

/** One agenda: voting goes round from the speaker's left, the speaker last. */
export async function voteRound(table: Table, order: string[]) {
  for (const name of order) {
    await expect(table.center.locator('.voter[data-state="now"]')).toHaveText(name);
    await table.expectLights({ [name]: 'pulse' });
    await table.tap(name);
  }
}
