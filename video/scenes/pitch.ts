import { scene } from 'showreel/shoot';
import type { FakeApi } from '../../e2e/api';

/**
 * The pitch: the happy path of a turn, twice, mid-game. No set-up on camera, nothing refused. Sarah plays
 * Leadership, everyone answers in their own time, she holds and the table moves on; then Kyle does the same.
 */
const PLAYERS = ['Mike', 'Sarah', 'Dave', 'Jen', 'Kyle', 'Steph'];

export default scene<FakeApi>('pitch', async ({ set, take }) => {
  const host = await set.screen('host', { url: '/play', label: 'The big screen', audio: true });
  const ui = host.page;
  const seat = (who: string) => ui.locator('.seat').filter({ has: ui.locator('.plate__name', { hasText: new RegExp(`^${who}$`, 'i') }) });
  const dome = (who: string) => seat(who).locator('.dev__dome');
  const card = (n: string) => ui.locator('.scard').filter({ has: ui.locator('.scard__name', { hasText: new RegExp(`^${n}$`) }) });

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

  // ── Off camera: names, seats, the strategy phase ──────────────────────────
  await ui.locator('.seatcard__name').first().waitFor();
  for (const [i, name] of PLAYERS.entries()) await ui.locator('.seatcard__name').nth(i).fill(name);
  await ui.locator('.setup__options select').selectOption('0');
  await host.press(ui.getByRole('button', { name: /Begin round one/ }));
  await ui.locator('.center', { hasText: 'Claim your seat' }).waitFor();
  // Domes answer to real presses, not DOM clicks; these happen before the first mark, so no edit shows them.
  for (let i = 0; i < 6; i++) { await host.click(ui.locator('.seat--open .dev__dome').first(), 120); await host.beat(250); }
  for (const c of ['Politics', 'Leadership', 'Trade', 'Imperial', 'Diplomacy', 'Warfare']) { await host.click(card(c), 120); await host.beat(300); }
  await ui.locator('.center__active', { hasText: 'Sarah' }).waitFor();
  await host.beat(2500);

  // ── A turn, the way it goes ───────────────────────────────────────────────
  const answers = async (owner: string, gaps: number[]) => {
    const others = PLAYERS.filter((p) => p !== owner);
    for (const [i, who] of others.entries()) {
      await host.beat(gaps[i]);
      await host.click(dome(who), 260);
    }
  };

  take.mark('turn', "Sarah's button glows: her turn");
  take.say('Your turn', "Sarah's button glows. Everyone at the table knows whose turn it is.");
  await host.beat(3800);

  take.mark('card', 'double-tap: Leadership is played');
  take.say('Strategy card', 'Double-tap. <b>Leadership</b> is played, and the screen announces it to the room.');
  await host.doubleClick(dome('Sarah'));
  await host.beat(4600);

  take.mark('secondary', 'one tap: every other button lights for the secondary');
  take.say('Everyone’s in', 'One tap when the primary is done, and <b>every other button lights up</b>: the secondary is open.');
  await host.click(dome('Sarah'), 260);
  await host.beat(3400);

  take.mark('answers', 'each player taps in their own time');
  take.say('In your own time', 'Each player taps when they have taken their secondary. Buttons settle one by one.');
  await answers('Sarah', [600, 1900, 700, 2400, 1300]);
  await host.beat(1600);

  take.mark('go', 'everyone has pressed: Sarah holds, the next button lights');
  take.say('All in', 'Once everyone has pressed, Sarah <b>holds</b> to end her turn, and the next button lights up by itself.');
  await host.hold(dome('Sarah'));
  await host.beat(3800);

  take.mark('next', "Kyle's turn: Diplomacy, the same rhythm");
  take.say('Next', 'Kyle’s turn. He double-taps for <b>Diplomacy</b>, the table answers, he holds. No announcing, no asking.');
  await host.beat(1400);
  await host.doubleClick(dome('Kyle'));
  await host.beat(2600);
  await host.click(dome('Kyle'), 260);
  await answers('Kyle', [900, 500, 1600, 800, 1100]);
  await host.beat(1200);
  await host.hold(dome('Kyle'));
  await host.beat(2400);

  take.mark('flow', "Mike's turn: the table just flows");
  take.say('The table just flows', 'Every turn, every card, every secondary, with nobody keeping track but the buttons.');
  await host.beat(3600);
  take.hush();
  take.mark('end', 'done');
  await host.beat(1500);
});
