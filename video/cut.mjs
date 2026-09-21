// Lines the recorded audio up with the recorded picture (both contain the same clap), trims the set-up, and
// writes video/out/pax-buttonica-tour.mp4. Re-run by hand after a recording: `node video/cut.mjs`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'video', 'out');
const { raw, audioPath, clapToStart, length } = JSON.parse(readFileSync(join(OUT, 'raw', 'marks.json'), 'utf8'));
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// The clap in the picture: the first frame that is almost entirely white.
const stats = execFileSync('ffprobe', ['-v', 'error', '-f', 'lavfi', '-i', `movie=${raw.replace(/([:\\'])/g, '\\$1')},trim=end=30,signalstats`, '-show_entries', 'frame=pts_time:frame_tags=lavfi.signalstats.YAVG', '-of', 'csv=p=0'], { encoding: 'utf8', maxBuffer: 1 << 26 });
// (The blank page before the stage loads is white too, so wait until the picture has gone dark first.)
let dark = false;
const flash = stats.split('\n').map((l) => l.split(',').map(Number)).find(([, y]) => {
  if (y < 60) dark = true;
  return dark && y > 200;
});
if (!flash) throw new Error('no flash found in the first 30 seconds of the recording');
// The clap in the sound is the very first thing recorded (the recorder starts with it). Chrome's recorder leaves
// silences out of the file altogether, keeping only their timestamps, so the track has to be decoded with
// `aresample=async` to put them back; decoded naively it comes out half the length and drifts out of step at once.
const videoStart = flash[0] + clapToStart;
const audioStart = clapToStart;
console.log(`clap at ${flash[0].toFixed(3)} s in the picture; show starts ${clapToStart.toFixed(2)} s later and runs ${length.toFixed(1)} s`);

const out = join(OUT, 'pax-buttonica-tour.mp4');
const end = (audioStart + length).toFixed(3);
ff(['-y', '-ss', videoStart.toFixed(3), '-t', length.toFixed(3), '-i', raw, '-i', audioPath,
  '-filter_complex',
  `[0:v]fps=30,format=yuv420p,fade=t=in:d=0.6,fade=t=out:st=${(length - 1).toFixed(2)}:d=1[v];` +
  `[1:a]aresample=async=1:first_pts=0,apad=whole_dur=${end},atrim=start=${audioStart.toFixed(3)}:end=${end},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.4,afade=t=out:st=${(length - 1.2).toFixed(2)}:d=1.2[a]`,
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]);
console.log(out);
