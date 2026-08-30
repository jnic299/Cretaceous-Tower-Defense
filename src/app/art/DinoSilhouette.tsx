import { useMemo } from 'react';
import type { SpeciesId, TierId } from '../../game/types';
import { getSpecies } from '../../game/data/dinosaurs';
import { getTier } from '../../game/data/tiers';
import { buildDinoSilhouette } from './svgShapes';

interface Props {
  species: SpeciesId;
  tier?: TierId;
  height?: number;
  className?: string;
  /** Renders a flat unknown-species silhouette for the codex. */
  unknown?: boolean;
}

/**
 * Species art for the codex and map cards, generated from the exact body spec
 * the battlefield sprites use.
 */
export function DinoSilhouette({ species, tier = 'green', height = 88, className, unknown }: Props) {
  const def = getSpecies(species);
  const t = getTier(tier);
  const s = useMemo(() => buildDinoSilhouette(def.body), [def.body]);

  const base = unknown ? '#2c363c' : t.cssColor;
  const dark = unknown ? '#1c252a' : shadeCss(t.cssColor, -0.34);
  const light = unknown ? '#374349' : shadeCss(t.cssColor, 0.22);
  const line = unknown ? '#111719' : shadeCss(t.cssColor, -0.62);

  return (
    <svg
      className={className}
      viewBox={`${s.view.x} ${s.view.y} ${s.view.w} ${s.view.h}`}
      height={height}
      role="img"
      aria-label={unknown ? 'Unidentified species' : def.name}
      style={{ overflow: 'visible' }}
    >
      <g stroke={line} strokeWidth={1.6} strokeLinejoin="round">
        {s.legs.map((d, i) => (
          <path key={i} d={d} fill={dark} />
        ))}
        <path d={s.tail} fill={base} />
        {s.crown && def.body.crown === 'sail' && <path d={s.crown} fill={dark} />}
        <path d={s.body} fill={base} />
        <ellipse
          cx={def.body.bodyLength * 0.05}
          cy={-def.body.bodyWidth * 0.4}
          rx={def.body.bodyLength * 0.7}
          ry={def.body.bodyWidth * 0.34}
          fill={light}
          stroke="none"
          opacity={0.8}
        />
        {s.spines && <path d={s.spines} fill={line} stroke="none" opacity={0.85} />}
        <path d={s.neck} fill={base} />
        {s.crown && def.body.crown !== 'sail' && (
          <path d={s.crown} fill={def.body.crown === 'plates' ? light : dark} />
        )}
        <path d={s.head} fill={light} />
      </g>
      {!unknown && (
        <circle
          cx={def.body.bodyLength * 0.8 + def.body.neckLength + def.body.headLength * 0.33}
          cy={-def.body.headWidth * 0.38}
          r={Math.max(1.2, def.body.headWidth * 0.18)}
          fill="#12161a"
        />
      )}
    </svg>
  );
}

function shadeCss(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return `#${((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, '0')}`;
}
