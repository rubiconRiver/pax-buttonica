import type { Page } from '@playwright/test';

/**
 * A USB hub that isn't there. The app's Web Serial code runs untouched; only `navigator.serial` is swapped for a
 * port whose two ends the test holds: lines the "hub" sends up, and everything the app writes down to it.
 *
 * The port keeps Web Serial's rules, because the app has to live by them at the table: every open() hands out
 * fresh streams, a port can't be opened twice or closed while one of its streams is locked, and a pulled cable
 * errors the read (NetworkError) and leaves no stream to read. A port chosen once comes back from getPorts() while
 * it's plugged in, and plugging in or pulling out fires `connect` or `disconnect` on navigator.serial. Like a real
 * hub it answers any line without a "dev" with its announcement, so the app's silent "what are you?" finds it.
 */
export async function installFakeHub(page: Page) {
  await page.addInitScript(() => {
    const sent: unknown[] = [];
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    let partial = '';
    let upstream: ReadableStreamDefaultController<Uint8Array> | null = null;
    let plugged = true;
    let granted = false;
    let opened = false;
    const announce = '{"t":"hub","v":0,"fw":"0.2.5","id":"441BF6F4F41C"}\n';
    const fresh = () => new ReadableStream<Uint8Array>({ start: (c) => void (upstream = c) });
    const port = Object.assign(new EventTarget(), {
      readable: null as ReadableStream<Uint8Array> | null,
      writable: null as WritableStream<Uint8Array> | null,
      async open() {
        if (opened) throw new DOMException('The port is already open.', 'InvalidStateError');
        if (!plugged) throw new DOMException('Failed to open serial port.', 'NetworkError');
        opened = true;
        partial = '';
        port.readable = fresh();
        port.writable = new WritableStream<Uint8Array>({
          write(chunk) {
            if (!plugged) throw new DOMException('The device has been lost.', 'NetworkError');
            partial += dec.decode(chunk, { stream: true });
            const lines = partial.split('\n');
            partial = lines.pop() ?? '';
            for (const l of lines) {
              if (!l.trim()) continue;
              const msg = JSON.parse(l);
              sent.push(msg);
              if (!('dev' in msg)) upstream?.enqueue(enc.encode(announce));
            }
          },
        });
      },
      async close() {
        if (!opened) throw new DOMException('The port is already closed.', 'InvalidStateError');
        if (port.readable?.locked || port.writable?.locked) throw new TypeError('Cannot close a port while its streams are locked.');
        await port.readable?.cancel().catch(() => {});
        await port.writable?.abort().catch(() => {});
        port.readable = null;
        port.writable = null;
        upstream = null;
        opened = false;
      },
    });
    const serial = Object.assign(new EventTarget(), {
      requestPort: async () => {
        // The chooser with nothing plugged in: all the host can do is cancel.
        if (!plugged) throw new DOMException('No port selected by the user.', 'NotFoundError');
        granted = true;
        return port;
      },
      getPorts: async () => (granted && plugged ? [port] : []),
    });
    // A real one is fired at the port and bubbles up to navigator.serial, so its target is the port.
    const fire = (type: 'connect' | 'disconnect') => {
      const e = new Event(type);
      Object.defineProperty(e, 'target', { value: port });
      serial.dispatchEvent(e);
    };
    Object.defineProperty(navigator, 'serial', { configurable: true, value: serial });
    Object.assign(window, {
      __hub: {
        sent,
        /** Raw text, exactly as it would arrive: may hold several lines, half a line, or boot noise. */
        raw: (text: string) => upstream?.enqueue(enc.encode(text)),
        /** The cable comes out: the read fails, the port has nothing left to read, and writes are refused. */
        unplug: () => {
          plugged = false;
          const was = upstream;
          upstream = null;
          if (opened) port.readable = null;
          was?.error(new DOMException('The device has been lost.', 'NetworkError'));
          fire('disconnect');
        },
        plug: () => {
          plugged = true;
          fire('connect');
        },
        /** Noise on the line: the read fails, but the port is still there and has a fresh stream to read. */
        glitch: () => {
          const was = upstream;
          port.readable = fresh();
          was?.error(new DOMException('A framing error was detected.', 'FramingError'));
        },
      },
    });
  });
}

type Hub = { sent: any[]; raw(text: string): void; unplug(): void; plug(): void; glitch(): void };
const hub = 'window.__hub';

export const feed = (page: Page, ...msgs: object[]) =>
  page.evaluate((lines) => (window as unknown as { __hub: Hub }).__hub.raw(lines), msgs.map((m) => JSON.stringify(m) + '\n').join(''));
export const feedRaw = (page: Page, text: string) => page.evaluate((t) => (window as unknown as { __hub: Hub }).__hub.raw(t), text);
export const unplug = (page: Page) => page.evaluate(() => (window as unknown as { __hub: Hub }).__hub.unplug());
export const plug = (page: Page) => page.evaluate(() => (window as unknown as { __hub: Hub }).__hub.plug());
export const glitch = (page: Page) => page.evaluate(() => (window as unknown as { __hub: Hub }).__hub.glitch());
export const sent = (page: Page): Promise<any[]> => page.evaluate(() => (window as unknown as { __hub: Hub }).__hub.sent);
void hub;

/** The most recent light sent to a button. */
export async function lastLed(page: Page, dev: string): Promise<{ c: string; m: string; p?: number; h?: 0 } | undefined> {
  return (await sent(page)).filter((m) => m.t === 'led' && m.dev === dev).pop();
}

export const hello = (dev: string, caps = { btn: 1, led: 'ring', audio: 'none' }, fw = '0.1.0') => ({ t: 'hello', dev, fw, caps });
export const press = (dev: string, e: 'tap' | 'double' | 'hold', b = 0) => ({ t: 'btn', dev, b, e });
