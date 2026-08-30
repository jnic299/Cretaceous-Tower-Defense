import type { Dino } from '../entities/Dino';

/**
 * Uniform bucket grid rebuilt once per frame. Radius queries during targeting,
 * splash and chain resolution are the hot path; a flat grid keeps them O(k)
 * instead of scanning every animal on the field.
 */
export class SpatialGrid {
  private readonly cells = new Map<number, Dino[]>();
  private readonly cols: number;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly cellSize = 96,
  ) {
    this.cols = Math.ceil(width / cellSize) + 2;
  }

  private index(cx: number, cy: number): number {
    return cy * this.cols + cx;
  }

  private cellCoord(v: number): number {
    return Math.floor(v / this.cellSize) + 1;
  }

  rebuild(dinos: readonly Dino[]): void {
    this.cells.clear();
    for (const d of dinos) {
      if (!d.alive) continue;
      const key = this.index(this.cellCoord(d.x), this.cellCoord(d.y));
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(d);
      else this.cells.set(key, [d]);
    }
  }

  /** All live dinosaurs whose centre lies within `radius` of the point. */
  queryCircle(x: number, y: number, radius: number, out: Dino[] = []): Dino[] {
    out.length = 0;
    const minX = this.cellCoord(x - radius);
    const maxX = this.cellCoord(x + radius);
    const minY = this.cellCoord(y - radius);
    const maxY = this.cellCoord(y + radius);
    const rSq = radius * radius;

    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const bucket = this.cells.get(this.index(cx, cy));
        if (!bucket) continue;
        for (const d of bucket) {
          if (!d.alive) continue;
          const dx = d.x - x;
          const dy = d.y - y;
          if (dx * dx + dy * dy <= rSq) out.push(d);
        }
      }
    }
    return out;
  }

  get bounds(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
