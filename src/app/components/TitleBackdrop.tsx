import { DinoSilhouette } from '../art/DinoSilhouette';
import type { SpeciesId } from '../../game/types';
import { makeRandom } from '../../game/art/color';

const WALKERS: { species: SpeciesId; depth: number; height: number; duration: number; delay: number; y: string }[] = [
  { species: 'parasaurolophus', depth: 0, height: 52, duration: 46, delay: -6, y: '46%' },
  { species: 'triceratops', depth: 1, height: 74, duration: 58, delay: -28, y: '58%' },
  { species: 'velociraptor', depth: 2, height: 46, duration: 22, delay: -12, y: '70%' },
  { species: 'compsognathus', depth: 2, height: 30, duration: 18, delay: -3, y: '74%' },
  { species: 'tyrannosaurus', depth: 1, height: 96, duration: 74, delay: -50, y: '63%' },
];

/** Ridge line from a layered sine field. Deterministic, so it never reflows. */
function ridgePath(seed: number, base: number, amp: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= 1280; x += 20) {
    const y =
      base +
      Math.sin((x + seed * 130) / 190) * amp +
      Math.sin((x + seed * 71) / 73) * amp * 0.4 +
      Math.sin((x + seed * 37) / 311) * amp * 0.8;
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  return `M 0 720 L ${pts.join(' L ')} L 1280 720 Z`;
}

const RIDGES = [ridgePath(1, 300, 26), ridgePath(2, 380, 34), ridgePath(3, 470, 30)];

const CANOPY = (() => {
  const rand = makeRandom(12345);
  return Array.from({ length: 46 }, () => ({
    x: rand() * 1320 - 20,
    y: 470 + rand() * 260,
    r: 26 + rand() * 54,
    o: 0.5 + rand() * 0.5,
  }));
})();

/**
 * Layered parallax jungle for the title screen. Everything is generated —
 * ridge lines from a seeded sine field, canopy from circle packing, and the
 * same dinosaur silhouettes the codex uses, walking the treeline.
 */
export function TitleBackdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <svg className="backdrop__sky" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="ctd-sky" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#16232a" />
            <stop offset="42%" stopColor="#1d3129" />
            <stop offset="100%" stopColor="#0a1013" />
          </linearGradient>
          <radialGradient id="ctd-sun" cx="0.72" cy="0.2" r="0.42">
            <stop offset="0%" stopColor="rgba(255,196,110,0.5)" />
            <stop offset="100%" stopColor="rgba(255,196,110,0)" />
          </radialGradient>
        </defs>
        <rect width="1280" height="720" fill="url(#ctd-sky)" />
        <rect width="1280" height="720" fill="url(#ctd-sun)" />
        <circle cx="922" cy="150" r="52" fill="#ffce87" opacity="0.28" />
        <path d={RIDGES[0]} fill="#152220" opacity="0.9" />
        <path d={RIDGES[1]} fill="#101c1a" opacity="0.94" />
        <path d={RIDGES[2]} fill="#0b1513" />
        {CANOPY.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="#08110f" opacity={c.o} />
        ))}
      </svg>

      <div className="backdrop__walkers">
        {WALKERS.map((w) => (
          <div
            key={w.species}
            className={`walker walker--d${w.depth}`}
            style={{
              top: w.y,
              height: w.height,
              animationDuration: `${w.duration}s`,
              animationDelay: `${w.delay}s`,
            }}
          >
            <DinoSilhouette species={w.species} tier="green" height={w.height} />
          </div>
        ))}
      </div>

      <div className="backdrop__fog" />
      <div className="backdrop__vignette" />
      <div className="backdrop__scan" />
    </div>
  );
}
