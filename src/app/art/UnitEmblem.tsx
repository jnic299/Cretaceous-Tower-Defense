import type { UnitArtSpec } from '../../game/types';

interface Props {
  art: UnitArtSpec;
  size?: number;
  className?: string;
  label?: string;
}

function shade(hex: number, amount: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return `#${((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, '0')}`;
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

/** Weapon glyphs, drawn pointing right from the operator's hands. */
function Weapon({ art }: { art: UnitArtSpec }) {
  const m = css(art.metal);
  const md = shade(art.metal, -0.35);
  const a = css(art.accent);

  switch (art.weapon) {
    case 'dart':
      return (
        <g>
          <rect x="8" y="-2.4" width="22" height="4.8" rx="2" fill={m} stroke={md} />
          <rect x="12" y="-6" width="8" height="4" rx="1.5" fill={md} />
          <circle cx="11" cy="4" r="3" fill={a} />
        </g>
      );
    case 'spikeRing':
      return (
        <g>
          <circle cx="10" cy="0" r="10" fill={m} stroke={md} strokeWidth="1.6" />
          {Array.from({ length: 10 }, (_, i) => {
            const ang = (i / 10) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={10 + Math.cos(ang) * 10}
                y1={Math.sin(ang) * 10}
                x2={10 + Math.cos(ang) * 16}
                y2={Math.sin(ang) * 16}
                stroke={a}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            );
          })}
          <circle cx="10" cy="0" r="4" fill={a} />
        </g>
      );
    case 'flamer':
      return (
        <g>
          <rect x="8" y="-4" width="20" height="8" rx="3.5" fill={m} stroke={md} />
          <rect x="26" y="-5.5" width="8" height="11" rx="3" fill={md} />
          <circle cx="32" cy="0" r="3.6" fill="#ff8a3c" />
          <circle cx="32" cy="0" r="1.8" fill="#ffe0a0" />
          <rect x="-14" y="-7" width="10" height="14" rx="4" fill={a} stroke={md} />
        </g>
      );
    case 'sniper':
    case 'rifle':
      return (
        <g>
          <rect x="4" y="-2" width="34" height="4" rx="1.8" fill={m} stroke={md} />
          <rect x="0" y="-4" width="13" height="8" rx="2" fill={md} />
          <rect x="10" y="-7.5" width="11" height="4" rx="1.5" fill={a} />
          <circle cx="21" cy="-5.5" r="1.7" fill="#9be8ff" />
        </g>
      );
    case 'shock':
      return (
        <g>
          <rect x="8" y="-3.4" width="18" height="6.8" rx="3" fill={m} stroke={md} />
          <circle cx="28" cy="0" r="4" fill="none" stroke={a} strokeWidth="2" />
          <circle cx="28" cy="0" r="8" fill="none" stroke={a} strokeWidth="1.5" opacity="0.7" />
          <circle cx="28" cy="0" r="2.4" fill={a} />
        </g>
      );
    case 'launcher':
      return (
        <g>
          <rect x="7" y="-4.6" width="22" height="9.2" rx="4" fill={m} stroke={md} />
          <rect x="27" y="-6" width="9" height="12" rx="3" fill={md} />
          <circle cx="32" cy="0" r="3.4" fill="#14181b" />
          <circle cx="-8" cy="-5" r="3" fill={a} />
          <circle cx="-8" cy="2" r="3" fill={a} />
        </g>
      );
    case 'wrench':
      return (
        <g>
          <rect x="8" y="-2" width="15" height="4" rx="1.8" fill={m} stroke={md} />
          <path d="M23 -5 L31 -3.4 L31 3.4 L23 5 L25 0 Z" fill={m} stroke={md} />
          <rect x="-14" y="-7" width="11" height="14" rx="3" fill={a} stroke={md} />
        </g>
      );
    case 'boat':
      return (
        <g>
          <path d="M-30 0 Q-24 -13 -2 -12 L20 -8 L34 0 L20 8 L-2 12 Q-24 13 -30 0 Z" fill={css(art.body)} stroke={md} strokeWidth="1.6" />
          <path d="M-20 0 Q-12 -7 8 -6 L22 -2 L22 2 L8 6 Q-12 7 -20 0 Z" fill={shade(art.body, 0.24)} />
          <rect x="-16" y="-7" width="15" height="14" rx="3" fill={a} stroke={md} />
          <rect x="4" y="-2" width="24" height="4" rx="2" fill={m} stroke={md} />
        </g>
      );
    case 'autocannon':
      return (
        <g>
          <rect x="-10" y="-9" width="20" height="18" rx="4" fill={m} stroke={md} strokeWidth="1.8" />
          <rect x="8" y="-3.2" width="26" height="6.4" rx="2.6" fill={m} stroke={md} />
          <rect x="8" y="-7" width="26" height="3" rx="1.4" fill={shade(art.metal, 0.2)} />
          <rect x="-9" y="-6" width="4" height="12" fill={a} />
        </g>
      );
    case 'tesla':
      return (
        <g>
          <rect x="-9" y="-9" width="18" height="18" rx="5" fill={m} stroke={md} strokeWidth="1.8" />
          {[11, 8, 5].map((r, i) => (
            <circle key={r} cx="2" cy="0" r={r} fill="none" stroke={shade(art.metal, 0.1 + i * 0.1)} strokeWidth="2" />
          ))}
          <circle cx="2" cy="0" r="5" fill={a} />
          {Array.from({ length: 4 }, (_, i) => {
            const ang = (i / 4) * Math.PI * 2 + 0.4;
            return (
              <line
                key={i}
                x1={2 + Math.cos(ang) * 7}
                y1={Math.sin(ang) * 7}
                x2={2 + Math.cos(ang) * 15}
                y2={Math.sin(ang) * 15}
                stroke={a}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      );
    case 'rail':
      return (
        <g>
          <rect x="-12" y="-9" width="22" height="18" rx="4" fill={m} stroke={md} strokeWidth="1.8" />
          <rect x="8" y="-6" width="32" height="3.2" rx="1.4" fill={shade(art.metal, 0.18)} stroke={md} />
          <rect x="8" y="2.8" width="32" height="3.2" rx="1.4" fill={shade(art.metal, 0.18)} stroke={md} />
          {[14, 22, 30, 38].map((x) => (
            <line key={x} x1={x} y1="-5" x2={x} y2="5" stroke={a} strokeWidth="1.8" />
          ))}
        </g>
      );
    case 'mortar':
      return (
        <g>
          <rect x="-10" y="-10" width="20" height="20" rx="5" fill={m} stroke={md} strokeWidth="1.8" />
          <path d="M-2 4 L20 -10 L26 -2 L4 12 Z" fill={m} stroke={md} strokeWidth="1.5" />
          <circle cx="23" cy="-6" r="4" fill="#14181b" />
          <circle cx="-4" cy="0" r="3.4" fill={a} />
        </g>
      );
    case 'tank':
      return (
        <g>
          <rect x="-26" y="-15" width="20" height="30" rx="5" fill="#20262a" stroke="#0e1214" strokeWidth="1.6" />
          <rect x="-16" y="-13" width="30" height="26" rx="7" fill={css(art.body)} stroke={md} strokeWidth="2" />
          <rect x="-11" y="-9" width="20" height="18" rx="5" fill={shade(art.body, 0.16)} />
          <rect x="12" y="-3.6" width="30" height="7.2" rx="3" fill={m} stroke={md} />
          <rect x="40" y="-5.4" width="9" height="10.8" rx="3" fill={md} />
          <rect x="10" y="7" width="18" height="3.4" rx="1.5" fill={md} />
          <rect x="-14" y="-11" width="4" height="22" fill={a} />
        </g>
      );
    case 'exo':
      return (
        <g>
          <rect x="-14" y="-15" width="27" height="30" rx="9" fill={css(art.body)} stroke={md} strokeWidth="2" />
          <rect x="-10" y="-11" width="19" height="22" rx="7" fill={shade(art.body, 0.18)} />
          <rect x="-6" y="-24" width="19" height="14" rx="6" fill={m} stroke={md} strokeWidth="1.6" />
          <rect x="-6" y="10" width="19" height="14" rx="6" fill={m} stroke={md} strokeWidth="1.6" />
          <rect x="11" y="-5" width="23" height="10" rx="4" fill={m} stroke={md} />
          <circle cx="-2" cy="0" r="4.6" fill={a} />
        </g>
      );
    default:
      return null;
  }
}

/**
 * Top-down unit portrait used on armory and loadout cards. Same construction
 * language as the in-game sprite, drawn as crisp vectors for the DOM.
 */
export function UnitEmblem({ art, size = 92, className, label }: Props) {
  const body = css(art.body);
  const line = shade(art.body, -0.6);
  const acc = css(art.accent);
  const human = art.chassis === 'human';

  return (
    <svg
      className={className}
      viewBox="-38 -34 88 70"
      width={size}
      height={Math.round(size * (70 / 88))}
      role="img"
      aria-label={label ?? 'Unit'}
      style={{ overflow: 'visible' }}
    >
      <ellipse cx="2" cy="4" rx="34" ry="26" fill="rgba(0,0,0,0.35)" />
      {human && (
        <g>
          {Array.from({ length: 7 }, (_, i) => {
            const ang = (i / 7) * Math.PI * 2 + 0.3;
            return (
              <ellipse
                key={i}
                cx={Math.cos(ang) * 22}
                cy={Math.sin(ang) * 16}
                rx="9"
                ry="6"
                fill={i % 2 ? '#a89574' : '#8d7c5f'}
                stroke="#4a412f"
                strokeWidth="1"
              />
            );
          })}
        </g>
      )}
      {art.chassis === 'machine' && (
        <polygon
          points={Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
            return `${Math.cos(a) * 28},${Math.sin(a) * 22}`;
          }).join(' ')}
          fill={shade(art.metal, -0.3)}
          stroke="#171b1f"
          strokeWidth="2"
        />
      )}
      <g transform="translate(-4 0)">
        {human && (
          <>
            <rect x="-22" y="-8" width="10" height="16" rx="3.5" fill={shade(art.body, -0.3)} stroke={line} strokeWidth="1.4" />
            <ellipse cx="-2" cy="0" rx="14" ry="11" fill={body} stroke={line} strokeWidth="2" />
            <ellipse cx="-2" cy="-4" rx="10" ry="4.5" fill={shade(art.body, 0.22)} />
            <rect x="-8" y="-10" width="4" height="20" fill={acc} />
          </>
        )}
        <Weapon art={art} />
        {human && (
          <>
            <circle cx="0" cy="0" r="6.4" fill="#d8a878" stroke={line} strokeWidth="1.6" />
            {art.hat === 'helmet' && <circle cx="0" cy="0" r="7.2" fill={shade(art.body, -0.28)} stroke={line} strokeWidth="1.6" />}
            {art.hat === 'cap' && <path d="M-4 -6 L9 -3.6 L9 3.6 L-4 6 Z" fill={shade(art.body, -0.2)} stroke={line} strokeWidth="1.4" />}
            {art.hat === 'visor' && (
              <>
                <circle cx="0" cy="0" r="7" fill={shade(art.body, -0.3)} stroke={line} strokeWidth="1.4" />
                <rect x="2" y="-4.5" width="5.5" height="9" rx="2" fill={acc} />
              </>
            )}
            {art.hat === 'hood' && <ellipse cx="1" cy="0" rx="9" ry="7.4" fill={shade(art.body, -0.34)} stroke={line} strokeWidth="1.5" />}
          </>
        )}
      </g>
    </svg>
  );
}
