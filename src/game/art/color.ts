/** Small colour helpers used by every procedural art module. */

export function rgb(color: number): { r: number; g: number; b: number } {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}

export function pack(r: number, g: number, b: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

/** Positive `amount` lightens toward white, negative darkens toward black. */
export function shade(color: number, amount: number): number {
  const { r, g, b } = rgb(color);
  if (amount >= 0) {
    return pack(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
  }
  const k = 1 + amount;
  return pack(r * k, g * k, b * k);
}

export function mix(a: number, b: number, t: number): number {
  const ca = rgb(a);
  const cb = rgb(b);
  return pack(ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t);
}

export function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Deterministic PRNG so generated art is identical on every load. */
export function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
