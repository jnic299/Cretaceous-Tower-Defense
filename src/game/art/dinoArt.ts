import Phaser from 'phaser';
import type { DinoBodySpec, SpeciesDef, SpeciesId, TierDef, TierId } from '../types';
import { getSpecies } from '../data/dinosaurs';
import { getTier } from '../data/tiers';
import { makeRandom, mix, shade } from './color';
import { bakeTexture, poly, ribbon } from './draw';

import {
  DINO_FRAMES,
  DINO_RENDER_SCALE,
  DINO_SUPERSAMPLE,
  dinoShadowKey,
  dinoTextureKey,
} from './keys';

export { DINO_FRAMES, DINO_RENDER_SCALE, DINO_SUPERSAMPLE, dinoShadowKey, dinoTextureKey };

interface Palette {
  base: number;
  light: number;
  dark: number;
  darker: number;
  belly: number;
  outline: number;
  claw: number;
  eye: number;
  mark: number;
}

function palette(tier: TierDef): Palette {
  const base = tier.color;
  return {
    base,
    light: shade(base, 0.24),
    dark: shade(base, -0.3),
    darker: shade(base, -0.5),
    belly: mix(base, 0xffe6bd, 0.5),
    outline: shade(base, -0.7),
    claw: 0xf0e6cd,
    eye: 0x18161c,
    mark: shade(base, -0.58),
  };
}

/**
 * Draws the tier's marking pattern clipped roughly to the torso. Markings are
 * the accessibility backstop for the colour tiers: even in greyscale, a
 * chevron-marked animal reads as more dangerous than a plain one.
 */
function drawMarkings(
  g: Phaser.GameObjects.Graphics,
  tier: TierDef,
  p: Palette,
  bodyX: number,
  bodyY: number,
  bodyLen: number,
  bodyWid: number,
  seed: number,
): void {
  const rand = makeRandom(seed);
  switch (tier.pattern) {
    case 'plain':
      return;
    case 'speckle': {
      for (let i = 0; i < 9; i++) {
        const t = rand();
        const x = bodyX - bodyLen * 0.45 + t * bodyLen * 0.9;
        const y = bodyY + (rand() - 0.5) * bodyWid * 1.25;
        g.fillStyle(p.mark, 0.75);
        g.fillCircle(x, y, 1.1 + rand() * 1.5);
      }
      return;
    }
    case 'stripe': {
      for (let i = 0; i < 5; i++) {
        const x = bodyX - bodyLen * 0.4 + (i / 4) * bodyLen * 0.8;
        const h = bodyWid * (0.85 - Math.abs(i - 2) * 0.12);
        g.fillStyle(p.mark, 0.7);
        g.fillEllipse(x, bodyY, 2.6, h * 2);
      }
      return;
    }
    case 'chevron': {
      for (let i = 0; i < 4; i++) {
        const x = bodyX - bodyLen * 0.34 + (i / 3) * bodyLen * 0.68;
        const w = 3.4;
        const h = bodyWid * 0.85;
        poly(
          g,
          [
            { x: x - w, y: bodyY - h },
            { x: x + w * 0.5, y: bodyY },
            { x: x - w, y: bodyY + h },
            { x: x - w * 0.1, y: bodyY },
          ],
          p.mark,
          undefined,
          0,
          0.8,
        );
      }
      return;
    }
    case 'crackle': {
      g.lineStyle(1.4, p.mark, 0.9);
      for (let i = 0; i < 6; i++) {
        const x = bodyX - bodyLen * 0.42 + rand() * bodyLen * 0.84;
        const y = bodyY + (rand() - 0.5) * bodyWid * 1.3;
        g.beginPath();
        g.moveTo(x, y);
        let px = x;
        let py = y;
        for (let s = 0; s < 3; s++) {
          px += (rand() - 0.5) * 9;
          py += (rand() - 0.5) * 9;
          g.lineTo(px, py);
        }
        g.strokePath();
      }
      return;
    }
  }
}

function drawCrown(
  g: Phaser.GameObjects.Graphics,
  body: DinoBodySpec,
  p: Palette,
  headX: number,
  headY: number,
  bodyX: number,
  bodyY: number,
): void {
  const hl = body.headLength;
  const hw = body.headWidth;
  switch (body.crown) {
    case 'frill': {
      // Triceratops shield plus three horns, drawn behind the skull.
      const fr = hw * 1.55;
      poly(
        g,
        [
          { x: headX - hl * 0.5, y: headY - fr },
          { x: headX + hl * 0.1, y: headY - fr * 1.05 },
          { x: headX + hl * 0.35, y: headY },
          { x: headX + hl * 0.1, y: headY + fr * 1.05 },
          { x: headX - hl * 0.5, y: headY + fr },
        ],
        p.dark,
        p.outline,
        1.6,
      );
      g.fillStyle(p.darker, 0.55);
      g.fillEllipse(headX - hl * 0.08, headY, hl * 0.5, fr * 1.25);
      for (const s of [-1, 1]) {
        poly(
          g,
          [
            { x: headX + hl * 0.35, y: headY + s * hw * 0.55 },
            { x: headX + hl * 1.15, y: headY + s * hw * 1.05 },
            { x: headX + hl * 0.4, y: headY + s * hw * 0.12 },
          ],
          p.claw,
          p.outline,
          1,
        );
      }
      poly(
        g,
        [
          { x: headX + hl * 0.6, y: headY - hw * 0.16 },
          { x: headX + hl * 1.15, y: headY },
          { x: headX + hl * 0.6, y: headY + hw * 0.16 },
        ],
        p.claw,
        p.outline,
        1,
      );
      return;
    }
    case 'crest': {
      for (const s of [-1, 1]) {
        poly(
          g,
          [
            { x: headX - hl * 0.35, y: headY + s * hw * 0.34 },
            { x: headX + hl * 0.15, y: headY + s * hw * 0.85 },
            { x: headX + hl * 0.5, y: headY + s * hw * 0.42 },
          ],
          p.light,
          p.outline,
          1.2,
        );
      }
      return;
    }
    case 'dome': {
      g.fillStyle(p.light, 1);
      g.fillEllipse(headX - hl * 0.05, headY, hl * 0.95, hw * 1.05);
      g.lineStyle(1.6, p.outline, 1);
      g.strokeEllipse(headX - hl * 0.05, headY, hl * 0.95, hw * 1.05);
      g.fillStyle(p.darker, 0.4);
      g.fillEllipse(headX - hl * 0.05, headY, hl * 0.5, hw * 0.55);
      return;
    }
    case 'horns': {
      for (const s of [-1, 1]) {
        poly(
          g,
          [
            { x: headX + hl * 0.05, y: headY + s * hw * 0.4 },
            { x: headX + hl * 0.42, y: headY + s * hw * 1.2 },
            { x: headX + hl * 0.3, y: headY + s * hw * 0.32 },
          ],
          p.claw,
          p.outline,
          1,
        );
      }
      return;
    }
    case 'tube': {
      poly(
        g,
        [
          { x: headX - hl * 0.4, y: headY - hw * 0.3 },
          { x: headX - hl * 1.5, y: headY - hw * 1.5 },
          { x: headX - hl * 1.15, y: headY - hw * 1.95 },
          { x: headX - hl * 0.2, y: headY - hw * 0.55 },
        ],
        p.light,
        p.outline,
        1.4,
      );
      return;
    }
    case 'sail': {
      // Spinosaurus: tall dorsal sail spanning the torso.
      const len = body.bodyLength;
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      const steps = 9;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = bodyX - len * 0.85 + t * len * 1.75;
        const h = Math.sin(t * Math.PI) * body.bodyWidth * 1.9;
        pts.push({ x, y: bodyY - h });
      }
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        pts.push({ x: bodyX - len * 0.85 + t * len * 1.75, y: bodyY - body.bodyWidth * 0.1 });
      }
      poly(g, pts, p.dark, p.outline, 1.6);
      g.lineStyle(1.3, p.darker, 0.85);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = bodyX - len * 0.85 + t * len * 1.75;
        const h = Math.sin(t * Math.PI) * body.bodyWidth * 1.9;
        g.lineBetween(x, bodyY, x, bodyY - h * 0.94);
      }
      return;
    }
    case 'plates': {
      // Ankylosaurus: overlapping osteoderm rows across the back.
      const len = body.bodyLength;
      for (let row = -1; row <= 1; row++) {
        for (let i = 0; i < 5; i++) {
          const x = bodyX - len * 0.7 + (i / 4) * len * 1.4;
          const y = bodyY + row * body.bodyWidth * 0.62;
          g.fillStyle(row === 0 ? p.light : p.dark, 1);
          g.fillEllipse(x, y, len * 0.3, body.bodyWidth * 0.5);
          g.lineStyle(1.2, p.outline, 0.85);
          g.strokeEllipse(x, y, len * 0.3, body.bodyWidth * 0.5);
        }
      }
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const x = bodyX - len * 0.6 + (i / 3) * len * 1.2;
          poly(
            g,
            [
              { x: x - 3, y: bodyY + s * body.bodyWidth * 1.02 },
              { x: x + 1, y: bodyY + s * body.bodyWidth * 1.55 },
              { x: x + 4, y: bodyY + s * body.bodyWidth * 1.0 },
            ],
            p.claw,
            p.outline,
            1,
          );
        }
      }
      return;
    }
    case 'none':
    default:
      return;
  }
}

/**
 * Draws one walk-cycle frame of a species at a tier. Faces +x, centred on
 * (cx, cy). Everything is derived from the species' body spec, so a new
 * dinosaur is a data entry rather than an art task.
 */
function drawDino(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  species: SpeciesDef,
  tier: TierDef,
  frame: number,
): void {
  const b = species.body;
  const p = palette(tier);
  const phase = (frame / DINO_FRAMES) * Math.PI * 2;
  const swing = Math.sin(phase);
  const swing2 = Math.sin(phase + Math.PI);
  const bob = Math.cos(phase * 2) * b.bobAmount;

  // Body sits slightly forward of centre so the tail has room.
  const bodyX = cx - b.length * 0.06;
  const bodyY = cy + bob;

  // ---- Tail -------------------------------------------------------------
  const tailSpine: { x: number; y: number; w: number }[] = [];
  const tailSteps = 6;
  for (let i = 0; i <= tailSteps; i++) {
    const t = i / tailSteps;
    tailSpine.push({
      x: bodyX - b.bodyLength * 0.85 - t * b.tailLength,
      y: bodyY + Math.sin(t * 2.1 + phase) * b.tailWidth * 0.9 * t,
      w: b.tailWidth * (1 - t * 0.88) + 0.6,
    });
  }
  poly(g, ribbon(tailSpine), p.base, p.outline, 1.6);
  if (b.tailTip === 'club') {
    const tip = tailSpine[tailSpine.length - 1];
    g.fillStyle(p.light, 1);
    g.fillCircle(tip.x - 2, tip.y, b.tailWidth * 1.5);
    g.lineStyle(1.6, p.outline, 1);
    g.strokeCircle(tip.x - 2, tip.y, b.tailWidth * 1.5);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      poly(
        g,
        [
          { x: tip.x - 2 + Math.cos(a) * b.tailWidth * 1.3, y: tip.y + Math.sin(a) * b.tailWidth * 1.3 },
          { x: tip.x - 2 + Math.cos(a) * b.tailWidth * 2.3, y: tip.y + Math.sin(a) * b.tailWidth * 2.3 },
          {
            x: tip.x - 2 + Math.cos(a + 0.5) * b.tailWidth * 1.3,
            y: tip.y + Math.sin(a + 0.5) * b.tailWidth * 1.3,
          },
        ],
        p.claw,
        p.outline,
        0.9,
      );
    }
  } else if (b.tailTip === 'fin') {
    const tip = tailSpine[tailSpine.length - 1];
    const prev = tailSpine[tailSpine.length - 2];
    poly(
      g,
      [
        { x: prev.x, y: prev.y - b.tailWidth * 0.6 },
        { x: tip.x - b.tailLength * 0.16, y: tip.y - b.tailWidth * 1.5 },
        { x: tip.x - b.tailLength * 0.05, y: tip.y },
        { x: tip.x - b.tailLength * 0.16, y: tip.y + b.tailWidth * 1.5 },
        { x: prev.x, y: prev.y + b.tailWidth * 0.6 },
      ],
      p.dark,
      p.outline,
      1.3,
    );
  }

  // ---- Rear limbs (behind the torso) ------------------------------------
  const drawLeg = (
    hipX: number,
    hipY: number,
    dir: number,
    swingAmount: number,
    length: number,
    width: number,
    toe: boolean,
  ) => {
    const kneeX = hipX + swingAmount * length * 0.5;
    const kneeY = hipY + dir * length * 0.55;
    const footX = hipX + swingAmount * length * 0.95;
    const footY = hipY + dir * length * 1.05;
    poly(
      g,
      ribbon([
        { x: hipX, y: hipY, w: width },
        { x: kneeX, y: kneeY, w: width * 0.78 },
        { x: footX, y: footY, w: width * 0.6 },
      ]),
      p.dark,
      p.outline,
      1.3,
    );
    if (toe) {
      for (let i = -1; i <= 1; i++) {
        poly(
          g,
          [
            { x: footX + i * width * 0.55, y: footY },
            { x: footX + i * width * 0.7 + width * 0.5, y: footY + dir * width * 1.5 },
            { x: footX + i * width * 0.55 + width * 0.2, y: footY + dir * width * 0.3 },
          ],
          p.claw,
          undefined,
          0,
        );
      }
    }
  };

  const hipX = bodyX - b.bodyLength * 0.42;
  const legDir = 1;
  if (b.stance === 'biped') {
    drawLeg(hipX, bodyY + b.bodyWidth * 0.35, legDir, swing, b.legLength, b.legWidth, true);
    drawLeg(hipX, bodyY - b.bodyWidth * 0.35, -legDir, swing2, b.legLength, b.legWidth, true);
  } else {
    const shoulderX = bodyX + b.bodyLength * 0.45;
    drawLeg(hipX, bodyY + b.bodyWidth * 0.5, 1, swing, b.legLength, b.legWidth, false);
    drawLeg(hipX, bodyY - b.bodyWidth * 0.5, -1, swing2, b.legLength, b.legWidth, false);
    drawLeg(shoulderX, bodyY + b.bodyWidth * 0.46, 1, swing2, b.legLength * 0.92, b.legWidth * 0.92, false);
    drawLeg(shoulderX, bodyY - b.bodyWidth * 0.46, -1, swing, b.legLength * 0.92, b.legWidth * 0.92, false);
  }

  // ---- Torso ------------------------------------------------------------
  const torso: { x: number; y: number; w: number }[] = [
    { x: bodyX - b.bodyLength * 0.9, y: bodyY, w: b.bodyWidth * 0.55 },
    { x: bodyX - b.bodyLength * 0.45, y: bodyY, w: b.bodyWidth * 0.98 },
    { x: bodyX + b.bodyLength * 0.1, y: bodyY, w: b.bodyWidth },
    { x: bodyX + b.bodyLength * 0.62, y: bodyY, w: b.bodyWidth * 0.78 },
    { x: bodyX + b.bodyLength * 0.95, y: bodyY, w: b.bodyWidth * 0.46 },
  ];
  poly(g, ribbon(torso), p.base, p.outline, 2);

  // Lighting: bright ridge along the top, shadow along the bottom.
  g.fillStyle(p.light, 0.85);
  g.fillEllipse(bodyX, bodyY - b.bodyWidth * 0.42, b.bodyLength * 1.5, b.bodyWidth * 0.72);
  g.fillStyle(p.dark, 0.5);
  g.fillEllipse(bodyX, bodyY + b.bodyWidth * 0.55, b.bodyLength * 1.45, b.bodyWidth * 0.6);
  g.fillStyle(p.belly, 0.35);
  g.fillEllipse(bodyX + b.bodyLength * 0.15, bodyY, b.bodyLength * 0.9, b.bodyWidth * 0.5);

  drawMarkings(g, tier, p, bodyX, bodyY, b.bodyLength * 1.7, b.bodyWidth, species.name.length * 977 + tier.rank);

  // ---- Dorsal spines ----------------------------------------------------
  if (b.spines > 0) {
    for (let i = 0; i < b.spines; i++) {
      const t = i / (b.spines - 1 || 1);
      const x = bodyX - b.bodyLength * 0.8 + t * b.bodyLength * 1.7;
      const h = 1.6 + Math.sin(t * Math.PI) * b.bodyWidth * 0.42;
      poly(
        g,
        [
          { x: x - 1.6, y: bodyY - b.bodyWidth * 0.72 },
          { x: x, y: bodyY - b.bodyWidth * 0.72 - h },
          { x: x + 1.6, y: bodyY - b.bodyWidth * 0.72 },
        ],
        p.darker,
        undefined,
        0,
        0.9,
      );
    }
  }

  // ---- Neck and head ----------------------------------------------------
  const neckBaseX = bodyX + b.bodyLength * 0.8;
  const headX = neckBaseX + b.neckLength + b.headLength * 0.45;
  const headY = bodyY - bob * 0.4;
  poly(
    g,
    ribbon([
      { x: neckBaseX - 2, y: bodyY, w: b.neckWidth * 1.15 },
      { x: neckBaseX + b.neckLength * 0.5, y: bodyY - b.neckWidth * 0.18, w: b.neckWidth },
      { x: neckBaseX + b.neckLength, y: headY, w: b.neckWidth * 0.92 },
    ]),
    p.base,
    p.outline,
    1.6,
  );

  drawCrown(g, b, p, headX, headY, bodyX, bodyY);

  // Skull
  poly(
    g,
    ribbon([
      { x: headX - b.headLength * 0.55, y: headY, w: b.headWidth * 0.75 },
      { x: headX - b.headLength * 0.05, y: headY, w: b.headWidth * 0.92 },
      { x: headX + b.headLength * 0.42, y: headY, w: b.headWidth * 0.66 },
      { x: headX + b.headLength * 0.62, y: headY, w: b.headWidth * 0.3 },
    ]),
    p.light,
    p.outline,
    1.6,
  );

  // Jaw — a wedge under the snout gives the profile some bite.
  if (b.jaw > 1.8) {
    poly(
      g,
      [
        { x: headX - b.headLength * 0.1, y: headY + b.headWidth * 0.3 },
        { x: headX + b.headLength * 0.6, y: headY + b.headWidth * 0.14 },
        { x: headX + b.headLength * 0.52, y: headY + b.headWidth * 0.36 + b.jaw * 0.5 },
        { x: headX - b.headLength * 0.05, y: headY + b.headWidth * 0.55 + b.jaw * 0.3 },
      ],
      p.dark,
      p.outline,
      1.2,
    );
    g.fillStyle(p.claw, 1);
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      g.fillTriangle(
        headX + b.headLength * (0.08 + t * 0.42),
        headY + b.headWidth * 0.3,
        headX + b.headLength * (0.14 + t * 0.42),
        headY + b.headWidth * 0.3 + b.jaw * 0.8,
        headX + b.headLength * (0.2 + t * 0.42),
        headY + b.headWidth * 0.3,
      );
    }
  }

  // Eye with a highlight — small, but it is what makes it read as an animal.
  const eyeX = headX - b.headLength * 0.12;
  const eyeY = headY - b.headWidth * 0.38;
  const eyeR = Math.max(1.1, b.headWidth * 0.17);
  g.fillStyle(p.claw, 1);
  g.fillCircle(eyeX, eyeY, eyeR * 1.5);
  g.fillStyle(p.eye, 1);
  g.fillCircle(eyeX, eyeY, eyeR);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(eyeX + eyeR * 0.35, eyeY - eyeR * 0.35, eyeR * 0.38);

  // Small forelimbs on bipeds.
  if (b.stance === 'biped') {
    const armX = bodyX + b.bodyLength * 0.5;
    for (const s of [-1, 1]) {
      poly(
        g,
        ribbon([
          { x: armX, y: bodyY + s * b.bodyWidth * 0.55, w: b.legWidth * 0.55 },
          {
            x: armX + b.legLength * 0.42 + swing * 1.5,
            y: bodyY + s * (b.bodyWidth * 0.85 + b.legLength * 0.2),
            w: b.legWidth * 0.35,
          },
        ]),
        p.dark,
        p.outline,
        1,
      );
    }
  }
}

/** Texture footprint for a species, before tier scaling. */
export function dinoTextureSize(species: SpeciesDef): { w: number; h: number } {
  const b = species.body;
  const w = (b.bodyLength * 2 + b.tailLength + b.neckLength + b.headLength) * 1.25 + 24;
  const h = Math.max(b.bodyWidth * 4.6, b.legLength * 3.4, b.headWidth * 4.4) + 24;
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

/** Bakes every walk frame for one species/tier combination. */
export function bakeDinoVariant(scene: Phaser.Scene, speciesId: SpeciesId, tierId: TierId): void {
  const species = getSpecies(speciesId);
  const tier = getTier(tierId);
  const size = dinoTextureSize(species);
  const bake = DINO_SUPERSAMPLE * DINO_RENDER_SCALE;
  const w = size.w * bake;
  const h = size.h * bake;

  for (let frame = 0; frame < DINO_FRAMES; frame++) {
    const key = dinoTextureKey(speciesId, tierId, frame);
    if (scene.textures.exists(key)) continue;
    bakeTexture(scene, key, w, h, (g, cx, cy) => {
      g.scale = bake;
      drawDino(g, cx / bake, cy / bake, species, tier, frame);
    });
  }
}

/** Soft ellipse used as the ground shadow for every unit and animal. */
export function bakeShadow(scene: Phaser.Scene): void {
  bakeTexture(scene, dinoShadowKey(), 96, 64, (g, cx, cy) => {
    for (let i = 8; i >= 1; i--) {
      const t = i / 8;
      g.fillStyle(0x000000, 0.06);
      g.fillEllipse(cx, cy, 92 * t, 58 * t);
    }
  });
}
