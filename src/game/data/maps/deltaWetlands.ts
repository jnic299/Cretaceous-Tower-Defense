import type { MapDef } from '../../types';
import { g, wave } from '../waves';
import { bandPolygon, blobPolygon } from './helpers';

const RIVER = [
  { x: -60, y: 596 },
  { x: 180, y: 566 },
  { x: 396, y: 604 },
  { x: 604, y: 560 },
  { x: 776, y: 452 },
  { x: 932, y: 404 },
  { x: 1080, y: 448 },
  { x: 1340, y: 470 },
];

const TRIBUTARY = [
  { x: 396, y: 604 },
  { x: 372, y: 452 },
  { x: 430, y: 300 },
  { x: 402, y: 150 },
  { x: 420, y: -40 },
];

/**
 * MAP 2 — Delta Wetlands.
 * Water is both a hazard and an opportunity: land defenders cannot stand in
 * it, River Patrol can stand nowhere else, and the deep channel is a second
 * route that amphibious animals use to walk straight past your land defence.
 */
export const DELTA_WETLANDS: MapDef = {
  id: 'deltaWetlands',
  name: 'Delta Wetlands',
  subtitle: 'Lower Basin — Evacuation Pad 2',
  description:
    'Braided river delta with two bridge crossings and a deep central channel. The channel was written up as a natural barrier. That assessment is now under review.',
  theme: 'wetlands',
  difficulty: 2,
  unlockCost: 300,
  starsRequired: 2,
  width: 1280,
  height: 720,
  startingSupply: 300,
  firstClearAmber: 260,
  amberPerStar: 75,
  features: ['Deep water channel', 'Two bridge crossings', 'Water-only placement zones'],
  expectedSpecies: [
    'compsognathus',
    'velociraptor',
    'dilophosaurus',
    'parasaurolophus',
    'ankylosaurus',
    'carnotaurus',
    'spinosaurus',
  ],
  palette: {
    ground: 0x4a5f3c,
    groundAlt: 0x57703f,
    groundDeep: 0x35492c,
    path: 0x8a7654,
    pathEdge: 0x66563a,
    foliage: 0x37663a,
    foliageDark: 0x22462a,
    accent: 0xbfd6c0,
    fog: 0x0d1a1c,
  },
  objective: {
    name: 'Evacuation Pad 2',
    kind: 'evac',
    x: 1122,
    y: 210,
    radius: 48,
    hp: 100,
  },
  paths: [
    {
      id: 'shoreline',
      width: 32,
      waypoints: [
        { x: -50, y: 200 },
        { x: 180, y: 216 },
        { x: 288, y: 330 },
        { x: 396, y: 452 },
        { x: 402, y: 560 },
        { x: 396, y: 640 },
        { x: 610, y: 668 },
        { x: 786, y: 606 },
        { x: 830, y: 470 },
        { x: 806, y: 350 },
        { x: 900, y: 264 },
        { x: 1064, y: 224 },
      ],
    },
    {
      id: 'channel',
      width: 46,
      aquatic: true,
      waypoints: [
        { x: -60, y: 596 },
        { x: 180, y: 566 },
        { x: 396, y: 604 },
        { x: 604, y: 560 },
        { x: 776, y: 452 },
        { x: 932, y: 404 },
        { x: 1040, y: 352 },
        { x: 1084, y: 262 },
      ],
    },
  ],
  spawns: [
    { id: 'westBank', x: -50, y: 200, pathId: 'shoreline', label: 'West Bank' },
    { id: 'deepChannel', x: -60, y: 596, pathId: 'channel', label: 'Deep Channel' },
  ],
  terrain: [
    { kind: 'water', polygon: bandPolygon(RIVER, 74) },
    { kind: 'water', polygon: bandPolygon(TRIBUTARY, 52) },
    { kind: 'water', polygon: blobPolygon(198, 402, 108, 74, 12, 7) },
    { kind: 'water', polygon: blobPolygon(688, 214, 122, 82, 12, 19) },
    { kind: 'water', polygon: blobPolygon(1050, 604, 118, 70, 12, 31) },
    {
      kind: 'structure',
      blocksSight: false,
      polygon: [
        { x: 1064, y: 152 },
        { x: 1188, y: 152 },
        { x: 1188, y: 272 },
        { x: 1064, y: 272 },
      ],
    },
    {
      kind: 'rock',
      height: 22,
      blocksSight: true,
      polygon: [
        { x: 546, y: 356 },
        { x: 646, y: 330 },
        { x: 690, y: 402 },
        { x: 612, y: 452 },
        { x: 534, y: 424 },
      ],
    },
    {
      kind: 'rock',
      height: 18,
      blocksSight: true,
      polygon: [
        { x: 118, y: 62 },
        { x: 236, y: 46 },
        { x: 268, y: 118 },
        { x: 168, y: 152 },
        { x: 96, y: 124 },
      ],
    },
  ],
  decor: [
    { kind: 'palm', x: 96, y: 316, scale: 1.1 },
    { kind: 'palm', x: 258, y: 552, scale: 1 },
    { kind: 'palm', x: 524, y: 118, scale: 1.2 },
    { kind: 'palm', x: 892, y: 128, scale: 1.05 },
    { kind: 'palm', x: 1206, y: 400, scale: 1.15 },
    { kind: 'palm', x: 700, y: 700, scale: 1 },
    { kind: 'palm', x: 60, y: 690, scale: 0.9 },
    { kind: 'palm', x: 1236, y: 664, scale: 1 },
    { kind: 'reed', x: 300, y: 630 },
    { kind: 'reed', x: 500, y: 640 },
    { kind: 'reed', x: 660, y: 606 },
    { kind: 'reed', x: 866, y: 512 },
    { kind: 'reed', x: 1006, y: 462 },
    { kind: 'reed', x: 128, y: 546 },
    { kind: 'reed', x: 330, y: 384 },
    { kind: 'reed', x: 470, y: 250 },
    { kind: 'reed', x: 604, y: 172 },
    { kind: 'reed', x: 968, y: 624 },
    { kind: 'fern', x: 176, y: 128 },
    { kind: 'fern', x: 336, y: 176 },
    { kind: 'fern', x: 760, y: 320 },
    { kind: 'fern', x: 940, y: 172 },
    { kind: 'boulder', x: 470, y: 496, scale: 0.85 },
    { kind: 'boulder', x: 872, y: 660, scale: 0.9 },
    { kind: 'bone', x: 246, y: 470, rotation: 0.9 },
    { kind: 'crate', x: 1044, y: 306 },
    { kind: 'barrel', x: 1206, y: 296 },
    { kind: 'tent', x: 1216, y: 210, scale: 1.05 },
    { kind: 'antenna', x: 1126, y: 140, scale: 1.1 },
    { kind: 'lamp', x: 1040, y: 176 },
    { kind: 'lamp', x: 1050, y: 262 },
  ],
  waves: [
    wave(1, 34, [g('compsognathus', 'green', 8, 620, 0, 'westBank')], { name: 'Bank Scouts' }),
    wave(2, 38, [
      g('velociraptor', 'green', 5, 900, 0, 'westBank'),
      g('compsognathus', 'green', 6, 500, 2600, 'westBank'),
    ]),
    wave(3, 44, [
      g('compsognathus', 'blue', 10, 460, 0, 'westBank'),
      g('velociraptor', 'green', 4, 800, 1200, 'deepChannel'),
    ], { name: 'Something In The Water' }),
    wave(4, 52, [
      g('dilophosaurus', 'green', 4, 1300, 0, 'westBank'),
      g('velociraptor', 'blue', 5, 850, 2000, 'deepChannel'),
    ]),
    wave(5, 60, [
      g('parasaurolophus', 'green', 4, 1700, 0, 'westBank'),
      g('compsognathus', 'blue', 12, 380, 1400, 'deepChannel'),
    ], { name: 'Delta Chorus' }),
    wave(6, 70, [
      g('ankylosaurus', 'green', 2, 3000, 0, 'westBank'),
      g('dilophosaurus', 'blue', 5, 1100, 1600, 'deepChannel'),
    ], { name: 'Plated' }),
    wave(7, 80, [
      g('velociraptor', 'orange', 6, 780, 0, 'westBank'),
      g('velociraptor', 'orange', 6, 780, 900, 'deepChannel'),
    ], { name: 'Both Banks' }),
    wave(8, 92, [
      g('carnotaurus', 'green', 2, 2600, 0, 'westBank'),
      g('compsognathus', 'orange', 14, 320, 1200, 'deepChannel'),
    ], { name: 'Horned Runner' }),
    wave(9, 106, [
      g('ankylosaurus', 'blue', 3, 2600, 0, 'deepChannel'),
      g('dilophosaurus', 'orange', 5, 1100, 1800, 'westBank'),
      g('parasaurolophus', 'blue', 3, 1900, 4200, 'westBank'),
    ]),
    wave(10, 122, [
      g('carnotaurus', 'blue', 3, 2200, 0, 'westBank'),
      g('velociraptor', 'orange', 8, 620, 1000, 'deepChannel'),
    ], { name: 'Pressure' }),
    wave(11, 140, [
      g('spinosaurus', 'green', 1, 0, 0, 'deepChannel'),
      g('compsognathus', 'orange', 16, 300, 1500, 'westBank'),
    ], { name: 'Sail On The Water' }),
    wave(12, 158, [
      g('ankylosaurus', 'orange', 3, 2600, 0, 'westBank'),
      g('carnotaurus', 'blue', 3, 2000, 1400, 'deepChannel'),
      g('dilophosaurus', 'orange', 6, 950, 3800, 'westBank'),
    ], { name: 'Combined Push' }),
    wave(13, 180, [
      g('velociraptor', 'red', 6, 700, 0, 'westBank'),
      g('velociraptor', 'red', 6, 700, 700, 'deepChannel'),
      g('parasaurolophus', 'orange', 4, 1700, 3000, 'westBank'),
    ], { name: 'Crimson Pack' }),
    wave(
      14,
      300,
      [
        g('compsognathus', 'red', 16, 280, 0, 'westBank'),
        g('carnotaurus', 'orange', 3, 1800, 2000, 'westBank'),
        g('spinosaurus', 'blue', 1, 0, 6000, 'deepChannel'),
      ],
      { name: 'The Delta Alpha', boss: true },
    ),
  ],
};
