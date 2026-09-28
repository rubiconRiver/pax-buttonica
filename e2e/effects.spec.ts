import { DEMO_ORDER, expect, openDemo, openSettings, test } from './helpers';

/**
 * What a button does the moment its turn starts: the table picks a default, and each player can pick their own from
 * their phone (phones.spec.ts covers that side, and the preview that shows on the big screen).
 */

test('the table\'s start-of-turn effect: the ring by default, then whatever the host picks', async ({ page }) => {
  const table = await openDemo(page);
  const [dave, kyle, mike, sarah, steph] = DEMO_ORDER;
  await table.hold(dave);
  await table.expectActive(kyle);
  await expect(table.light(kyle), 'the ring: the burst every button has always done').toHaveAttribute('data-react', 'burst');
  await expect(table.light(kyle).locator('.dev__shock')).toHaveCount(1);

  const panel = await openSettings(page);
  await expect(panel.getByRole('radio', { name: 'Ring', exact: true })).toHaveAttribute('aria-checked', 'true');
  await panel.getByRole('radio', { name: 'Sparkles' }).click();
  await page.keyboard.press('Escape');
  await table.hold(kyle);
  await table.expectActive(mike);
  await expect(table.light(mike)).toHaveAttribute('data-react', 'sparkle');
  await expect(table.light(mike).locator('.dev__sparks i')).toHaveCount(10);
  // One-shots are over in about a second.
  await page.clock.fastForward(1100);
  await expect(table.light(mike)).not.toHaveAttribute('data-react');
  await expect(table.light(mike).locator('.dev__sparks')).toHaveCount(0);

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
  await expect(table.light(steph).locator('.dev__ripples i')).toHaveCount(2);

  await (await openSettings(page)).getByRole('radio', { name: 'None' }).click();
  await page.keyboard.press('Escape');
  await table.hold(steph);
  await table.expectActive('Jen');
  await expect(table.light('Jen')).not.toHaveAttribute('data-react');
  // The setting sticks.
  await page.reload();
  await expect((await openSettings(page)).getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true');
});
