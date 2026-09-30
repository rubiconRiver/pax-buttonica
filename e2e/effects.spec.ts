import { DEMO, DEMO_ORDER, expect, openDemo, openSettings, test } from './helpers';

/**
 * What a button does the moment its turn starts: the table picks a default, and each player can pick their own from
 * their phone (phones.spec.ts covers that side, and the preview that shows on the big screen).
 */

test('the table\'s start-of-turn effect: none by default, then whatever the host picks', async ({ page }) => {
  const table = await openDemo(page);
  const [dave, kyle, mike, sarah, steph, jen] = DEMO_ORDER;
  await table.hold(dave);
  await table.expectActive(kyle);
  await expect(table.light(kyle), 'no effect: the light itself does the work').not.toHaveAttribute('data-react');

  let panel = await openSettings(page);
  await expect(panel.getByRole('radio', { name: 'None', exact: true })).toHaveAttribute('aria-checked', 'true');
  await panel.getByRole('radio', { name: 'Ring', exact: true }).click();
  await page.keyboard.press('Escape');
  await table.hold(kyle);
  await table.expectActive(mike);
  await expect(table.light(mike), 'the ring: the burst every button has always done').toHaveAttribute('data-react', 'burst');
  await expect(table.light(mike).locator('.dev__shock')).toHaveCount(1);
  await table.hold(mike);
  await table.expectActive(sarah);
  await table.hold(sarah);
  await table.expectActive(steph);
  await table.hold(steph);
  await table.expectActive(jen);
  await table.hold(jen);
  await table.expectActive(dave);
  await table.hold(dave);
  await table.expectActive(kyle);
  panel = await openSettings(page);
  await panel.getByRole('radio', { name: 'Sparkles' }).click();
  await page.keyboard.press('Escape');
  await table.hold(kyle);
  await table.expectActive(mike);
  await expect(table.light(mike)).toHaveAttribute('data-react', 'sparkle');
  await expect(table.light(mike).locator('.dev__fx--stars i')).toHaveCount(10);
  // One-shots are over in about a second.
  await page.clock.fastForward(1100);
  await expect(table.light(mike)).not.toHaveAttribute('data-react');
  await expect(table.light(mike).locator('.dev__fx')).toHaveCount(0);

  await (await openSettings(page)).getByRole('radio', { name: 'Rainbow' }).click();
  await page.keyboard.press('Escape');
  await table.hold(mike);
  await table.expectActive(sarah);
  await expect(table.light(sarah)).toHaveAttribute('data-react', 'rainbow');

  await (await openSettings(page)).getByRole('radio', { name: 'Ripple' }).click();
  await page.keyboard.press('Escape');
  await table.hold(sarah);
  await table.expectActive(steph);
  await expect(table.light(steph)).toHaveAttribute('data-react', 'ripple');
  await expect(table.light(steph).locator('.dev__fx--rings i')).toHaveCount(2);

  await (await openSettings(page)).getByRole('radio', { name: 'None' }).click();
  await page.keyboard.press('Escape');
  await table.hold(steph);
  await table.expectActive('Jen');
  await expect(table.light('Jen')).not.toHaveAttribute('data-react');
  // The setting sticks.
  await page.reload();
  await expect((await openSettings(page)).getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true');
});

/** Every effect in the catalogue, in the order the settings list them; the ring draws as the burst, none draws nothing. */
const CATALOGUE: [name: string, react: string | null][] = [
  ['Ring', 'burst'], ['Ripple', 'ripple'], ['Sparkles', 'sparkle'], ['Rainbow', 'rainbow'], ['Cop lights', 'cop'], ['Explosion', 'explosion'],
  ['Fireworks', 'fireworks'], ['Lightning', 'lightning'], ['Fire', 'fire'], ['Siren', 'siren'], ['Laser', 'laser'], ['Comet', 'comet'],
  ['Warp', 'warp'], ['Confetti', 'confetti'], ['Disco', 'disco'], ['Glitch', 'glitch'], ['Neon', 'neon'], ['Alarm', 'alarm'], ['Thump', 'thump'], ['None', null],
];

test('every effect in the catalogue plays on the next player\'s button, then clears', async ({ page }) => {
  test.setTimeout(120_000);
  const table = await openDemo(page);
  let turn = 0;
  for (const [name, react] of CATALOGUE) {
    const panel = await openSettings(page);
    await panel.getByRole('radiogroup', { name: 'Start of turn' }).getByRole('radio', { name, exact: true }).click();
    await page.keyboard.press('Escape');
    const now = DEMO_ORDER[turn % 6];
    const next = DEMO_ORDER[(turn + 1) % 6];
    await table.hold(now);
    await table.expectActive(next);
    if (react) await expect(table.light(next), `${name} on ${next}`).toHaveAttribute('data-react', react);
    else await expect(table.light(next), `${name} on ${next}`).not.toHaveAttribute('data-react');
    // Particles, for the effects that have them, come and go with it.
    const particles = await table.light(next).locator('.dev__fx i').count();
    await page.clock.fastForward(1800);
    await expect(table.light(next)).not.toHaveAttribute('data-react');
    if (particles) await expect(table.light(next).locator('.dev__fx')).toHaveCount(0);
    turn += 1;
  }
  // Twenty turns later everyone has had a few; nothing else changed.
  await expect(page.locator('.seat')).toHaveCount(DEMO.length);
});
