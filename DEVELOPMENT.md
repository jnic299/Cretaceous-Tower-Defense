# Development Log

Working notes for Cretaceous Tower Defense: what is finished, what is
deliberately deferred, and why the important decisions went the way they did.

---

## Status

**V1 is complete and playable end to end.** Title → map select → hero and
loadout → match → results → armory → unlock → replay, with progression that
survives a page refresh.

### Completed systems

**Foundation**
- Vite + TypeScript project references, ESLint flat config, Vitest
- Phaser 3.90 canvas hosted by React, torn down with the screen that owns it
- Typed event bus (`src/game/events.ts`) as the only React ↔ Phaser channel
- Versioned saves behind `GameSaveRepository`, localStorage implementation
- Static build verified; Vercel config committed

**Simulation**
- Waypoint routes resampled through a centripetal Catmull-Rom spline
- Per-animal lane offsets and speed variance, so a wave reads as a herd
- Walk-cycle animation driven by distance travelled — slowed animals visibly
  slow their gait
- Six attack patterns: projectile, radial, cone, hitscan, chain, lobbed
- Armour as flat reduction with a damage floor, plus per-weapon armour piercing
- Status effects: burn (ignores armour), slow, stun, knockback
- Splash with linear falloff; chain arcs with per-jump decay
- Line-of-sight rejection against map geometry, bounding-box pre-pass, with
  lobbed weapons deliberately exempt
- Uniform spatial grid rebuilt per frame for targeting, splash and chain queries
- Five targeting modes, selectable per placement
- Aura system (Field Engineer, Supply Cache) recomputed on a throttle
- Species traits: pack, sprint, armoured, steadfast, herd, rally, boss,
  amphibious
- Pooled projectiles with swept collision, so fast rounds cannot tunnel

**Content**
- Four maps: Research Outpost, Delta Wetlands, Caldera Station, Fossil Canyon
- Ten species across five durability tiers
- Eight defenders, five turrets, four fixtures, three heroes
- Six challenges with data-driven rule modifiers
- 60 hand-authored waves with boss finales

**Presentation**
- Fully procedural art: dinosaurs from body specs, units as base + rotating
  top, terrain baked to one texture per map
- Muzzle flashes, beams, lightning arcs, flame cones, explosions, floating
  damage numbers, corpses, dust, ambient particles, screen shake
- Wind sway on foliage, animated water glint, pulsing lava glow, drifting embers
- Procedural audio: 25 synthesised cues plus an ambient generative bed

**Progression**
- Amber and Supply as separate economies
- Three-star ratings, armory unlocks, star-gated maps, lifetime stats, codex
- Save migration (v1 → v2) with defensive normalisation

**Testing**
- 181 unit tests, including a data-integrity suite over the balance tables
- Browser verification with Playwright: full playthroughs, terrain rule checks

---

## Major design decisions

**Phaser 3, not Phaser 4.** The brief allowed either and asked not to chase
novelty. Phaser 3.90 is the mature line with settled APIs; nothing in this game
needs Phaser 4.

**React never drives the game loop.** Phaser owns simulation and rendering. The
scene publishes an immutable HUD snapshot roughly fifteen times a second, and
React sends back discrete commands. Measured in the browser, the deploy bar
records zero DOM mutations over four seconds of live play — the HUD costs
effectively nothing per frame.

**All art is generated.** Rather than ship placeholder rectangles or lean on
emoji, every sprite is drawn from a specification: dinosaurs from proportions,
units from a chassis and weapon type, terrain from map polygons. Two payoffs —
the art is internally consistent because it comes from one construction
language, and a new species is a data entry rather than an art task. The same
specs feed the SVG art in the menus, so the codex shows the same creature as
the battlefield.

**Textures are baked, not drawn live.** A map's entire static environment
becomes one texture at match start; dinosaur frames are baked only for the
species and tier combinations that map's waves actually field. This keeps the
environment at one draw call and bounds texture memory to what the level needs.

**Colour is never the only channel.** Tier is carried by colour, by a pip count
beside the health bar, and by a silhouette marking pattern. A high-contrast
setting shows every bar at all times.

**Placement is one pure function.** `evaluatePlacement` is shared by the ghost
preview, the click handler and the tests, so the preview can never disagree
with what a click actually does. It returns the most informative failure first
— a player hovering lava is told about the lava, not about their Supply.

**Fixtures cannot break pathing.** Routes are fixed, so nothing can wall a lane
off. The Barricade is a heavy slow that grinds down as animals push through;
the Decoy holds nearby animals in place until they destroy it or it expires.
Both are temporary by construction.

**Audio is synthesised.** No sample files means nothing in the repository can
be anyone else's audio, and the whole game is a few hundred kilobytes of code.

**Balance lives in data, and the data is tested.** `tests/dataIntegrity.test.ts`
asserts the invariants a balance table must hold. A typo in a wave list fails
in CI rather than in a player's match.

---

## Balance notes

Tuned so that the shape of the difficulty curve is visible in play:

- Armour is flat reduction, which is what makes rapid low-calibre fire the
  wrong answer to plating. A Ranger dart against an orange Ankylosaurus lands
  for the floor; a Rail Turret round barely notices the plate. Burn bypasses
  armour entirely, which is Fred's answer to the same problem.
- Objective damage rises far more slowly than health across tiers. Late waves
  are meant to be difficult to kill, not to end the level on one leak.
- Amber pays for progress, not for grinding. Waves and bosses pay every run;
  first clears and *newly earned* stars pay once. A three-star map replayed
  still pays wave Amber.
- A first three-star clear of Research Outpost pays enough Amber to buy a
  meaningful unlock immediately.

Verified by driving the built game: a thin six-unit board reaches the final
boss wave of Research Outpost and loses; an eighteen-unit board with a hero and
upgrades wins at 56% integrity for two stars. Both outcomes are the intended
shape — the level is losable and the win is earned.

---

## Known issues and limitations

- **Desktop only by design.** The layout targets 1280×720 and up. It scales
  down but the HUD gets tight below roughly 1100px wide. Touch input is not
  handled; the fixed 1280×720 world and `Scale.FIT` mean tablet support is a
  layout and input problem, not an architectural one.
- **Frame rate was not measured on real hardware.** Verification ran under
  SwiftShader software rasterisation in a container, which caps at single-digit
  FPS on an empty field — that number reflects the software rasteriser, not the
  simulation. The simulation side is bounded (spatial-grid queries, pooled
  projectiles, one draw call for terrain, sprite reuse for enemies), but a
  profile on a real GPU under a heavy obsidian wave is still outstanding.
- **The tutorial is coaching, not a scripted sequence.** It reacts to real
  events rather than gating the player, which means a player who ignores it
  can walk into wave 1 undefended.
- **No pause menu restart.** Abandoning returns to map select; the results
  screen offers a replay.
- **Wave composition is hand-authored, not generated.** Sixty waves are tuned
  by hand, which is the right call for four maps and would not scale to forty.

---

## Deferred

Deliberately out of scope for V1, in rough priority order:

1. A fifth map and a second boss species per site
3. Endless / survival mode reusing the existing wave builder
4. Per-defender upgrade *branches* rather than a single three-step line
5. Cosmetic unlocks
6. Cloud saves — the repository interface is already the seam for this
7. Tablet layout and touch input

---

## Changelog

**v1.0 — initial release**
- Complete game: four maps, ten species, twenty placeables, three heroes,
  six challenges, full progression, 181 tests.
- Fixed during verification:
  - River Patrol could not deploy onto the water lane it exists to cover;
    water units are now exempt from the aquatic route restriction only.
  - The swarm challenge stretched a wave's spawn window instead of packing
    extra animals into it.
  - Hero deployment and repositioning showed no placement feedback, because
    the hint was tied to a deployment card the hero does not have.
  - The default loadout took the first six placeables in catalog order, which
    silently excluded every turret from a player who owned six defenders.
  - The Sentry Turret shipped in the starting kit while still priced at 200
    Amber.
  - Fossil Canyon had almost no value separation between sand, rock and
    shadow; palettes now carry an explicit stone colour per site.
  - Bridge decking fanned apart on curves; spans are now decked as continuous
    runs with plank seams and handrails.
