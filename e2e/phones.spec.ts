import { Board, Table, expect, liveGame, readStorage, setUpGame, test } from './helpers';
import { pickCards } from './flows';
import { openPhone, openRoom, tinyWav } from './phones';

/**
 * Phones as buttons. The laptop tab and the phone tabs run the real host and join code; only the WebRTC library
 * underneath is replaced (e2e/fake-peerjs.ts), because a test can't depend on a public broker or on ICE.
 */

const NAMES = ['Ana', 'Ben', 'Cleo'];
const SIX = [['Ana', 1], ['Ben', 2], ['Cleo', 3], ['Ana', 4], ['Ben', 5], ['Cleo', 6]] as [string, number][];

test('typing a room code: only letters that can be read aloud, four of them', async ({ page }) => {
  await page.goto('/join');
  const input = page.getByLabel('Room code');
  const join = page.getByRole('button', { name: 'Join the table' });
  await expect(join).toBeDisabled();
  await input.pressSequentially('a0o1b');
  await expect(input, '0, O, 1, I and L are never in a code').toHaveValue('AB');
  await input.pressSequentially('-c d e');
  await expect(input).toHaveValue('ABCD');
  await join.click();
  await expect(page).toHaveURL(/\/join\/ABCD$/);
  await expect(page.locator('.join__link')).toHaveText('Connecting…');
  await expect(page.locator('.join__help')).toContainText('Room ABCD');
});

test('a phone that says who it is takes that seat, and then is that button', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const table = new Table(page);
  const code = await openRoom(page);
  expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}$/);
  expect(await readStorage(page, 'pb.room.v1').catch(() => null)).toBeNull(); // stored as a bare string, not JSON
  expect(await page.evaluate(() => localStorage.getItem('pb.room.v1'))).toBe(code);

  const phone = await openPhone(context, code);
  await expect(phone.page.getByRole('heading', { name: 'Who are you?' })).toBeVisible();
  await expect(phone.page.locator('.who-list__item')).toHaveText(['Ana', 'Ben', 'Cleo']);
  await phone.iAm('Ben');

  // No ritual needed: Ben's seat is his phone now, and the claiming moves on past him when it gets there.
  await expect(phone.who).toHaveText('Ben');
  await phone.expectLight('solid');
  await expect(phone.why).toHaveText('Seat claimed');
  await expect(page.getByRole('button', { name: `${code} · 1` })).toBeVisible();
  await expect(table.log).toContainText('Ben joins on their own device.');
  await expect(page.getByRole('button', { name: 'Undo' }), 'a phone finding its seat is not something to undo').toBeDisabled();
  // Ben's seat has taken the first place at the on-screen table, so the two breathing buttons left are keys 2 and 3.
  await expect(page.locator('.seat--open')).toHaveCount(2);
  await table.tapKey('2'); // Ana
  await expect(table.center.locator('.center__active'), 'Ben is skipped: he already has a button').toHaveText('Cleo');
  await table.tapKey('3');
  await table.expectPhase('Strategy');

  await pickCards(table, SIX);
  await table.expectActive('Ana');
  await phone.expectLight('dim');
  await table.hold('Ana');

  // Ben's turn, played from his phone: a tap is a nudge, a hold that's too short does nothing, a real hold ends it.
  await phone.expectLight('pulse');
  await expect(phone.why).toHaveText('Your turn — hold to end it');
  await phone.tap();
  await table.expectToast('Ben: Hold to end your turn');
  await expect(phone.light).toHaveAttribute('data-react', 'hint');
  await phone.hold(1500);
  await table.expectActive('Ben');
  await phone.hold();
  await table.expectActive('Cleo');
  await phone.expectLight('dim');

  // Cleo plays a card; Ben's phone blinks in the card's colour until he taps.
  await table.doubleTap('Cleo');
  await table.center.getByRole('button', { name: '3 Politics' }).click();
  await table.primaryDone('Cleo');
  await phone.expectLight('flash');
  await expect(phone.why).toHaveText('Politics played — tap when done');
  await phone.tap();
  await phone.expectLight('dim');
  await expect(table.center.locator('.ackpip', { hasText: 'Ben' })).toHaveAttribute('data-done', 'true');
});

test('a phone that skips the question claims a seat by pressing, and learns who it is', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const table = new Table(page);
  const code = await openRoom(page);
  const phone = await openPhone(context, code);
  await phone.page.getByRole('button', { name: 'Skip: just be a button' }).click();
  await expect(phone.who).toHaveText('Unclaimed');
  await phone.expectLight('pulse');
  await expect(phone.why).toHaveText("Now calling Ana. If that's you, press.");
  await phone.tap();
  await expect(phone.who).toHaveText('Ana');
  await expect(phone.page.getByRole('button', { name: 'Ana · profile' })).toBeVisible();
  await expect(table.center.locator('.center__active')).toHaveText('Ben');
  expect((await liveGame(page)).bindings[0]).toMatch(/^web-/);
});

test('two phones, two players: each sees only their own light', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const table = new Table(page);
  const code = await openRoom(page);
  const ana = await openPhone(context, code);
  await ana.iAm('Ana');
  const ben = await openPhone(context, code);
  await ben.iAm('Ben');
  await expect(page.getByRole('button', { name: `${code} · 2` })).toBeVisible();
  await table.tapKey('3');
  await pickCards(table, SIX);
  await ana.expectLight('pulse');
  await ben.expectLight('dim');
  await ana.hold();
  await ana.expectLight('dim');
  await ben.expectLight('pulse');
  await table.expectActive('Ben');
});

test('someone new adds themselves from their phone; they are saved, but not seated', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const code = await openRoom(page);
  const phone = await openPhone(context, code);
  await phone.page.getByLabel('Your name').fill('Dana');
  await phone.page.getByRole('button', { name: "That's me" }).click();
  await expect(phone.page.getByRole('button', { name: 'Dana · profile' })).toBeVisible();
  await expect(phone.why).toHaveText("Now calling Ana. If that's you, press.");
  expect((await readStorage<{ name: string }[]>(page, 'pb.profiles.v1'))!.map((p) => p.name)).toContain('Dana');

  // "Not Dana? Switch player" goes back to the question, and she is on the list now.
  await phone.page.getByRole('button', { name: 'Dana · profile' }).click();
  await phone.page.getByRole('button', { name: /Not Dana\? Switch player/ }).click();
  await expect(phone.page.locator('.who-list__item')).toHaveText(['Ana', 'Ben', 'Cleo', 'Dana']);
});

test('changing your name, colour and sounds from your phone changes the game on the big screen', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const table = new Table(page);
  const code = await openRoom(page);
  const phone = await openPhone(context, code);
  await phone.iAm('Cleo');
  await phone.page.getByRole('button', { name: 'Cleo · profile' }).click();
  const sheet = phone.page.getByRole('dialog', { name: 'Your profile' });

  await sheet.getByRole('textbox').first().fill('Cleopatra');
  await sheet.getByRole('textbox').first().blur();
  await expect(table.seat('Cleopatra').locator('.plate__name')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Not Cleopatra\?/ })).toBeVisible();

  await sheet.locator('select').first().selectOption({ label: 'Silent' });
  await expect.poll(async () => (await liveGame(page)).players[2].intro).toEqual({ kind: 'none' });
  await sheet.getByRole('radio', { name: 'Pink' }).click();
  await expect.poll(async () => (await readStorage<{ name: string; color: string }[]>(page, 'pb.profiles.v1'))!.find((p) => p.name === 'Cleopatra')!.color).toBe('pink');

  // Only jingles the app knows are accepted, however the message is dressed up.
  await sheet.locator('select').nth(1).selectOption({ index: 2 });
  const outro = (await liveGame(page)).players[2].outro;
  expect(outro.kind).toBe('jingle');
});

test('an uploaded clip travels from the phone to the laptop and becomes the entrance music', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const code = await openRoom(page);
  const phone = await openPhone(context, code);
  await phone.iAm('Ana');
  await phone.page.getByRole('button', { name: 'Ana · profile' }).click();
  const sheet = phone.page.getByRole('dialog', { name: 'Your profile' });

  await sheet.locator('input[type=file]').first().setInputFiles({ name: 'airhorn.wav', mimeType: 'audio/wav', buffer: tinyWav() });
  await expect(sheet.locator('select').first().locator('option:checked')).toHaveText('♪ airhorn');
  const intro = (await liveGame(page)).players[0].intro;
  expect(intro).toMatchObject({ kind: 'clip', name: 'airhorn' });
  // The laptop kept the audio itself (IndexedDB), since that's where it will be played.
  const size = await page.evaluate(
    (id) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('pb-clips', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('clips').objectStore('clips').get(id);
          get.onsuccess = () => resolve((get.result as Blob | undefined)?.size ?? -1);
        };
      }),
    intro.id,
  );
  expect(size).toBe(tinyWav().length);

  // Not audio: refused on the phone, nothing sent.
  await sheet.locator('input[type=file]').nth(1).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(sheet.locator('.soundpick__error')).toHaveText('That is not an audio file.');
  expect((await liveGame(page)).players[0].outro.kind).toBe('jingle');
});

test('"The table" on a phone is the scoreboard, live and read-only', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const board = new Board(page);
  const code = await openRoom(page);
  await page.getByRole('button', { name: /Skip/ }).click();
  const phone = await openPhone(context, code);
  await phone.iAm('Ben');
  await phone.page.getByRole('button', { name: 'The table' }).click();
  const view = phone.page.locator('.board');
  await expect(view.locator('.stand__name')).toHaveText(NAMES);
  await expect(view).not.toHaveAttribute('data-edit', 'true');
  await expect(view.getByRole('button')).toHaveCount(0);

  await board.open();
  await board.reveal(1, 'Expand Borders');
  await board.score('Expand Borders', 'Ben');
  await board.addLaw('Fleet Regulations');
  await expect(view.locator('.obj', { hasText: 'Expand Borders' }).locator('.who-chip[aria-pressed="true"]')).toHaveText('Ben');
  await expect(view.locator('.stand', { hasText: 'Ben' }).locator('.stand__vp')).toHaveText('1');
  await expect(view.locator('.law')).toContainText('Fleet Regulations');

  await phone.page.getByRole('button', { name: 'My button' }).click();
  await expect(phone.who).toHaveText('Ben');
});

test('the table is also published through the site, for phones that cannot reach the laptop', async ({ page, context }) => {
  const puts: { url: string; body: any }[] = [];
  await context.route('**/api/table**', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      puts.push({ url: req.url(), body: req.postDataJSON() });
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { table: puts.at(-1)?.body ?? null } });
  });
  await setUpGame(page, { names: NAMES });
  const code = await openRoom(page);
  await page.getByRole('button', { name: /Skip/ }).click();
  await page.clock.fastForward(1500);
  await expect.poll(() => puts.length).toBeGreaterThan(0);
  const last = puts.at(-1)!;
  expect(last.url).toContain(`code=${code}`);
  expect(last.url).toMatch(/key=[0-9a-f-]{36}/);
  expect(last.body.players.map((p: { name: string }) => p.name)).toEqual(NAMES);
  // Nothing in the public snapshot says which device is whose.
  expect(JSON.stringify(last.body)).not.toContain('sim-');

  // A phone with no link to the laptop at all still gets the table, by polling.
  await page.close();
  const phone = await openPhone(context, code);
  await phone.page.clock.fastForward(1100);
  await expect(phone.page.locator('.join__link')).not.toHaveText('Connected');
  await phone.page.getByRole('button', { name: 'The table' }).click();
  await expect(phone.page.locator('.board .stand__name')).toHaveText(NAMES);
});

test('the laptop reloads: same room code, phones find their way back', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const table = new Table(page);
  const code = await openRoom(page);
  const phone = await openPhone(context, code);
  await phone.iAm('Ana');
  await phone.expectLight('solid');

  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(`^${code} · `) })).toBeVisible();
  await expect(phone.page.locator('.join__link')).toHaveText('Reconnecting…');
  await phone.page.clock.fastForward(2100);
  await expect(phone.page.locator('.join__link')).toHaveText('Connected');
  await expect(page.getByRole('button', { name: `${code} · 1` })).toBeVisible();
  await phone.expectLight('solid');
  await expect(phone.who).toHaveText('Ana');
  // Still bound: no second "joins on their own device".
  expect((await liveGame(page)).bindings[0]).toMatch(/^web-/);
  await expect(table.center.locator('.center__active')).toHaveText('Ben');
});

test('closing the room cuts the phones loose and forgets the code', async ({ page, context }) => {
  await setUpGame(page, { names: NAMES });
  const code = await openRoom(page);
  const phone = await openPhone(context, code);
  await phone.iAm('Ana');
  await page.getByRole('button', { name: `${code} · 1` }).click();
  await page.getByRole('button', { name: 'Close the room' }).click();
  await expect(page.getByRole('button', { name: 'Open a room' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pb.room.v1'))).toBeNull();
  await expect(phone.page.locator('.join__link')).toHaveText('Reconnecting…');
  await phone.expectLight('off');
});

test('players can join from the setup screen, before the game exists', async ({ page, context }) => {
  await page.goto('/play');
  const code = await openRoom(page);
  const phone = await openPhone(context, code);
  await phone.page.getByLabel('Your name').fill('Dana');
  await phone.page.getByRole('button', { name: "That's me" }).click();
  await expect(phone.why).toHaveText('Waiting for the game to start…');
  // She shows up as a saved player to seat.
  await expect(page.locator('.seatcard').first().getByLabel('Who is sitting here?').locator('option')).toHaveText(['New player', 'Dana']);
});
