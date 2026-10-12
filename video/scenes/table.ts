import { scene } from 'showreel/shoot';
import type { FakeApi } from '../../e2e/api';

/**
 * The table: the big screen on the wall and six physical buttons. No phones. One round from claiming to the
 * rainbow, then scoring. The lights are probed from the screen so the drawn buttons show what the real ones would.
 */
const PLAYERS = ['Mike', 'Sarah', 'Dave', 'Jen', 'Kyle', 'Steph'];

export default scene<FakeApi>('table', async ({ set, take }) => {
  const host = await set.screen('host', { url: '/play', label: 'The big screen', audio: true });
  const ui = host.page;
  const seat = (who: string) => ui.locator('.seat').filter({ has: ui.locator('.plate__name', { hasText: new RegExp(`^${who}$`, 'i') }) });
  const dome = (who: string) => seat(who).locator('.dev__dome');
  const openDome = () => ui.locator('.seat--open .dev__dome').first();
  const card = (n: string) => ui.locator('.scard').filter({ has: ui.locator('.scard__name', { hasText: new RegExp(`^${n}$`) }) });
  const keyOf = async (who: string) => (await seat(who).locator('.dev__key').innerText()).trim();

  // What every button shows, ten times a second: the drawing of the table lights its buttons from this.
  set.probe('seats', host, () => Array.from(document.querySelectorAll('.seat')).map((s) => {
    const dev = s.querySelector('.dev');
    const cs = dev ? getComputedStyle(dev) : null;
    return {
      name: s.querySelector('.plate__name')?.textContent?.trim() || undefined,
      mode: dev?.getAttribute('data-mode') || 'off',
      led: cs?.getPropertyValue('--led').trim() || undefined,
      pc: getComputedStyle(s).getPropertyValue('--pc').trim() || undefined,
      active: s.hasAttribute('data-active'),
      passed: s.hasAttribute('data-passed'),
      react: dev?.getAttribute('data-react') || undefined,
      open: s.classList.contains('seat--open'),
    };
  }), 100);

  // ── Setting up, off camera ────────────────────────────────────────────────
  await ui.locator('.seatcard__name').first().waitFor();
  for (const [i, name] of PLAYERS.entries()) await ui.locator('.seatcard__name').nth(i).fill(name);
  await ui.locator('.setup__options select').selectOption('0');
  await host.press(ui.getByRole('button', { name: /Begin round one/ }));
  await ui.locator('.center', { hasText: 'Claim your seat' }).waitFor();
  await host.beat(1500);

  // ── Action ────────────────────────────────────────────────────────────────
  take.mark('start', 'six buttons on the table, breathing white');
  take.say('Game night', 'Six players, six buttons on the table, one screen on the wall. The buttons breathe white until someone claims one.');
  await host.beat(3200);
  take.mark('claim', 'everyone presses their button to claim a seat');
  take.say('Claim a seat', 'Press your button and it takes your colour. The screen matches the seat to the player.');
  for (let i = 0; i < 6; i++) {
    await host.click(openDome(), 300);
    await host.beat(i === 0 ? 1600 : 700);
  }
  await host.beat(1800);

  take.mark('strategy', 'the strategy phase: six cards taken in turn');
  take.say('Strategy phase', "The chooser's button breathes in their colour. Whoever runs the screen clicks the card they take.");
  for (const c of ['Politics', 'Leadership', 'Trade', 'Imperial', 'Diplomacy', 'Warfare']) {
    await host.click(card(c), 420);
    await host.beat(750);
  }
  await host.beat(1500);

  take.mark('turn', "action phase: Sarah's button glows, her turn");
  take.say('Your turn', "Sarah holds Leadership, so she goes first. Her button glows. Everyone at the table can see whose turn it is without looking up.");
  await host.beat(4500);

  take.mark('card', 'double-tap: Sarah plays her strategy card');
  take.say('Double-tap', 'Double-tap to play your strategy card. The screen announces it, and only her button blinks while she does the primary.');
  await host.doubleClick(dome('Sarah'));
  await host.beat(5200);

  take.mark('secondary', "one tap: everyone else's button blinks for the secondary");
  take.say('The secondary', "One tap when she's done. Now <b>every other button blinks</b>: use the secondary, or tap to say no thanks.");
  await host.click(dome('Sarah'), 300);
  await host.beat(4500);

  take.mark('answers', 'the others tap one by one; the last one is waited for');
  take.say('Nobody gets skipped', 'Each player taps when they have answered. The table waits for the last one: nobody misses a secondary again.');
  for (const who of ['Mike', 'Dave', 'Kyle', 'Jen']) {
    await host.click(dome(who), 300);
    await host.beat(700);
  }
  await host.beat(1200);
  await host.click(dome('Steph'), 300);
  await host.beat(1800);

  take.mark('end-turn', 'hold to end the turn');
  take.say('Hold to end', "<b>Hold for a second</b> to end your turn. A tap won't do it, so nobody passes by accident.");
  await host.hold(dome('Sarah'));
  await host.beat(800);
  take.mark('next', "Kyle's button lights up with his entrance effect");
  take.say('Next', "Kyle's button lights up, with the effect he picked. The screen plays his music. The game moves without anyone saying a word.");
  await host.beat(4500);

  // The rest of the round, fast: every card played, every turn ended, every player passing.
  take.mark('montage', 'the rest of the round, every card played, everyone passes');
  take.say('Several turns later', 'Round one plays out: every card gets played, every turn ends with a hold.');
  const phase = async () => (await ui.locator('.phases__step[data-on]').innerText()).trim().toLowerCase();
  const active = async () => (await ui.locator('.center__active').innerText().catch(() => '')).trim();
  const playButton = ui.locator('.center').getByRole('button', { name: /^Play/ });
  for (let turns = 0; turns < 14 && (await phase()) === 'action'; turns++) {
    const who = await active();
    if (!who) break;
    const k = await keyOf(who);
    if (await playButton.isVisible().catch(() => false)) {
      await host.key(k); await host.beat(110); await host.key(k);            // double-tap: the card
      await host.beat(900);
      await host.key(k);                                                      // primary done
      await host.beat(500);
      for (const other of PLAYERS) if (other !== who) { await host.key(await keyOf(other)); await host.beat(220); }
      await host.beat(600);
      await host.keyHold(k, 1100);                                            // end the turn
      await host.beat(900);
    } else {
      await host.press(ui.getByRole('button', { name: 'Pass', exact: true }));  // nothing left: pass
      await host.beat(700);
    }
  }

  take.mark('rainbow', 'everyone has passed: every button goes rainbow');
  take.say('Round over', 'When the last player passes, <b>every button goes rainbow</b>. Time to score.');
  await host.beat(4200);
  take.mark('scoring', 'scoring, one button at a time in initiative order');
  take.say('Scoring', "Then one button at a time, in initiative order: your button pulses, you say what you scored, and tap when you're done.");
  // The scorer's button pulses; a tap on it says "done" and the next one lights up.
  const scorer = () => ui.locator('.seat').filter({ has: ui.locator('.dev[data-mode="pulse"]') }).first().locator('.dev__dome');
  for (let i = 0; i < 2; i++) {
    await scorer().waitFor({ timeout: 8000 }).catch(() => {});
    if (!(await scorer().isVisible().catch(() => false))) break;
    await host.beat(1800);
    await host.click(scorer(), 300);
  }
  await host.beat(1500);
  take.hush();
  take.mark('end', 'the round scored');
  await host.beat(1500);
});
