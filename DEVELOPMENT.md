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
- 199 written `it()` declarations, executing as 229 cases (`tests/dataIntegrity`
  parameterises 10 of them over the four maps). Run `npm test` to reproduce.
- A committed Playwright smoke suite: 11 browser tests, `npm run test:e2e`

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
- **Balance at 2x and 3x is now materially easier than previously measured,
  and has not been retuned.** See "Balance after the timing fix" below. The
  numbers themselves are untouched; the decision to retune is not ours to make
  on this evidence alone.
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
2. Endless / survival mode reusing the existing wave builder
3. Per-defender upgrade *branches* rather than a single three-step line
4. Cosmetic unlocks
5. Cloud saves — the repository interface is already the seam for this
6. Tablet layout and touch input

---

## Verified end to end

`npm test` and `npm run test:e2e` both pass. Driving the production build in a
browser from an empty save, after the integrity pass:

| Step | Result |
| --- | --- |
| Fresh profile → first clear of Research Outpost | Perimeter Held, 1 star |
| Kit available | Ranger and Sentry Turret only |
| Placements / upgrades / hero abilities used | 20 / 10 / 8 |
| Species met | 6, including the Tyrannosaurus boss on wave 12 |
| Amber earned, then spent | 328 → Spike Gunner unlocked → 68 remaining |
| After a page reload | Amber, stars and unlocks all intact |
| Console errors | 0 |

---

## Balance after the timing fix

Fixing game speed changed what 2x and 3x actually do, so measurements taken at
those speeds before the fix no longer describe the game.

**What was wrong.** Gameplay deadlines — attack cooldowns, status expiry, hero
cooldowns — were read from Phaser's `scene.time.now`, which is raw wall-clock
time. Movement, waves and burn ticks advanced on the scaled simulation delta.
At 3x the world moved three times faster while defenders' cooldowns kept
ticking in real time, so **every defender fired at a third of its intended rate
relative to the enemies it was shooting at**, while slows and stuns lasted three
times longer in gameplay terms. Pausing did not stop the wall clock at all.

**What that means for the numbers.** 1x was very nearly correct already: at
speed 1 the scaled delta and the wall clock advance together, so single-speed
balance is essentially unchanged. The change is confined to 2x, 3x and pause.

**Measured, same build, same bot, same map (Research Outpost at 3x):**

| Board | Before the fix | After the fix |
| --- | --- | --- |
| 18 placements, hero, upgrades | Won, 56% integrity (2 stars) | — |
| 12 placements, hero, 14 upgrades | — | Won |
| 6 placements, hero, 10 upgrades | **Lost at the boss wave** | **Won** |

A board that previously could not survive wave 12 now clears it. That is the
timing fix, not a content change.

**No balance values were altered in this pass**, per the brief. The open
question is whether the tuning should now be re-tested at 1x and adjusted:
the difficulty players actually experienced at 2x and 3x was inflated by a bug,
and the game is now easier at those speeds than any previously recorded run
suggests. That is a design decision, and it needs a deliberate replay pass
rather than a reaction to two bot runs.

---

## Changelog

**v1.1.1 — reported-issue fixes**

- **Deployment tooltips were clipped at the screen edge.** The bubble is
  centred on its trigger, so the leftmost card's tooltip ran past the left
  edge of `.app`, which clips overflow — it rendered as a chopped-off panel
  with the unit's name cut in half. Tooltips now measure themselves after
  layout and shift back inside the viewport, on either edge. Covered by a
  browser test.
- **Sprint bursts were near-constant on Delta Wetlands.** Investigated with
  in-game telemetry: the observed rate matched the data exactly, so the sprint
  code was not at fault. Two things stacked up. Delta fields three waves
  (7, 10 and 13) composed almost entirely of sprinting species across two
  lanes, so nearly every visible animal was lurching; and the v1.1 timing fix
  restored the true sprint cadence at 2x and 3x, where it had previously
  fired at half or a third of its intended rate. Sprint *intervals* were
  lengthened by roughly a third — magnitudes and durations are untouched, so
  each burst still reads as a real lunge:

  | Species | Duty before | Duty after |
  | --- | --- | --- |
  | Velociraptor | 23.7% | 17.3% |
  | Dilophosaurus | 13.5% | 10.3% |
  | Pachycephalosaurus | 18.3% | 14.5% |
  | Carnotaurus | 30.4% | 21.9% |

  On Delta's worst waves that takes the expected number of simultaneously
  sprinting animals from about 2.8 to about 2.1. Wave composition was left
  alone; if those three waves still read as too twitchy, diversifying them is
  the next lever rather than cutting sprint further.

**v1.1 — integrity hardening**

No new content. This pass moved the game from feature-complete to
simulation-correct.

- **One simulation clock.** `SimulationClock` is now the authoritative source
  of gameplay time. Every deadline reads from it: attack cooldowns, the hero's
  secondary weapon, burn, slow, stun, sprint cadence, decoy holds, aura
  recomputation, fixture expiry and Supply ticks, hero ability and reposition
  cooldowns, and wave scheduling. Phaser's `time.timeScale` no longer decides
  any gameplay outcome; `tweens.timeScale` follows the simulation purely so
  effects look right.
- **2x and 3x now run the same simulation faster.** Previously they ran a
  *different* simulation: see "Balance after the timing fix".
- **Pause freezes the authoritative clock.** A thirty-second pause advances
  zero simulation milliseconds. Cooldowns, status effects, fixtures and wave
  countdowns are exactly where the player left them.
- **Gameplay scheduling left Phaser's timers.** The Skyhook Strike's shots
  were queued with `time.delayedCall`, so they ignored pause and speed and
  could land after the match had ended. They now run on the simulation clock,
  and every pending callback is dropped when a match finishes.
- **Abandoning an operation actually records the match.** The UI promised
  partial Amber but exited without running the engine's end-of-match path, so
  nothing was recorded at all. Abandoning now produces exactly one result,
  counts as a loss, pays for waves cleared and bosses defeated, records kills,
  codex progress and play time, awards no stars or first clear, and shows the
  results screen headed "Operation Abandoned".
- **`MatchResult` carries a typed `endReason`** (`victory | defeat |
  abandoned`) rather than overloading a boolean.
- **Tutorial completion is atomic.** It was written separately from the match
  result, and the result — computed from a profile snapshot taken before that
  write — could overwrite it. Completion is now folded into the same profile
  transition as the rewards, and `finishMatch` runs the reducer inside the
  state updater so it always folds into the profile React actually holds.
- **The Operation Menu freezes gameplay.** Opening it stops the clock without
  touching the player's own pause, so closing it resumes exactly the state
  they left: running stays running, an explicit pause stays paused.
- **Dead lifetime statistics are now real.** `supplySpent`, `unitsPlaced` and
  `upgrades` were declared in the save schema and never written. They are
  tracked per match and folded in by the progression layer. Selling a unit
  refunds the Supply but does not un-spend it; repositioning the hero is a
  move, not a new placement. A test asserts no counter is left unwritten.
- **A pending save is no longer lost.** The 300ms autosave debounce dropped
  its write if the page was closed or reloaded inside the window. It now
  flushes on `pagehide`, `beforeunload` and provider unmount.
- **Committed browser tests.** `npm run test:e2e` runs nine Playwright tests
  against the production build, including direct assertions that pause stops
  the simulation clock and that 3x advances it roughly three times as fast.
  They read a narrow, read-only telemetry bridge that only exists when the
  page is opened with `?e2e=1`; a test asserts it is absent in normal play.
- **Leaving a match never tore it down.** `MatchScene` listened only for
  Phaser's `SHUTDOWN` event, but destroying the game — which is what React
  unmounting does — emits `DESTROY`. `teardown()` therefore never ran on exit:
  every match leaked its command-bus subscription, and nothing stopped the
  music or released the entity pools. The scene now listens for both, and
  teardown is idempotent. A browser test plays two matches back to back
  without a reload to keep it that way.
- **Lifecycle fixes.** Speed and pause commands are ignored once a match has
  ended; the unused `restart` command was removed rather than left as a way to
  skip end-of-match accounting; the match screen is keyed so a replay can
  never reuse a component that already processed a result; and the match-end
  bus subscription no longer churns on every parent render.
- **Entities no longer import Phaser at runtime.** Texture *keys* moved to
  `src/game/art/keys.ts` and fixture art generation moved to
  `src/game/art/fixtureArt.ts`, so `Dino`, `DefenderUnit` and `FixtureUnit`
  can be driven headlessly. The timing tests exercise the real classes and the
  real `CombatSystem`, not a reimplementation of them.
- **Corrected the test claims.** The previous entry said "182 tests" without
  saying that 182 was the *executed* count from 152 written declarations. Both
  numbers are now stated, and every claim here was produced by a command that
  was actually run.

**v1.0 — initial release**
- Complete game: four maps, ten species, twenty placeables, three heroes,
  six challenges, full progression, 182 tests.
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
  - The "show range on hover" setting was persisted but did nothing; hovering
    a placement now previews its reach.
  - Removed dead code found in the final pass: unused beam bookkeeping in the
    effects system, an uncalled combat hook, and three unreferenced helpers.
