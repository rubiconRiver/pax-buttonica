import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Frame, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { FakeApi } from '../e2e/api';
import { inject } from './inject';

/**
 * The two-minute tour. A stage page (stage.html) holds the big screen and two phones as iframes, all running the
 * real app and talking to each other; this script is the puppeteer and the narrator. Real time, real clicks.
 */

const OUT = join(process.cwd(), 'video', 'out');
const PLAYERS = ['Mike', 'Sarah', 'Dave', 'Jen', 'Kyle', 'Steph'];
const beat = (page: Page, ms: number) => page.waitForTimeout(ms);

class Actor {
  readonly ui: FrameLocator;
  constructor(readonly page: Page, readonly name: string) {
    this.ui = page.frameLocator(`iframe[name="${name}"]`);
  }
  get frame(): Frame {
    return this.page.frame({ name: this.name })!;
  }
  private async at(target: Locator) {
    await target.waitFor({ state: 'visible' });
    await target.scrollIntoViewIfNeeded();
    const c = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    return this.page.evaluate(([n, x, y]) => (window as any).stage.toPage(n, x, y), [this.name, c.x, c.y] as const);
  }
  /** Move the way a hand does: quick off the mark, slowing into the target. */
  async glide(target: Locator, ms = 520) {
    const to = await this.at(target);
    const from = cursor;
    const steps = Math.max(8, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const t = 1 - Math.pow(1 - i / steps, 3);
      await this.page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      await beat(this.page, 12);
    }
    cursor = to;
  }
  async click(target: Locator, ms?: number) {
    await this.glide(target, ms);
    await beat(this.page, 120);
    await this.page.mouse.down();
    await beat(this.page, 80);
    await this.page.mouse.up();
  }
  async doubleClick(target: Locator) {
    await this.click(target);
    await beat(this.page, 110);
    await this.page.mouse.down();
    await beat(this.page, 70);
    await this.page.mouse.up();
  }
  async hold(target: Locator, ms = 1150) {
    await this.glide(target);
    await beat(this.page, 150);
    await this.page.mouse.down();
    await beat(this.page, ms);
    await this.page.mouse.up();
  }
  /** Off camera: a DOM click. (Playwright's own click aims wrong inside a CSS-scaled iframe.) */
  async press(target: Locator) {
    await target.waitFor({ state: 'visible' });
    await target.evaluate((el) => (el as HTMLElement).click());
  }
}

let cursor = { x: 960, y: 620 };

test('record the tour', async ({ browser, baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: join(OUT, 'raw'), size: { width: 1920, height: 1080 } },
  });
  await context.addInitScript(inject);
  // The video shows the two-beat strategy card (primary first), which is a setting now, not the default.
  await context.addInitScript(() => { try { if (!localStorage.getItem('pb.settings.v5')) localStorage.setItem('pb.settings.v5', JSON.stringify({ primaryStage: true })); } catch { /* no storage on a blank page */ } });
  // The site, stood in for: the phones read the game and post presses through it.
  await new FakeApi().install(context);
  const page = await context.newPage();
  await page.goto('/video/stage.html');
  const stage = {
    caption: (n: string, html: string) => page.evaluate(([a, b]) => (window as any).stage.caption(a, b), [n, html]),
    title: (on: boolean, p?: string, s?: string) => page.evaluate(([a, b, c]) => (window as any).stage.title(a, b, c), [on, p, s] as const),
    side: (on: boolean) => page.evaluate((a) => (window as any).stage.side(a), on),
    showPhone: (slot: string) => page.evaluate((a) => (window as any).stage.showPhone(a), slot),
  };
  const host = new Actor(page, 'host');
  const dome = (who: string) => host.ui.locator('.seat').filter({ has: host.ui.locator('.plate__name', { hasText: new RegExp(`^${who}$`) }) }).locator('.dev__dome');

  try {
  // ── Before the cameras roll (all of this is cut) ──────────────────────────
  await host.ui.locator('.seatcard__name').first().waitFor();
  await beat(page, 800);
  const clapAt: number = await host.frame.evaluate(() => (window as any).__clap());
  await beat(page, 1200);

  for (const [i, name] of PLAYERS.entries()) await host.ui.locator('.seatcard__name').nth(i).fill(name);
  await host.ui.locator('.setup__options select').selectOption('0');
  await host.press(host.ui.getByRole('button', { name: /Begin round one/ }));
  await host.ui.locator('.center', { hasText: 'Claim your seat' }).waitFor();
  const pill = host.ui.locator('.topbar').getByRole('button', { name: /^[A-Z2-9]{4} · \d+$/ });
  const code = (await pill.innerText()).split(' ')[0].trim();
  await beat(page, 400);
  await page.evaluate(([c]) => Promise.all([(window as any).stage.addPhone('a', 'phone-sarah', "Sarah's phone", `/join/${c}`), (window as any).stage.addPhone('b', 'phone-kyle', "Kyle's phone", `/join/${c}`)]), [code]);
  const sarah = new Actor(page, 'phone-sarah');
  const kyle = new Actor(page, 'phone-kyle');
  await sarah.ui.getByRole('heading', { name: 'Who are you?' }).waitFor();
  await kyle.ui.getByRole('heading', { name: 'Who are you?' }).waitFor();
  await page.mouse.move(cursor.x, cursor.y);
  await beat(page, 1500);

  // ── Action ────────────────────────────────────────────────────────────────
  const startAt = Date.now();
  await beat(page, 4200);
  await stage.caption('Game night', 'Everyone claims a button. They breathe white until somebody presses one.');
  await stage.title(false);
  await beat(page, 2600);
  await stage.side(true);
  await host.click(host.ui.locator('.seat--open .dev__dome').first());
  await beat(page, 1400);

  await stage.caption('No button?', "Your phone is one. <b>Sarah</b> and <b>Kyle</b> scan the code on the screen and say who they are.");
  await host.click(pill);
  await stage.showPhone('a');
  await stage.showPhone('b');
  await beat(page, 2200);
  await sarah.click(sarah.ui.locator('.who-list__item', { hasText: 'Sarah' }));
  await beat(page, 1200);
  await host.frame.locator('body').press('Escape');
  await beat(page, 600);
  await host.click(host.ui.locator('.seat--open .dev__dome').first());
  await beat(page, 900);
  await host.click(host.ui.locator('.seat--open .dev__dome').first());
  await beat(page, 900);
  await kyle.click(kyle.ui.locator('.who-list__item', { hasText: 'Kyle' }));
  await beat(page, 1200);
  await host.click(host.ui.locator('.seat--open .dev__dome').first());
  await beat(page, 2200);

  await stage.caption('Strategy phase', "The chooser's button breathes in their colour. Click the card they take.");
  const card = (n: string) => host.ui.locator('.scard').filter({ has: host.ui.locator('.scard__name', { hasText: new RegExp(`^${n}$`) }) });
  for (const c of ['Politics', 'Leadership', 'Trade', 'Imperial', 'Diplomacy', 'Warfare']) {
    await host.click(card(c), 420);
    await beat(page, 750);
  }
  await beat(page, 1800);

  await stage.caption('Action phase', "Sarah holds Leadership, so she goes first. Her phone glows red: it's her turn, and the whole table can see it.");
  await beat(page, 4200);
  await stage.caption('Strategy card', 'She <b>double-taps</b> to play her strategy card, and the big screen announces it.');
  await sarah.doubleClick(sarah.ui.locator('.dev__dome'));
  await beat(page, 3600);
  await stage.caption('Primary', "Only her button blinks while she does the primary. Everyone else can keep plotting.");
  await beat(page, 3800);
  await stage.caption('Secondary', 'One tap when she’s done, and <b>every other button starts blinking</b>. Your turn to use the secondary, or to say no thanks.');
  await sarah.click(sarah.ui.locator('.dev__dome'));
  await beat(page, 4200);
  await stage.caption('Nobody gets skipped', 'Sarah tries to end her turn early. <b>Refused</b>, and it says who the table is waiting on.');
  await sarah.hold(sarah.ui.locator('.dev__dome'));
  await beat(page, 3000);
  await stage.caption('Nobody gets skipped', 'Each player taps when they’re finished. Buttons settle one by one.');
  await host.click(dome('Mike'));
  await beat(page, 500);
  await host.click(dome('Dave'));
  await beat(page, 500);
  await kyle.click(kyle.ui.locator('.dev__dome'));
  await beat(page, 600);
  await host.click(dome('Jen'));
  await beat(page, 500);
  await host.click(dome('Steph'));
  await beat(page, 1500);
  await stage.caption('All clear', 'Now she can go. <b>Hold for a second</b> to end the turn. No accidental passes.');
  await sarah.hold(sarah.ui.locator('.dev__dome'));
  await beat(page, 1200);
  await stage.caption('Next', "Kyle's phone lights up, and his entrance music plays. Everybody picks their own. Choose wisely.");
  await beat(page, 4200);
  await kyle.hold(kyle.ui.locator('.dev__dome'));
  await beat(page, 2600);

  await stage.caption('Scoreboard', 'Objectives, points and laws, big enough to read from the far end of a TI table.');
  await host.click(host.ui.getByRole('button', { name: 'Scoreboard', exact: true }));
  await beat(page, 1200);
  await host.click(host.ui.getByRole('button', { name: /Reveal a Stage I objective/ }));
  await host.ui.getByPlaceholder(/Search Stage I/).pressSequentially('expand', { delay: 70 });
  await beat(page, 500);
  await host.click(host.ui.locator('.reveal__item').first());
  await beat(page, 900);
  const chip = (who: string) => host.ui.locator('.obj .who-chip', { hasText: new RegExp(`^${who}$`) });
  await host.click(chip('Sarah'));
  await beat(page, 500);
  await host.click(chip('Mike'));
  await beat(page, 1600);
  await stage.caption('Scoreboard', '…and on every phone, for the player who can’t read the cards from where they’re sitting.');
  await kyle.click(kyle.ui.getByRole('button', { name: 'The table' }));
  await beat(page, 4200);
  await kyle.click(kyle.ui.getByRole('button', { name: 'My button' }));
  await host.click(host.ui.getByRole('button', { name: /Back to the table/ }));
  await beat(page, 1000);

  await stage.caption('Several hours later', 'First to ten points takes the throne.');
  const plus = host.ui.getByRole('button', { name: 'Give Mike a point' });
  await host.glide(plus);
  for (let i = 0; i < 9; i++) {
    await page.mouse.down();
    await beat(page, 50);
    await page.mouse.up();
    await beat(page, 170);
  }
  await beat(page, 5200);

  await stage.title(true, 'Try it: <b style="color:#f2b84b">pax-buttonica.vercel.app</b><br/>The buttons are being built. Help wanted.', 'Pax Magnifica, Bellum Gloriosum');
  await beat(page, 5000);
  const endAt = Date.now();

  // ── Cut ───────────────────────────────────────────────────────────────────
  const audio = await host.frame.evaluate(() => (window as any).__audio());
  const video = page.video()!;
  await context.close();
  return finish(video, audio, startAt, clapAt, endAt);
  } catch (e) {
    await page.screenshot({ path: join(OUT, 'raw', 'failure.png') }).catch(() => {});
    await context.close().catch(() => {});
    throw e;
  }
});

async function finish(video: import('@playwright/test').Video, audio: string, startAt: number, clapAt: number, endAt: number) {
  const raw = await video.path();
  const audioPath = join(OUT, 'raw', 'audio.webm');
  writeFileSync(audioPath, Buffer.from(audio, 'base64'));
  writeFileSync(join(OUT, 'raw', 'marks.json'), JSON.stringify({ raw, audioPath, clapAt, startAt, clapToStart: (startAt - clapAt) / 1000, length: (endAt - startAt) / 1000 }, null, 2));
  execFileSync('node', [join(process.cwd(), 'video', 'cut.mjs')], { stdio: 'inherit' });
}
