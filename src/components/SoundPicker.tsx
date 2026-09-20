import { useRef, useState } from 'react';
import { saveClip } from '../audio/clips';
import { JINGLES } from '../audio/jingles';
import { playSound, unlockAudio, type Playing } from '../audio/synth';
import type { SoundRef } from '../engine/types';
import { IconPlay, IconUpload } from './Icons';

interface Props {
  label: string;
  value: SoundRef;
  onChange(v: SoundRef): void;
}

let preview: Playing | null = null;

/** Pick a built-in jingle or upload your own clip (the clip stays in this browser). */
export function SoundPicker({ label, value, onChange }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = value.kind === 'jingle' ? `j:${value.id}` : value.kind === 'clip' ? 'clip' : 'none';

  const play = async (ref: SoundRef) => {
    unlockAudio();
    preview?.stop(80);
    preview = await playSound(ref);
  };

  return (
    <div className="soundpick">
      <span className="soundpick__label">{label}</span>
      <div className="soundpick__row">
        <select
          className="select"
          value={selected}
          aria-label={label}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'upload') return file.current?.click();
            const next: SoundRef = v === 'none' ? { kind: 'none' } : v === 'clip' ? value : { kind: 'jingle', id: v.slice(2) };
            onChange(next);
            void play(next);
          }}
        >
          <option value="none">Silent</option>
          {value.kind === 'clip' && <option value="clip">♪ {value.name}</option>}
          <optgroup label="Entrances">
            {JINGLES.filter((j) => j.vibe === 'intro').map((j) => <option key={j.id} value={`j:${j.id}`}>{j.name}</option>)}
          </optgroup>
          <optgroup label="Exits">
            {JINGLES.filter((j) => j.vibe === 'outro').map((j) => <option key={j.id} value={`j:${j.id}`}>{j.name}</option>)}
          </optgroup>
          <option value="upload">Upload your own…</option>
        </select>
        <button type="button" className="btn btn--sm btn--icon" title="Preview" disabled={value.kind === 'none'} onClick={() => void play(value)}><IconPlay /></button>
        <button type="button" className="btn btn--sm btn--icon" title="Upload your own sound" onClick={() => file.current?.click()}><IconUpload /></button>
      </div>
      {error && <span className="soundpick__error">{error}</span>}
      <input
        ref={file}
        type="file"
        accept="audio/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const clip = await saveClip(f);
            const next: SoundRef = { kind: 'clip', ...clip };
            setError(null);
            onChange(next);
            void play(next);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
    </div>
  );
}
