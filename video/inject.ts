/**
 * Runs in every frame of the stage before the app boots. Three jobs:
 *  - phones in iframes share one localStorage, so each keeps its identity under its own frame name;
 *  - frames report the mouse to the stage, which draws the cursor (a recording has none);
 *  - the big screen's audio is recorded, with a clap (flash + beep) to line it up with the picture afterwards.
 */
export function inject() {
  const name = window.name;
  if (window === window.top) return;

  if (name.startsWith('phone')) {
    const key = (s: Storage, k: string) => (s === localStorage && k.startsWith('pb.phone.') ? `${name}:${k}` : k);
    const { getItem, setItem, removeItem } = Storage.prototype;
    Storage.prototype.getItem = function (k) { return getItem.call(this, key(this, k)); };
    Storage.prototype.setItem = function (k, v) { return setItem.call(this, key(this, k), v); };
    Storage.prototype.removeItem = function (k) { return removeItem.call(this, key(this, k)); };
  }

  const tell = (m: object) => window.parent.postMessage({ k: 'cursor', name, ...m }, '*');
  window.addEventListener('mousemove', (e) => tell({ x: e.clientX, y: e.clientY }), true);
  window.addEventListener('mousedown', () => tell({ down: true }), true);
  window.addEventListener('mouseup', () => tell({ down: false }), true);

  if (name !== 'host') return;
  const Real = window.AudioContext;
  let ctx: AudioContext | null = null;
  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  const connect = AudioNode.prototype.connect as (this: AudioNode, ...a: unknown[]) => unknown;
  let tap: MediaStreamAudioDestinationNode | null = null;
  (AudioNode.prototype as { connect: unknown }).connect = function (this: AudioNode, ...args: unknown[]) {
    if (tap && args[0] === this.context.destination) connect.call(this, tap);
    return connect.apply(this, args);
  };
  // One context for the whole frame, so the app's sounds and the clap land in the same recording.
  (window as unknown as { AudioContext: unknown }).AudioContext = function () {
    if (ctx) return ctx;
    ctx = new Real();
    tap = ctx.createMediaStreamDestination();
    recorder = new MediaRecorder(tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192_000 });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start(500);
    return ctx;
  };
  Object.assign(window, {
    __clap() {
      const a = new (window.AudioContext as typeof AudioContext)();
      void a.resume();
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.frequency.value = 1000;
      gain.gain.value = 0.9;
      osc.connect(gain).connect(a.destination);
      osc.start();
      osc.stop(a.currentTime + 0.08);
      window.parent.postMessage({ k: 'flash' }, '*');
      return Date.now();
    },
    __audio: () =>
      new Promise<string>((resolve) => {
        if (!recorder) return resolve('');
        recorder.onstop = async () => {
          const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
          let bin = '';
          for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          resolve(btoa(bin));
        };
        recorder.stop();
      }),
  });
}
