import { expect, test as base, type Locator, type Page } from '@playwright/test';

/** The default hold-to-end-turn time. Tests run against the real default, not a shortened one. */
export const HOLD_MS = 900;
/** Engine: a tap this soon after the double-tap that played the card is ignored. */
export const PRIMARY_GUARD_MS = 600;

export type Light = 'off' | 'dim' | 'solid' | 'pulse' | 'flash' | 'rainbow';

const IGNORED_CONSOLE = [
  /Failed to load resource/, // the /api and PeerJS stubs below answer with errors on purpose
  /AudioContext/,
  /navigator\.vibrate/, // Chrome refuses to buzz before the first touch, and says so loudly
];

/**
 * Every test gets:
 *  - a clock that only moves when the test says so: a hold takes no time at all, and is exactly as long as it says;
 *  - no network beyond the dev server: /api answers "offline" (exactly what Vite dev does in spirit)
 *    unless a test installs FakeApi, and Google Fonts are blocked;
 *  - a tripwire: any uncaught exception or console.error fails the test.
 */
export const test = base.extend<{ problems: string[] }>({
  context: async ({ context }, use) => {
    // Time stands still unless a test moves it, so "0.8 seconds" means exactly that however busy the machine is.
    const t0 = new Date('2026-10-03T19:00:00-04:00').getTime();
    await context.clock.install({ time: t0 });
    await context.clock.pauseAt(t0 + 1000);
    await context.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'text/plain', body: 'offline' }));
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    // The two-beat strategy card (primary first, then secondaries) is what most of these tests exercise, so they run as a
    // table that has ticked it. A browser with any saved settings, of any version, is left alone; strategy-card.spec.ts
    // covers the real default, where everyone is called at once.
    await context.addInitScript(() => {
      try {
        if (Object.keys(localStorage).some((k) => k.startsWith('pb.settings.'))) return;
        localStorage.setItem('pb.settings.v5', JSON.stringify({ primaryStage: true }));
      } catch {
        // A blank or sandboxed document has no storage: nothing to seed.
      }
    });
    await use(context);
  },
  problems: [
    async ({ context }, use) => {
      const problems: string[] = [];
      const watch = (page: Page) => {
        page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
        page.on('console', (m) => {
          if (m.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(m.text()))) problems.push(`console.error: ${m.text()}`);
        });
      };
      context.pages().forEach(watch);
      context.on('page', watch);
      await use(problems);
      expect(problems, 'the page logged errors').toEqual([]);
    },
    { auto: true },
  ],
});

/** Set a range slider the way a drag would: React only notices a native value change followed by an input event. */
export async function setSlider(slider: Locator, value: number) {
  await slider.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/** The demo: six Canadians mid-game, Dave (seat three, three-button device) to act. */
export const DEMO = ['Mike', 'Sarah', 'Dave', 'Jen', 'Kyle', 'Steph'];
/** Demo initiative order: Dave 1, Kyle 2, Mike 3, Sarah 5, Steph 6, Jen 8. */
export const DEMO_ORDER = ['Dave', 'Kyle', 'Mike', 'Sarah', 'Steph', 'Jen'];

export async function openDemo(page: Page, { tour = false } = {}) {
  await page.goto('/demo');
  const table = new Table(page);
  await table.expectActive('Dave');
  if (!tour) await page.getByRole('button', { name: 'Close the tour' }).click();
  return table;
}

export const lab = (page: Page, label: string) => page.locator('.lab').getByRole('button', { name: label, exact: true });

export async function openSettings(page: Page): Promise<Locator> {
  await page.getByTitle('Settings', { exact: true }).click();
  const panel = page.locator('.popover').filter({ hasText: 'Hold to end turn' });
  await expect(panel).toBeVisible();
  return panel;
}

export { expect };

/** Put values in localStorage before the app boots, once (so a reload keeps whatever the app wrote since). */
export async function seedStorage(page: Page, entries: Record<string, unknown>) {
  await page.addInitScript((e) => {
    if (sessionStorage.getItem('e2e.seeded')) return;
    sessionStorage.setItem('e2e.seeded', '1');
    // A test that brings its own settings (of any version) replaces the ones the fixture put there.
    if (Object.keys(e).some((k) => k.startsWith('pb.settings.'))) for (const k of Object.keys(localStorage)) if (k.startsWith('pb.settings.')) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, entries);
}

export const readStorage = <T = any>(page: Page, key: string): Promise<T | null> =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

/** The live game as the app has persisted it. */
export const liveGame = async (page: Page) => (await readStorage(page, 'pb.game.v4'))?.game ?? null;
/** The whole slot: base, events, game. */
export const liveSlot = (page: Page) => readStorage(page, 'pb.game.v4');

const exact = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/** The table: seats, their buttons, and the gestures players make on them. */
export class Table {
  constructor(readonly page: Page) {}

  seat(name: string): Locator {
    return this.page.locator('.seat').filter({ has: this.page.locator('.plate__name', { hasText: exact(name) }) });
  }
  /** The glowing button itself; its data-mode is the light. */
  light(name: string): Locator {
    return this.seat(name).locator('.dev');
  }
  dome(name: string): Locator {
    return this.seat(name).locator('.dev__dome');
  }
  get center(): Locator {
    return this.page.locator('.center');
  }
  get toast(): Locator {
    return this.page.locator('.toast');
  }
  get banner(): Locator {
    return this.page.locator('.banner');
  }
  get log(): Locator {
    return this.page.locator('.side__log .log');
  }
  roster(name: string): Locator {
    return this.page.locator('.roster__row').filter({ has: this.page.locator('.roster__name', { hasText: exact(name) }) });
  }

  /** The number key that presses this player's on-screen button (keys follow table spots, not seat order). */
  async key(name: string): Promise<string> {
    return (await this.seat(name).locator('.dev__key').innerText()).trim();
  }

  private async blur() {
    await this.page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  }

  /** A short press. Time is nudged first so two taps in a row never read as a double-tap. */
  async tap(name: string) {
    await this.tapKey(await this.key(name));
  }
  async tapKey(key: string) {
    await this.blur();
    await this.page.clock.fastForward(450);
    await this.page.keyboard.down(key);
    await this.page.keyboard.up(key);
  }
  async doubleTap(name: string) {
    const key = await this.key(name);
    await this.blur();
    await this.page.clock.fastForward(450);
    await this.page.keyboard.down(key);
    await this.page.keyboard.up(key);
    await this.page.clock.fastForward(120);
    await this.page.keyboard.down(key);
    await this.page.keyboard.up(key);
  }
  /** Press, let `ms` go by, release. */
  async hold(name: string, ms = HOLD_MS + 50) {
    const key = await this.key(name);
    await this.blur();
    await this.page.clock.fastForward(450);
    await this.page.keyboard.down(key);
    await this.page.clock.fastForward(ms);
    await this.page.keyboard.up(key);
  }
  /** The owner's "I'm done with the primary" tap, after the guard that ignores a stray third tap. */
  async primaryDone(name: string) {
    await this.page.clock.fastForward(PRIMARY_GUARD_MS + 100);
    await this.tap(name);
  }

  async expectLights(lights: Record<string, Light>) {
    for (const [name, mode] of Object.entries(lights)) {
      await expect(this.light(name), `${name}'s light`).toHaveAttribute('data-mode', mode);
    }
  }
  async expectActive(name: string) {
    await expect(this.center.locator('.center__active')).toHaveText(name);
    await expect(this.light(name)).toHaveAttribute('data-mode', 'pulse');
  }
  async expectPhase(label: 'Strategy' | 'Action' | 'Status' | 'Agenda') {
    await expect(this.page.locator('.phases__step[data-on]')).toHaveText(label);
  }
  async expectToast(text: string | RegExp) {
    await expect(this.toast).toContainText(text);
  }
  async expectVp(name: string, vp: number) {
    await expect(this.seat(name).locator('.plate__vp')).toHaveText(`${vp}VP`);
  }
}

export interface NewGame {
  names: string[];
  vp?: 10 | 12 | 14;
  /** Seat index of the first speaker; without it the app picks at random. */
  speaker?: number;
}

/** Fill in the setup screen and begin. Leaves the game at seat claiming. */
export async function setUpGame(page: Page, { names, vp = 10, speaker = 0 }: NewGame) {
  await page.goto('/play');
  await page.locator('.setup__options .opt').filter({ hasText: 'Players' }).getByRole('button', { name: String(names.length), exact: true }).click();
  await page.locator('.setup__options .opt').filter({ hasText: 'Victory points' }).getByRole('button', { name: String(vp), exact: true }).click();
  for (const [i, name] of names.entries()) await page.locator('.seatcard__name').nth(i).fill(name);
  await page.locator('.setup__options select').selectOption(String(speaker));
  await page.getByRole('button', { name: /Begin round one/ }).click();
  await expect(page.locator('.center')).toContainText('Claim your seat');
}

/** Everyone claims the button in front of them, in seat order: seat one gets key 1, and so on. */
export async function claimSeatsInOrder(page: Page, names: string[]) {
  const table = new Table(page);
  for (const [i, name] of names.entries()) {
    await expect(table.center.locator('.center__active')).toHaveText(name);
    await table.tapKey(String(i + 1));
  }
  await expect(table.center).not.toContainText('Claim your seat');
}

/** The scoreboard overlay on the host screen. */
export class Board {
  constructor(readonly page: Page) {}
  get root(): Locator {
    return this.page.locator('.boardwrap');
  }
  stand(name: string): Locator {
    return this.root.locator('.stand').filter({ has: this.page.locator('.stand__name', { hasText: exact(name) }) });
  }
  objective(name: string): Locator {
    return this.root.locator('.obj').filter({ has: this.page.locator('.obj__head b', { hasText: exact(name) }) });
  }
  async open() {
    if (!(await this.root.isVisible())) await this.page.getByRole('button', { name: 'Scoreboard', exact: true }).click();
    await expect(this.root).toBeVisible();
  }
  async close() {
    // It may be on its way out already (it closes itself when the status phase ends).
    if (await this.root.isVisible()) await this.root.getByRole('button', { name: /Back to the table/ }).click({ timeout: 2000 }).catch(() => {});
    await expect(this.root).toBeHidden();
  }
  async reveal(stage: 1 | 2, name: string) {
    const col = this.root.locator(`.board__col[data-stage="${stage}"]`);
    await col.getByRole('button', { name: /\+ Reveal a Stage/ }).click();
    await col.getByPlaceholder(/Search Stage/).fill(name.slice(0, 8));
    await col.locator('.reveal__item').filter({ hasText: name }).click();
    await expect(this.objective(name)).toBeVisible();
  }
  /** Toggle a player's chip on an objective. */
  async score(objective: string, player: string) {
    await this.objective(objective).locator('.who-chip').filter({ hasText: exact(player) }).click();
  }
  other(name: string): Locator {
    return this.root.locator('.other').filter({ has: this.page.locator('.other__name', { hasText: exact(name) }) });
  }
  async addSecret(player: string, label = '') {
    const row = this.other(player);
    await row.getByRole('button', { name: '+ add' }).click();
    if (label) await row.getByPlaceholder(/Secret objective/).fill(label);
    await row.getByRole('button', { name: '+1 secret' }).click();
  }
  async addExtra(player: string, source: string, sign: '+1' | '−1' = '+1') {
    const row = this.other(player);
    await row.getByRole('button', { name: '+ add' }).click();
    await row.getByLabel('Where the point came from').fill(source);
    await row.getByRole('button', { name: sign, exact: true }).click();
  }
  async addLaw(name: string, note = '') {
    const form = this.root.locator('.addlaw');
    await form.getByPlaceholder('Law').fill(name);
    if (note) await form.getByPlaceholder(/Who or what/).fill(note);
    await form.getByRole('button', { name: 'Add law' }).click();
  }
  async expectVp(name: string, vp: number) {
    await expect(this.stand(name).locator('.stand__vp')).toHaveText(String(vp));
  }
}
