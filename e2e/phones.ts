import type { BrowserContext, Locator, Page } from '@playwright/test';
import { HOLD_MS, expect } from './helpers';

/**
 * A player's phone: another tab in the same browser, talking to the laptop tab through the fake PeerJS transport.
 * Tabs share localStorage, so each phone keeps its own identity (device id, "who am I") in its sessionStorage instead.
 */
export async function openPhone(context: BrowserContext, code: string, { mobile = true, directLink = true, identity = {} as Record<string, string> } = {}): Promise<Phone> {
  const page = await context.newPage();
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const own = (s: Storage, k: string) => (s === localStorage && k.startsWith('pb.phone.') ? sessionStorage : s);
    const { getItem, setItem, removeItem } = Storage.prototype;
    Storage.prototype.getItem = function (k) { return getItem.call(own(this, k), k); };
    Storage.prototype.setItem = function (k, v) { return setItem.call(own(this, k), k, v); };
    Storage.prototype.removeItem = function (k) { return removeItem.call(own(this, k), k); };
  });
  if (!directLink) await page.addInitScript(() => sessionStorage.setItem('fake-peer-dead', '1'));
  await page.addInitScript((id) => Object.entries(id).forEach(([k, v]) => sessionStorage.setItem(k, v)), identity);
  await page.goto(`/join/${code}`);
  return new Phone(page);
}

export class Phone {
  constructor(readonly page: Page) {}
  /** What makes this phone itself (device id, who it is), to hand to a new tab standing in for the same phone. */
  identity(): Promise<Record<string, string>> {
    return this.page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage).filter((k) => k.startsWith('pb.phone.')).map((k) => [k, sessionStorage.getItem(k)!])));
  }
  get light(): Locator {
    return this.page.locator('.dev');
  }
  get dome(): Locator {
    return this.page.locator('.dev__dome');
  }
  get why(): Locator {
    return this.page.locator('.join__why');
  }
  get who(): Locator {
    return this.page.locator('.join__who');
  }
  async iAm(name: string) {
    await this.page.locator('.who-list__item', { hasText: name }).click();
  }
  async tap() {
    await this.page.clock.fastForward(450);
    await this.dome.click();
  }
  async doubleTap() {
    await this.page.clock.fastForward(450);
    await this.dome.dblclick();
  }
  async hold(ms = HOLD_MS + 50) {
    await this.page.clock.fastForward(450);
    await this.dome.hover();
    await this.page.mouse.down();
    await this.page.clock.fastForward(ms);
    await this.page.mouse.up();
  }
  async expectLight(mode: string) {
    await expect(this.light).toHaveAttribute('data-mode', mode);
  }
}

/** Open a room from the laptop's Phones menu and return its code. */
export async function openRoom(host: Page): Promise<string> {
  await host.getByRole('button', { name: 'Phones', exact: true }).click();
  await host.getByRole('button', { name: 'Open a room' }).click();
  await expect(host.locator('.popover--phones .eyebrow')).toHaveText('Scan, or type the code');
  const code = (await host.locator('.room__code').innerText()).trim();
  await host.keyboard.press('Escape');
  return code;
}

/** A tenth of a second of 440 Hz: a real, decodable WAV small enough to build by hand. */
export function tinyWav(): Buffer {
  const rate = 8000;
  const n = rate / 10;
  const buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) buf[44 + i] = 128 + Math.round(90 * Math.sin((2 * Math.PI * 440 * i) / rate));
  return buf;
}
