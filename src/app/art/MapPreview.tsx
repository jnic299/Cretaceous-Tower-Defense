import { useMemo } from 'react';
import type { MapDef } from '../../game/types';
import { smoothPath } from '../../game/systems/MapGeometry';
import { polygonPath, polylinePath } from './svgShapes';

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

interface Props {
  map: MapDef;
  className?: string;
  /** Dims the whole preview for locked maps. */
  locked?: boolean;
}

/**
 * Renders a map's real geometry as a preview. Nothing here is hand-drawn —
 * change a waypoint in the map data and this card updates with it.
 */
export function MapPreview({ map, className, locked }: Props) {
  const paths = useMemo(
    () => map.paths.map((p) => ({ id: p.id, pts: smoothPath(p.waypoints, 18), w: p.width, aquatic: p.aquatic })),
    [map],
  );
  const pal = map.palette;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${map.width} ${map.height}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${map.name} layout`}
      style={{ display: 'block', filter: locked ? 'saturate(0.25) brightness(0.55)' : undefined }}
    >
      <defs>
        <linearGradient id={`sky-${map.id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={css(pal.groundAlt)} />
          <stop offset="100%" stopColor={css(pal.groundDeep)} />
        </linearGradient>
        <radialGradient id={`vig-${map.id}`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor={css(pal.fog)} />
        </radialGradient>
      </defs>

      <rect width={map.width} height={map.height} fill={`url(#sky-${map.id})`} />

      {/* Terrain */}
      {map.terrain.map((t, i) => {
        const fill =
          t.kind === 'water'
            ? '#2f7f9e'
            : t.kind === 'lava'
              ? '#d4521a'
              : t.kind === 'structure'
                ? '#7b838a'
                : css(pal.groundDeep);
        return (
          <g key={i}>
            <path d={polygonPath(t.polygon)} fill="rgba(0,0,0,0.35)" transform="translate(6 8)" />
            <path
              d={polygonPath(t.polygon)}
              fill={fill}
              stroke={t.kind === 'lava' ? '#ffb347' : 'rgba(0,0,0,0.4)'}
              strokeWidth={t.kind === 'lava' ? 6 : 3}
            />
            {t.kind === 'lava' && (
              <path d={polygonPath(t.polygon)} fill="#ffd166" opacity="0.55" transform="scale(0.82)" style={{ transformOrigin: 'center' }} />
            )}
          </g>
        );
      })}

      {/* Routes */}
      {paths.map((p) => (
        <g key={p.id}>
          <path
            d={polylinePath(p.pts)}
            fill="none"
            stroke={p.aquatic ? '#1f5c73' : css(pal.pathEdge)}
            strokeWidth={(p.w ?? 32) * 2 + 10}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={p.aquatic ? 0.75 : 1}
          />
          <path
            d={polylinePath(p.pts)}
            fill="none"
            stroke={p.aquatic ? '#4fa8c4' : css(pal.path)}
            strokeWidth={(p.w ?? 32) * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={p.aquatic ? '40 26' : undefined}
          />
        </g>
      ))}

      {/* Foliage suggestion */}
      {map.decor.slice(0, 40).map((d, i) => {
        const r = d.kind === 'tree' || d.kind === 'palm' ? 26 : d.kind === 'deadTree' ? 18 : 10;
        const fill =
          d.kind === 'boulder' || d.kind === 'deadTree' ? css(pal.groundDeep) : css(pal.foliageDark);
        return <circle key={i} cx={d.x} cy={d.y} r={r * (d.scale ?? 1)} fill={fill} opacity="0.85" />;
      })}

      {/* Spawns */}
      {map.spawns.map((s) => (
        <g key={s.id}>
          <circle cx={s.x} cy={s.y} r="42" fill="#0a0d0f" opacity="0.85" />
          <circle cx={s.x} cy={s.y} r="42" fill="none" stroke="#ff7a5c" strokeWidth="6" opacity="0.9" />
        </g>
      ))}

      {/* Objective */}
      <g>
        <circle cx={map.objective.x} cy={map.objective.y} r={map.objective.radius + 26} fill="#0d1114" opacity="0.6" />
        <circle
          cx={map.objective.x}
          cy={map.objective.y}
          r={map.objective.radius + 20}
          fill="none"
          stroke="#6fd08c"
          strokeWidth="7"
        />
        <rect
          x={map.objective.x - 34}
          y={map.objective.y - 30}
          width="68"
          height="60"
          rx="8"
          fill="#aab2b8"
          stroke="#2b3236"
          strokeWidth="4"
        />
        <rect x={map.objective.x - 26} y={map.objective.y - 22} width="52" height="24" rx="4" fill="#51606b" />
      </g>

      <rect width={map.width} height={map.height} fill={`url(#vig-${map.id})`} />
    </svg>
  );
}
