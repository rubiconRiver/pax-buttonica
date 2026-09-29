import type { Page } from '@playwright/test';

/**
 * A USB hub that isn't there. The app's Web Serial code runs untouched; only `navigator.serial` is swapped for a
 * port whose two ends the test holds: lines the "hub" sends up, and everything the app writes down to it.
 */
export async function installFakeHub(page: Page) {
  await page.addInitScript(() => {
    const sent: unknown[] = [];
    let upstream: ReadableStreamDefaultController<Uint8Array> | null = null;
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    let partial = '';
    const port = {
      open: async () => {},
      close: async () => {},
      readable: new ReadableStream<Uint8Array>({ start: (c) => void (upstream = c) }),
      writable: new WritableStream<Uint8Array>({
        write(chunk) {
          partial += dec.decode(chunk);
          const lines = partial.split('\n');
          partial = lines.pop() ?? '';
          for (const l of lines) if (l.trim()) sent.push(JSON.parse(l));
        },
      }),
    };
    Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort: async () => port } });
    Object.assign(window, {
      __hub: {
        sent,
        /** Raw text, exactly as it would arrive: may hold several lines, half a line, or boot noise. */
        raw: (text: string) => upstream?.enqueue(enc.encode(text)),
        unplug: () => upstream?.close(),
      },
    });
  });
}

type Hub = { sent: any[]; raw(text: string): void; unplug(): void };
const hub = 'window.__hub';

export const feed = (page: Page, ...msgs: object[]) =>
  page.evaluate((lines) => (window as unknown as { __hub: Hub }).__hub.raw(lines), msgs.map((m) => JSON.stringify(m) + '\n').join(''));
export const feedRaw = (page: Page, text: string) => page.evaluate((t) => (window as unknown as { __hub: Hub }).__hub.raw(t), text);
export const unplug = (page: Page) => page.evaluate(() => (window as unknown as { __hub: Hub }).__hub.unplug());
export const sent = (page: Page): Promise<any[]> => page.evaluate(() => (window as unknown as { __hub: Hub }).__hub.sent);
void hub;

/** The most recent light sent to a button. */
export async function lastLed(page: Page, dev: string): Promise<{ c: string; m: string; p?: number; h?: 0 } | undefined> {
  return (await sent(page)).filter((m) => m.t === 'led' && m.dev === dev).pop();
}

export const hello = (dev: string, caps = { btn: 1, led: 'ring', audio: 'none' }, fw = '0.1.0') => ({ t: 'hello', dev, fw, caps });
export const press = (dev: string, e: 'tap' | 'double' | 'hold', b = 0) => ({ t: 'btn', dev, b, e });
