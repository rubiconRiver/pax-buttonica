/**
 * Built-in jingles, stored the way a button would store them: a list of
 * [midiNote, milliseconds] pairs (note 0 = rest). Small enough to fit in a
 * single ESP-NOW packet, simple enough for a piezo to play.
 */
export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';
export type Note = [midi: number, ms: number];

export interface Jingle {
  id: string;
  name: string;
  vibe: 'intro' | 'outro';
  wave: Wave;
  notes: Note[];
}

export const JINGLES: Jingle[] = [
  { id: 'herald', name: 'Herald', vibe: 'intro', wave: 'square', notes: [[72, 110], [76, 110], [79, 110], [84, 340]] },
  { id: 'warp-in', name: 'Warp In', vibe: 'intro', wave: 'triangle', notes: [[60, 55], [64, 55], [67, 55], [72, 55], [76, 55], [79, 55], [84, 55], [88, 260]] },
  { id: 'war-drums', name: 'War Drums', vibe: 'intro', wave: 'sawtooth', notes: [[43, 130], [0, 50], [43, 130], [0, 50], [43, 90], [46, 90], [50, 340]] },
  { id: 'council-bell', name: 'Council Bell', vibe: 'intro', wave: 'sine', notes: [[79, 380], [74, 380], [67, 700]] },
  { id: 'glitch', name: 'Glitch', vibe: 'intro', wave: 'square', notes: [[90, 40], [66, 40], [85, 40], [61, 40], [92, 40], [70, 40], [97, 200]] },
  { id: 'trade-wind', name: 'Trade Wind', vibe: 'intro', wave: 'triangle', notes: [[69, 120], [72, 120], [76, 120], [74, 120], [81, 360]] },
  { id: 'stand-down', name: 'Stand Down', vibe: 'outro', wave: 'square', notes: [[84, 110], [79, 110], [76, 110], [72, 340]] },
  { id: 'warp-out', name: 'Warp Out', vibe: 'outro', wave: 'triangle', notes: [[88, 55], [84, 55], [79, 55], [76, 55], [72, 55], [67, 55], [64, 55], [60, 260]] },
  { id: 'sealed', name: 'Sealed', vibe: 'outro', wave: 'sine', notes: [[67, 130], [72, 130], [67, 360]] },
  { id: 'mic-drop', name: 'Mic Drop', vibe: 'outro', wave: 'sawtooth', notes: [[55, 90], [48, 90], [36, 460]] },
  { id: 'over-to-you', name: 'Over To You', vibe: 'outro', wave: 'triangle', notes: [[76, 100], [74, 100], [72, 100], [0, 60], [79, 280]] },
];

export const jingleById = (id: string) => JINGLES.find((j) => j.id === id);
