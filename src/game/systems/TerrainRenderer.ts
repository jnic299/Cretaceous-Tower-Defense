import Phaser from 'phaser';
import type { DecorItem, MapDef, MapPalette, Polygon } from '../types';
import { makeRandom, mix, shade } from '../art/color';
import { bakeTexture, poly } from '../art/draw';
import { bakeDecor, bakeObjective, decorKey, objectiveKey } from '../art/terrainArt';
import { FX } from '../art/fxArt';
import type { MapGeometry } from './MapGeometry';
import { polygonCentroid, pointInPolygon } from '../../utils/geometry';
import { DEPTH } from '../depth';

function terrainKey(map: MapDef): string {
  return `terrain:${map.id}`;
}

function lavaGlowKey(map: MapDef): string {
  return `terrain:${map.id}:lavaglow`;
}

function waterGlintKey(map: MapDef): string {
  return `terrain:${map.id}:waterglint`;
}

/** Thick round-capped stroke through a dense polyline. */
function strokeCorridor(
  g: Phaser.GameObjects.Graphics,
  points: { x: number; y: number }[],
  width: number,
  color: number,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  for (let i = 0; i < points.length; i++) {
    g.fillCircle(points[i].x, points[i].y, width);
    if (i < points.length - 1) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * width;
      const ny = (dx / len) * width;
      g.fillPoints(
        [
          { x: a.x + nx, y: a.y + ny },
          { x: b.x + nx, y: b.y + ny },
          { x: b.x - nx, y: b.y - ny },
          { x: a.x - nx, y: a.y - ny },
        ],
        true,
      );
    }
  }
}

function fillPolygon(g: Phaser.GameObjects.Graphics, p: Polygon, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillPoints(p, true);
}

/**
 * Bakes an entire map's static terrain into one texture: ground noise, routes,
 * water, lava, rock and their edge treatments. One image, one draw call, and
 * the whole environment stays crisp at any window size.
 */
function drawStaticTerrain(g: Phaser.GameObjects.Graphics, map: MapDef, geometry: MapGeometry): void {
  const p: MapPalette = map.palette;
  const rand = makeRandom(map.id.length * 7919 + map.width);

  // ---- Ground -----------------------------------------------------------
  g.fillStyle(p.ground, 1);
  g.fillRect(0, 0, map.width, map.height);

  // Broad tonal patches, then tighter clumps, then speckle. Three scales of
  // variation is what stops a large flat from reading as a solid fill.
  for (let i = 0; i < 150; i++) {
    const r = 60 + rand() * 130;
    g.fillStyle(rand() > 0.5 ? p.groundAlt : p.groundDeep, 0.2 + rand() * 0.16);
    g.fillEllipse(rand() * map.width, rand() * map.height, r * 2, r * 1.4);
  }
  for (let i = 0; i < 260; i++) {
    const x = rand() * map.width;
    const y = rand() * map.height;
    const r = 14 + rand() * 40;
    const tone = rand();
    g.fillStyle(tone > 0.62 ? p.foliageDark : tone > 0.3 ? p.groundDeep : shade(p.groundAlt, 0.12), 0.2 + rand() * 0.2);
    g.fillEllipse(x, y, r * 2, r * 1.5);
  }
  // Scattered tufts give the flats a sense of scale.
  for (let i = 0; i < 340; i++) {
    const x = rand() * map.width;
    const y = rand() * map.height;
    g.lineStyle(1.6, rand() > 0.5 ? shade(p.foliage, 0.1) : p.foliageDark, 0.5);
    for (let b = 0; b < 3; b++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 1.9;
      g.lineBetween(x, y, x + Math.cos(a) * (4 + rand() * 5), y + Math.sin(a) * (4 + rand() * 5));
    }
  }
  for (let i = 0; i < 1100; i++) {
    g.fillStyle(rand() > 0.5 ? shade(p.ground, 0.2) : shade(p.ground, -0.2), 0.34);
    g.fillCircle(rand() * map.width, rand() * map.height, 1 + rand() * 2.2);
  }

  // ---- Routes -----------------------------------------------------------
  for (const path of geometry.paths) {
    if (path.aquatic) continue;
    const w = path.def.width;
    strokeCorridor(g, path.points, w + 5, p.pathEdge, 1);
    strokeCorridor(g, path.points, w, p.path, 1);
    strokeCorridor(g, path.points, w - 7, shade(p.path, 0.1), 0.55);
    // Wear marks and scattered gravel along the route.
    for (let i = 4; i < path.points.length; i += 5) {
      const pt = path.points[i];
      const off = (rand() - 0.5) * (w * 1.5);
      g.fillStyle(shade(p.path, rand() > 0.5 ? 0.18 : -0.22), 0.4);
      g.fillEllipse(pt.x + off * 0.4, pt.y + off * 0.4, 5 + rand() * 9, 3 + rand() * 5);
    }
  }

  // ---- Water ------------------------------------------------------------
  for (const region of geometry.water) {
    const deep = mix(p.groundDeep, 0x1c4b63, 0.85);
    const mid = mix(deep, 0x3d8fb0, 0.55);
    const shallow = mix(mid, 0x86d3e0, 0.5);
    // Shoreline halo.
    fillPolygon(g, region.polygon.map((q) => q), shade(shallow, -0.3), 1);
    g.lineStyle(9, mix(p.ground, shallow, 0.5), 0.85);
    g.strokePoints(region.polygon, true);
    fillPolygon(g, region.polygon, mid, 1);
    const c = polygonCentroid(region.polygon);
    for (let i = 0; i < 3; i++) {
      const t = 0.82 - i * 0.2;
      fillPolygon(
        g,
        region.polygon.map((q) => ({ x: c.x + (q.x - c.x) * t, y: c.y + (q.y - c.y) * t })),
        i === 2 ? deep : mix(mid, deep, 0.35 + i * 0.2),
        1,
      );
    }
  }

  // ---- Lava -------------------------------------------------------------
  for (const region of geometry.lava) {
    const crust = mix(p.groundDeep, 0x2b1a16, 0.7);
    fillPolygon(g, region.polygon, shade(crust, 0.18), 1);
    const c = polygonCentroid(region.polygon);
    const shrink = (t: number) => region.polygon.map((q) => ({ x: c.x + (q.x - c.x) * t, y: c.y + (q.y - c.y) * t }));
    fillPolygon(g, shrink(0.92), crust, 1);
    fillPolygon(g, shrink(0.8), 0x7a2b12, 1);
    fillPolygon(g, shrink(0.66), 0xd4521a, 1);
    fillPolygon(g, shrink(0.48), 0xff8a2b, 1);
    fillPolygon(g, shrink(0.26), 0xffd166, 1);
    // Cooled crust cracks floating on the surface.
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 0.55;
      const x = c.x + Math.cos(a) * r * 90;
      const y = c.y + Math.sin(a) * r * 60;
      if (!pointInPolygon(x, y, region.polygon)) continue;
      g.fillStyle(crust, 0.85);
      g.fillEllipse(x, y, 12 + rand() * 22, 7 + rand() * 12);
    }
  }

  // ---- Bridges: decking wherever a land route crosses water -------------
  for (const path of geometry.paths) {
    if (path.aquatic) continue;
    // Collect contiguous runs of route that sit over water, then deck each run
    // as one continuous span so curves stay solid.
    const runs: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    for (const pt of path.points) {
      if (geometry.isInWater(pt.x, pt.y, 2)) {
        run.push(pt);
      } else if (run.length > 1) {
        runs.push(run);
        run = [];
      } else {
        run = [];
      }
    }
    if (run.length > 1) runs.push(run);

    const deckWidth = path.def.width + 7;
    for (const span of runs) {
      // Pilings first, so they read as supporting the deck.
      g.fillStyle(0x4a3620, 0.55);
      for (let i = 0; i < span.length; i += 8) {
        g.fillEllipse(span[i].x + 5, span[i].y + 7, deckWidth * 2.1, deckWidth * 1.3);
      }
      strokeCorridor(g, span, deckWidth + 3, 0x5b4327, 1);
      strokeCorridor(g, span, deckWidth, 0x8a6b40, 1);
      // Plank seams across the deck.
      g.lineStyle(2, 0x6d5330, 0.85);
      for (let i = 2; i < span.length - 1; i += 4) {
        const a = span[i - 1];
        const b = span[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = (-(b.y - a.y) / len) * deckWidth;
        const ny = ((b.x - a.x) / len) * deckWidth;
        g.lineBetween(span[i].x + nx, span[i].y + ny, span[i].x - nx, span[i].y - ny);
      }
      // Handrails.
      for (const side of [1, -1]) {
        const rail = span.map((pt, i) => {
          const a = span[Math.max(0, i - 1)];
          const b = span[Math.min(span.length - 1, i + 1)];
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          return {
            x: pt.x + (-(b.y - a.y) / len) * deckWidth * side,
            y: pt.y + ((b.x - a.x) / len) * deckWidth * side,
          };
        });
        g.lineStyle(3, 0x6d5330, 1);
        g.strokePoints(rail, false);
      }
    }
  }

  // ---- Rock and structures ---------------------------------------------
  for (const region of geometry.solid) {
    const isStructure = region.height === 0;
    const rock = isStructure ? mix(p.rock, 0x8f969c, 0.55) : p.rock;
    const lift = Math.max(8, region.height * 0.55);
    const bounds = region.bounds;
    const span = Math.max(bounds.w, bounds.h);

    // Cast shadow, offset down-right for a consistent light direction.
    fillPolygon(
      g,
      region.polygon.map((q) => ({ x: q.x + lift * 0.55, y: q.y + lift * 0.8 })),
      0x000000,
      0.42,
    );
    // Side wall.
    fillPolygon(g, region.polygon, shade(rock, -0.5), 1);
    // Top face, lifted toward the light.
    const top = region.polygon.map((q) => ({ x: q.x - lift * 0.2, y: q.y - lift * 0.45 }));
    poly(g, top, rock, shade(rock, -0.62), 3);
    const c = polygonCentroid(top);
    fillPolygon(
      g,
      top.map((q) => ({ x: c.x + (q.x - c.x) * 0.72, y: c.y + (q.y - c.y) * 0.72 })),
      shade(rock, 0.18),
      0.8,
    );

    if (!isStructure) {
      // Surface detail: fissures and loose rubble, scaled to the outcrop, so a
      // large mesa does not read as one flat shape.
      const cracks = Math.max(4, Math.round(span / 90));
      for (let i = 0; i < cracks; i++) {
        const a = rand() * Math.PI * 2;
        const r = 0.15 + rand() * 0.5;
        let x = c.x + Math.cos(a) * r * bounds.w * 0.45;
        let y = c.y + Math.sin(a) * r * bounds.h * 0.45;
        g.lineStyle(2.2, shade(rock, -0.34), 0.55);
        g.beginPath();
        g.moveTo(x, y);
        for (let seg = 0; seg < 3; seg++) {
          x += Math.cos(a + (seg % 2 ? 0.8 : -0.6)) * (14 + rand() * span * 0.06);
          y += Math.sin(a + (seg % 2 ? 0.8 : -0.6)) * (10 + rand() * span * 0.05);
          g.lineTo(x, y);
        }
        g.strokePath();
      }
      const rubble = Math.max(5, Math.round(span / 40));
      for (let i = 0; i < rubble; i++) {
        const a = rand() * Math.PI * 2;
        const r = rand() * 0.62;
        const x = c.x + Math.cos(a) * r * bounds.w * 0.5;
        const y = c.y + Math.sin(a) * r * bounds.h * 0.5;
        if (!pointInPolygon(x, y, top)) continue;
        const size = 3 + rand() * 7;
        g.fillStyle(shade(rock, -0.22), 0.85);
        g.fillEllipse(x + 1.5, y + 2, size * 2, size * 1.5);
        g.fillStyle(shade(rock, 0.28), 0.9);
        g.fillEllipse(x, y, size * 1.8, size * 1.3);
      }
    }
  }

  // ---- Spawn mouths -----------------------------------------------------
  for (const spawn of map.spawns) {
    const path = geometry.getPath(spawn.pathId);
    const a = Math.atan2(path.points[3].y - path.points[0].y, path.points[3].x - path.points[0].x);
    g.fillStyle(0x000000, 0.5);
    g.fillEllipse(spawn.x, spawn.y, 128, 96);
    g.fillStyle(shade(p.groundDeep, -0.5), 1);
    g.fillEllipse(spawn.x, spawn.y, 104, 76);
    g.fillStyle(0x000000, 0.72);
    g.fillEllipse(spawn.x + Math.cos(a) * -6, spawn.y + Math.sin(a) * -6, 78, 56);
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      g.fillStyle(p.accent, 0.16 - i * 0.04);
      g.fillCircle(spawn.x + Math.cos(a) * (40 + t * 34), spawn.y + Math.sin(a) * (40 + t * 34), 8 - i * 2);
    }
  }

  // ---- Vignette ---------------------------------------------------------
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    g.lineStyle(10, p.fog, 0.035);
    g.strokeRect(-t * 90, -t * 90, map.width + t * 180, map.height + t * 180);
  }
}

export interface TerrainLayers {
  ground: Phaser.GameObjects.Image;
  noBuild: Phaser.GameObjects.Image;
  waterZone?: Phaser.GameObjects.Image;
  lavaGlow?: Phaser.GameObjects.Image;
  waterGlint?: Phaser.GameObjects.Image;
  decor: Phaser.GameObjects.Image[];
  objective: Phaser.GameObjects.Image;
  ambient?: Phaser.GameObjects.Particles.ParticleEmitter;
  destroy(): void;
}

/** Builds every static and ambient visual layer for a map. */
export function buildTerrain(scene: Phaser.Scene, map: MapDef, geometry: MapGeometry): TerrainLayers {
  bakeTexture(scene, terrainKey(map), map.width, map.height, (g) => drawStaticTerrain(g, map, geometry));

  const ground = scene.add.image(0, 0, terrainKey(map)).setOrigin(0, 0).setDepth(DEPTH.ground);

  // Overlays that answer "where can this go?" the instant a card is picked.
  bakeTexture(scene, `${terrainKey(map)}:nobuild`, map.width, map.height, (g) => {
    for (const path of geometry.paths) {
      if (path.aquatic) continue;
      strokeCorridor(g, path.points, path.def.width + 6, 0xff5c48, 1);
    }
    for (const region of [...geometry.water, ...geometry.lava, ...geometry.solid]) {
      fillPolygon(g, region.polygon, 0xff5c48, 1);
    }
    g.fillStyle(0xff5c48, 1);
    g.fillCircle(map.objective.x, map.objective.y, map.objective.radius + 10);
  });
  const noBuild = scene.add
    .image(0, 0, `${terrainKey(map)}:nobuild`)
    .setOrigin(0, 0)
    .setDepth(DEPTH.placementZone)
    .setAlpha(0.16)
    .setVisible(false);

  let waterZone: Phaser.GameObjects.Image | undefined;
  if (geometry.water.length > 0) {
    bakeTexture(scene, `${terrainKey(map)}:waterzone`, map.width, map.height, (g) => {
      for (const region of geometry.water) fillPolygon(g, region.polygon, 0x6fe4ff, 1);
    });
    waterZone = scene.add
      .image(0, 0, `${terrainKey(map)}:waterzone`)
      .setOrigin(0, 0)
      .setDepth(DEPTH.placementZone)
      .setAlpha(0.2)
      .setVisible(false);
  }

  let lavaGlow: Phaser.GameObjects.Image | undefined;
  if (geometry.lava.length > 0) {
    bakeTexture(scene, lavaGlowKey(map), map.width, map.height, (g) => {
      for (const region of geometry.lava) {
        const c = polygonCentroid(region.polygon);
        for (let i = 0; i < 4; i++) {
          const t = 0.95 - i * 0.2;
          g.fillStyle(i < 2 ? 0xff7a2a : 0xffd166, 0.16);
          g.fillPoints(
            region.polygon.map((q) => ({ x: c.x + (q.x - c.x) * t, y: c.y + (q.y - c.y) * t })),
            true,
          );
        }
      }
    });
    lavaGlow = scene.add
      .image(0, 0, lavaGlowKey(map))
      .setOrigin(0, 0)
      .setDepth(DEPTH.terrainFx)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5);
    scene.tweens.add({
      targets: lavaGlow,
      alpha: { from: 0.32, to: 0.78 },
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  let waterGlint: Phaser.GameObjects.Image | undefined;
  if (geometry.water.length > 0) {
    bakeTexture(scene, waterGlintKey(map), map.width, map.height, (g) => {
      const rand = makeRandom(map.width + 13);
      for (const region of geometry.water) {
        const c = polygonCentroid(region.polygon);
        for (let i = 0; i < 34; i++) {
          const a = rand() * Math.PI * 2;
          const r = rand() * 0.85;
          const x = c.x + Math.cos(a) * r * 130;
          const y = c.y + Math.sin(a) * r * 90;
          if (!pointInPolygon(x, y, region.polygon)) continue;
          g.fillStyle(0xdff6ff, 0.34);
          g.fillEllipse(x, y, 16 + rand() * 26, 2.4 + rand() * 2);
        }
      }
    });
    waterGlint = scene.add
      .image(0, 0, waterGlintKey(map))
      .setOrigin(0, 0)
      .setDepth(DEPTH.terrainFx)
      .setAlpha(0.55);
    scene.tweens.add({
      targets: waterGlint,
      alpha: { from: 0.3, to: 0.72 },
      x: { from: -5, to: 5 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ---- Decor -------------------------------------------------------------
  const decor: Phaser.GameObjects.Image[] = [];
  const kinds = new Set<DecorItem['kind']>(map.decor.map((d) => d.kind));
  for (const kind of kinds) bakeDecor(scene, kind, map.theme, map.palette);

  map.decor.forEach((item, i) => {
    const img = scene.add
      .image(item.x, item.y, decorKey(item.kind, map.theme))
      .setDepth(DEPTH.decor)
      .setScale(item.scale ?? 1)
      .setRotation(item.rotation ?? 0);
    decor.push(img);
    // Slow wind sway on anything leafy. Staggered so the field never pulses.
    if (item.kind === 'tree' || item.kind === 'palm' || item.kind === 'fern' || item.kind === 'reed') {
      scene.tweens.add({
        targets: img,
        rotation: (item.rotation ?? 0) + (i % 2 ? 0.028 : -0.028),
        duration: 2400 + (i % 7) * 260,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: (i % 11) * 180,
      });
    }
  });

  // ---- Objective ---------------------------------------------------------
  bakeObjective(scene, map.objective.kind);
  const objective = scene.add
    .image(map.objective.x, map.objective.y, objectiveKey(map.objective.kind))
    .setDepth(DEPTH.objective);

  // ---- Ambient particles -------------------------------------------------
  let ambient: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
  const bounds = new Phaser.Geom.Rectangle(0, 0, map.width, map.height);
  if (map.theme === 'volcanic') {
    ambient = scene.add.particles(0, 0, FX.ember, {
      emitZone: { type: 'random', source: bounds, quantity: 1 },
      lifespan: 5200,
      speedY: { min: 6, max: 24 },
      speedX: { min: -14, max: 14 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.85, end: 0 },
      frequency: 90,
      blendMode: Phaser.BlendModes.ADD,
    });
  } else if (map.theme === 'canyon') {
    ambient = scene.add.particles(0, 0, FX.dust, {
      emitZone: { type: 'random', source: bounds, quantity: 1 },
      lifespan: 7000,
      speedX: { min: 8, max: 26 },
      speedY: { min: -6, max: 6 },
      scale: { start: 0.32, end: 0 },
      alpha: { start: 0.28, end: 0 },
      frequency: 220,
    });
  } else {
    ambient = scene.add.particles(0, 0, FX.spark, {
      emitZone: { type: 'random', source: bounds, quantity: 1 },
      lifespan: 4200,
      speedX: { min: -12, max: 12 },
      speedY: { min: -16, max: -2 },
      scale: { start: 0.36, end: 0 },
      alpha: { start: 0.55, end: 0 },
      frequency: 190,
      tint: map.theme === 'wetlands' ? 0xbfe8d0 : 0xf5e08a,
      blendMode: Phaser.BlendModes.ADD,
    });
  }
  ambient?.setDepth(DEPTH.ambient);

  return {
    ground,
    noBuild,
    waterZone,
    lavaGlow,
    waterGlint,
    decor,
    objective,
    ambient,
    destroy() {
      ground.destroy();
      noBuild.destroy();
      waterZone?.destroy();
      lavaGlow?.destroy();
      waterGlint?.destroy();
      decor.forEach((d) => d.destroy());
      objective.destroy();
      ambient?.destroy();
    },
  };
}
