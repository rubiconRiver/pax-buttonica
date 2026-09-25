import type { SVGProps } from 'react';

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
type P = SVGProps<SVGSVGElement>;

export const IconUndo = (p: P) => <svg {...base} {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></svg>;
export const IconPause = (p: P) => <svg {...base} {...p}><path d="M8 5v14M16 5v14" /></svg>;
export const IconPlay = (p: P) => <svg {...base} {...p}><path d="M7 4l13 8-13 8z" fill="currentColor" /></svg>;
export const IconSound = (p: P) => <svg {...base} {...p}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" /></svg>;
export const IconMute = (p: P) => <svg {...base} {...p}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 9l5 6M22 9l-5 6" /></svg>;
export const IconGear = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H3a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 002.9-1.2V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;
export const IconUsb = (p: P) => <svg {...base} {...p}><path d="M12 22V6M12 6l-3 3M12 6l3 3M7 12v3l5 3M17 10v3l-5 3" /><circle cx="12" cy="4" r="1.5" /></svg>;
export const IconCheck = (p: P) => <svg {...base} strokeWidth={3} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconGavel = (p: P) => <svg {...base} {...p}><path d="M14 4l6 6M11 7l6 6M12.5 5.5l-6 6 3 3 6-6M8 13l-5 5 2 2 5-5M14 21h7" /></svg>;
export const IconFlask = (p: P) => <svg {...base} {...p}><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M7.5 15h9" /></svg>;
export const IconArrow = (p: P) => <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IconClose = (p: P) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconUpload = (p: P) => <svg {...base} {...p}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>;
export const IconCrown = (p: P) => <svg {...base} {...p}><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" /></svg>;
export const IconPhone = (p: P) => <svg {...base} {...p}><rect x="7" y="2.5" width="10" height="19" rx="2" /><circle cx="12" cy="14" r="2.5" /><path d="M10.5 5.5h3" /></svg>;
export const IconLock = (p: P) => <svg {...base} {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;
export const IconRedo = (p: P) => <svg {...base} {...p}><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 000 12h3" /></svg>;
export const IconWhistle = (p: P) => <svg {...base} {...p}><path d="M3 13a5 5 0 105 5v-5zM8 13V9h13v4H8z" /><path d="M15 9V6M18 9V6" /></svg>;
