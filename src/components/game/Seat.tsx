import { forwardRef, type CSSProperties } from 'react';
import { cardByNumber, colorById } from '../../engine/data';
import type { DeviceOutput, TurnLook } from '../../engine/outputs';
import type { DeviceInput, Player } from '../../engine/types';
import { Device, type DeviceHandle } from '../Device';
import type { Reaction } from './useReactions';
import { IconGavel } from '../Icons';
import { formatClock, type SeatPos } from './geometry';

interface Props {
  /** Where on the table this seat is drawn, and which number key presses its button. */
  spot: number;
  pos: SeatPos;
  /** This player's place in the order of play (0 = first), shown in the turn-order layout. */
  rank?: number;
  player: Player;
  output: DeviceOutput;
  /** How this player's "your move" is drawn. */
  look: TurnLook;
  size: number;
  holdMs: number;
  isSpeaker: boolean;
  hasZero: boolean;
  isActive: boolean;
  liveMs: number;
  explain: boolean;
  react: Reaction;
  onInput?(input: DeviceInput): void;
}

export const Seat = forwardRef<DeviceHandle, Props>(function Seat(
  { spot, pos, rank, player, output, look, size, holdMs, isSpeaker, hasZero, isActive, liveMs, explain, react, onInput },
  ref,
) {
  const led = colorById(player.color).led;
  return (
    <div
      className="seat"
      data-above={pos.above || undefined}
      data-active={isActive || undefined}
      data-passed={player.passed || undefined}
      style={{ '--x': pos.x, '--y': pos.y, '--pc': led, '--size': `${size}px` } as CSSProperties}
    >
      {rank != null && <span className="seat__rank mono-num" aria-label={`${ordinal(rank + 1)} to act`}>{rank + 1}</span>}
      <Device
        ref={ref}
        color={output.color}
        mode={output.mode}
        look={output.look ?? look}
        size={size}
        holdMs={holdMs}
        holdOk={output.hold !== false}
        buttons={player.buttons}
        pan={pos.pan}
        hotkey={onInput ? String(spot + 1) : undefined}
        label={`${player.name}'s button`}
        react={react}
        silent={!onInput}
        onInput={onInput}
      />
      <div className="plate">
        <div className="plate__row">
          <span className="plate__name">{player.name}</span>
          {isSpeaker && (
            <span className="plate__speaker" title="Speaker">
              <IconGavel />
            </span>
          )}
        </div>
        <div className="plate__meta">
          {hasZero && <span className="cardpip" style={{ '--cc': '#ffffff' } as CSSProperties} title="Naalu initiative 0">0</span>}
          {player.cards.map((c) => (
            <span
              key={c}
              className="cardpip"
              data-used={player.usedCards.includes(c) || undefined}
              style={{ '--cc': cardByNumber(c).color } as CSSProperties}
              title={`${cardByNumber(c).name}${player.usedCards.includes(c) ? ' (played)' : ''}`}
            >
              {c}
            </span>
          ))}
          <span className="plate__vp mono-num">{player.vp}<small>VP</small></span>
          <span className="plate__time mono-num">{formatClock(liveMs)}</span>
          {player.passed && <span className="plate__passed">Passed</span>}
        </div>
        {explain && <div className="plate__why">{output.reason}</div>}
      </div>
    </div>
  );
});

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** A button nobody has claimed yet. */
export const OpenSpot = forwardRef<DeviceHandle, { spot: number; pos: SeatPos; size: number; holdMs: number; output: DeviceOutput; look: TurnLook; onInput(input: DeviceInput): void }>(
  function OpenSpot({ spot, pos, size, holdMs, output, look, onInput }, ref) {
    return (
      <div className="seat seat--open" data-above={pos.above || undefined} style={{ '--x': pos.x, '--y': pos.y, '--pc': '#ffffff', '--size': `${size}px` } as CSSProperties}>
        <Device ref={ref} color={output.color} mode={output.mode} look={look} size={size} holdMs={holdMs} pan={pos.pan} hotkey={String(spot + 1)} label={`Unclaimed button ${spot + 1}`} onInput={onInput} />
        <div className="plate">
          <div className="plate__row"><span className="plate__name plate__name--open">Unclaimed</span></div>
        </div>
      </div>
    );
  },
);
