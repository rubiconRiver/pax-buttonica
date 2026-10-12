import { scene, type Actor } from 'showreel/shoot';
import type { Locator } from 'playwright';
import type { FakeApi } from '../../e2e/api';

/**
 * The two-minute tour: the big screen and two phones, a whole round of a game. One long take; the edits pick from it.
 */
const PLAYERS = ['Mike', 'Sarah', 'Dave', 'Jen', 'Kyle', 'Steph'];

export default scene<FakeApi>('tour', async ({ set, take }) => {
  const host = await set.screen('host', { url: '/play', label: 'The big screen', audio: true });
  const ui = host.page;
  const dome = (who: string) => ui.locator('.seat').filter({ has: ui.locator('.plate__name', { hasText: new RegExp(`^${who}$`) }) }).locator('.dev__dome');
  const openDome = () => ui.locator('.seat--open .dev__dome').first();
  const card = (n: string) => ui.locator('.scard').filter({ has: ui.locator('.scard__name', { hasText: new RegExp(`^${n}$`) }) });
  const chip = (who: string) => ui.locator('.obj .who-chip', { hasText: new RegExp(`^${who}$`) });

  // ── Setting up, off camera ────────────────────────────────────────────────
  await ui.locator('.seatcard__name').first().waitFor();
  for (const [i, name] of PLAYERS.entries()) await ui.locator('.seatcard__name').nth(i).fill(name);
  await ui.locator('.setup__options select').selectOption('0');
  await host.press(ui.getByRole('button', { name: /Begin round one/ }));
  await ui.locator('.center', { hasText: 'Claim your seat' }).waitFor();
  const pill = ui.locator('.topbar').getByRole('button', { name: /^[A-Z2-9]{4} · \d+$/ });
  const code = (await pill.innerText()).split(' ')[0].trim();
  const sarah = await set.phone('sarah', { url: `/join/${code}`, label: "Sarah's phone", hidden: true });
  const kyle = await set.phone('kyle', { url: `/join/${code}`, label: "Kyle's phone", hidden: true });
  await sarah.page.getByRole('heading', { name: 'Who are you?' }).waitFor();
  await kyle.page.getByRole('heading', { name: 'Who are you?' }).waitFor();
  await host.beat(1500);

  // ── Action ────────────────────────────────────────────────────────────────
  take.mark('start', 'six seats, nobody claimed, buttons breathing white');
  await host.beat(1500);
  take.say('Game night', 'Everyone claims a button. They breathe white until somebody presses one.');
  await host.beat(2200);
  await host.click(openDome());
  await host.beat(1400);

  take.mark('phones', 'two players join on their phones');
  take.say('No button?', 'Your phone is one. <b>Sarah</b> and <b>Kyle</b> scan the code on the screen and say who they are.');
  await host.click(pill);
  set.show('sarah');
  set.show('kyle');
  await host.beat(2200);
  await sarah.click(sarah.page.locator('.who-list__item', { hasText: 'Sarah' }));
  await host.beat(1200);
  await host.key('Escape');
  await host.beat(600);
  await host.click(openDome());
  await host.beat(900);
  await host.click(openDome());
  await host.beat(900);
  await kyle.click(kyle.page.locator('.who-list__item', { hasText: 'Kyle' }));
  await host.beat(1200);
  await host.click(openDome());
  await host.beat(2200);

  take.mark('strategy', 'the strategy phase: six cards taken in turn');
  take.say('Strategy phase', "The chooser's button breathes in their colour. Click the card they take.");
  for (const c of ['Politics', 'Leadership', 'Trade', 'Imperial', 'Diplomacy', 'Warfare']) {
    await host.click(card(c), 420);
    await host.beat(750);
  }
  await host.beat(1800);

  take.mark('action', "the action phase: Sarah's turn, her phone glows red");
  take.say('Action phase', "Sarah holds Leadership, so she goes first. Her phone glows red: it's her turn, and the whole table can see it.");
  await take.look(sarah, sarah.page.locator('.dev'), 3500);
  await host.beat(4200);

  take.mark('card', 'Sarah double-taps to play her strategy card');
  take.say('Strategy card', 'She <b>double-taps</b> to play her strategy card, and the big screen announces it.');
  await sarah.doubleClick(sarah.page.locator('.dev__dome'));
  await host.beat(3600);
  take.say('Primary', 'Only her button blinks while she does the primary. Everyone else can keep plotting.');
  await host.beat(3800);

  take.mark('secondary', 'one tap: every other button blinks for the secondary');
  take.say('Secondary', 'One tap when she’s done, and <b>every other button starts blinking</b>. Your turn to use the secondary, or to say no thanks.');
  await sarah.click(sarah.page.locator('.dev__dome'));
  await host.beat(4200);

  take.mark('refused', 'Sarah tries to end her turn early and is refused');
  take.say('Nobody gets skipped', 'Sarah tries to end her turn early. <b>Refused</b>, and it says who the table is waiting on.');
  await sarah.hold(sarah.page.locator('.dev__dome'));
  await host.beat(3000);

  take.mark('answers', 'each player taps when finished with the secondary');
  take.say('Nobody gets skipped', 'Each player taps when they’re finished. Buttons settle one by one.');
  await host.click(dome('Mike'));
  await host.beat(500);
  await host.click(dome('Dave'));
  await host.beat(500);
  await kyle.click(kyle.page.locator('.dev__dome'));
  await host.beat(600);
  await host.click(dome('Jen'));
  await host.beat(500);
  await host.click(dome('Steph'));
  await host.beat(1500);

  take.mark('allclear', 'Sarah holds to end her turn');
  take.say('All clear', 'Now she can go. <b>Hold for a second</b> to end the turn. No accidental passes.');
  await sarah.hold(sarah.page.locator('.dev__dome'));
  await host.beat(1200);

  take.mark('next', "Kyle's turn: his phone lights up and his music plays");
  take.say('Next', "Kyle's phone lights up, and his entrance music plays. Everybody picks their own. Choose wisely.");
  await take.look(kyle, kyle.page.locator('.dev'), 3500);
  await host.beat(4200);
  await kyle.hold(kyle.page.locator('.dev__dome'));
  await host.beat(2600);

  take.mark('scoreboard', 'the scoreboard: revealing an objective and scoring it');
  take.say('Scoreboard', 'Objectives, points and laws, big enough to read from the far end of a TI table.');
  await host.click(ui.getByRole('button', { name: 'Scoreboard', exact: true }));
  await host.beat(1200);
  await host.click(ui.getByRole('button', { name: /Reveal a Stage I objective/ }));
  await host.type(ui.getByPlaceholder(/Search Stage I/), 'expand');
  await host.beat(500);
  await host.click(ui.locator('.reveal__item').first());
  await host.beat(900);
  await host.click(chip('Sarah'));
  await host.beat(500);
  await host.click(chip('Mike'));
  await host.beat(1600);

  take.mark('phone-board', "the scoreboard on Kyle's phone");
  take.say('Scoreboard', '…and on every phone, for the player who can’t read the cards from where they’re sitting.');
  await kyle.click(kyle.page.getByRole('button', { name: 'The table' }));
  await take.look(kyle, kyle.page.locator('body'), 3500);
  await host.beat(4200);
  await kyle.click(kyle.page.getByRole('button', { name: 'My button' }));
  await host.click(ui.getByRole('button', { name: /Back to the table/ }));
  await host.beat(1000);

  take.mark('points', 'Mike gets nine points and wins');
  take.say('Several hours later', 'First to ten points takes the throne.');
  await host.glide(ui.getByRole('button', { name: 'Give Mike a point' }));
  for (let i = 0; i < 9; i++) {
    await host.clickAgain(50);
    await host.beat(170);
  }
  await host.beat(5200);
  take.hush();
  take.mark('end', 'the throne taken');
  await host.beat(1500);
});
