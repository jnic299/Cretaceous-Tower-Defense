# Cretaceous Tower Defense

A browser tower defense game about holding a perimeter against increasingly
dangerous hordes of dinosaurs. Humans have a handful of fortified footholds in
a world that belongs to something else; your job is to make each one survive
the night.

Built with **Phaser 3** for the real-time simulation and **React 19** for
menus, the in-match HUD and progression, in **TypeScript** on **Vite**. It
deploys to Vercel as a static site and needs no server.

Every sprite, texture and sound in the game is generated at runtime from code.
There are no binary assets in this repository.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check the project, then produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript project references, no emit |
| `npm run lint` | ESLint (flat config, TypeScript + React Hooks rules) |
| `npm test` | Vitest unit suite |
| `npm run test:e2e` | Playwright browser smoke suite (builds and serves automatically) |
| `npm run verify` | typecheck → lint → test → build, in that order |

Requires Node 20 or newer.

---

## How to play

1. **Play** → pick a site → pick a hero and a loadout → **Deploy**.
2. Choose a card from the bar at the bottom, then click clear ground to place
   it. The ghost turns green where the placement is legal and red where it is
   not, and the bar tells you why.
3. Enemies walk fixed routes toward your objective. Defenders acquire and fire
   on their own; you decide where they stand and what they become.
4. Kills and cleared waves pay **Supply**, which you spend during the match on
   more defenders, upgrades and your hero. **Amber** is the permanent currency
   and is spent between matches in the Armory.
5. Finish with the objective intact for up to three stars.

### Controls

| Input | Action |
| --- | --- |
| Left click | Place · select |
| Right click / `Esc` | Cancel placement · deselect |
| Shift + click | Keep the same card held for rapid placement |
| `Space` | Pause / resume |
| `1` `2` `3` | Game speed |
| Shift + `1`…`6` | Select a deployment card |
| `E` | Start the next wave early (pays a Supply bonus) |
| `Q` | Hero ability |
| `R` | Deploy or reposition the hero |
| `U` / `X` | Upgrade / sell the selected placement |

### Reading the battlefield

Dinosaur colour communicates durability — green, blue, orange, red, obsidian —
but never on its own. Each tier also carries a rank pip count beside its health
bar and a distinct silhouette marking (plain, speckled, striped, chevroned,
crackled), so the tier reads without colour vision. **Settings → High-contrast
tiers** shows every health bar at all times.

---

## Architecture

React owns the application shell. Phaser owns the simulation. They talk over a
small typed event bus and nothing else — the UI never imports the engine's
internals, and the engine never renders a React component.

```
src/
  app/               React: screens, HUD, SVG art, profile state
    screens/         Title, map select, briefing, match, results, armory,
                     challenges, codex, settings
    components/hud/  In-match HUD (deploy bar, hero panel, inspector, coach)
    art/             SVG art shared by menus (unit emblems, dinosaur
                     silhouettes, live map previews built from map data)
    state/           ProfileContext — loads, mutates and autosaves the profile
  game/              Phaser: everything real-time
    scenes/          MatchScene — orchestration only; systems do the work
    systems/         SimulationClock, MapGeometry, TerrainRenderer,
                     CombatSystem, WaveSystem, ProjectileSystem,
                     EffectsSystem, SpatialGrid, EconomySystem, targeting,
                     placementRules, combatMath
    art/keys.ts      Texture key names, free of any Phaser import
    testBridge.ts    Read-only telemetry for browser tests (?e2e=1 only)
    entities/        Dino, PlacedUnit (defenders + heroes), Fixture
    data/            All balance and content tables
    art/             Procedural texture generation for the canvas
    events.ts        The React ↔ Phaser bus and the HUD snapshot shape
  audio/             AudioManager — Web Audio synthesis, no sample files
  persistence/       GameSaveRepository, localStorage impl, schema, migrations
  progression/       Profile, rewards, unlocks, match-result folding
  utils/             Pure geometry
tests/               Vitest suites
```

### Where things live

| I want to change… | Edit |
| --- | --- |
| Defender or turret balance | `src/game/data/defenders.ts`, `src/game/data/turrets.ts` |
| Hero stats and abilities | `src/game/data/heroes.ts` |
| Fixtures | `src/game/data/fixtures.ts` |
| Dinosaur species behaviour and silhouettes | `src/game/data/dinosaurs.ts` |
| Health/armour/bounty tier curve | `src/game/data/tiers.ts` |
| A map's layout, terrain, decor and **waves** | `src/game/data/maps/<map>.ts` |
| Challenge rules | `src/game/data/challenges.ts` |
| Star thresholds and Amber payouts | `src/progression/rewards.ts` |
| What a new player starts with | `STARTING_UNLOCKS` in `src/game/data/catalog.ts` |
| Save schema and migrations | `src/persistence/schema.ts`, `migrations.ts` |
| What happens when a match ends | `src/progression/applyResult.ts` |
| How gameplay time advances | `src/game/systems/SimulationClock.ts` |
| Damage, armour and splash maths | `src/game/systems/combatMath.ts` |

Balance numbers live in data files, never in scene code. `tests/dataIntegrity.test.ts`
enforces the invariants those tables have to hold — every route reaches its
objective, every wave references a real species and spawn point, upgrades
strictly improve, difficulty and star gates rise monotonically, no unit runs
away with damage-per-Supply.

### Maps

A map is one object: dimensions, palette, objective, spawn points, routes as
waypoint lists, terrain polygons (water / lava / rock / structure), decor,
starting Supply and a wave table. Routes are resampled through a
centripetal Catmull-Rom spline at load, so authoring stays coarse while
dinosaurs walk a smooth curve. Terrain polygons drive placement rules, the
"where can I build" overlay, and — for anything flagged `blocksSight` — the
line-of-sight test.

Adding a map means adding one file and one entry in `src/game/data/maps/index.ts`.

### Simulation time

Phaser's `scene.time.now` is raw wall-clock time: it ignores `timeScale` and
keeps running while the game is paused. Gameplay therefore does not use it.

`SimulationClock` is the authoritative gameplay clock. It advances only by the
scaled simulation delta, so one second of simulation means the same thing at
every speed and a pause costs exactly zero of it. Every gameplay deadline reads
from it — attack cooldowns, burn, slow, stun, sprint cadence, aura refreshes,
fixture lifetimes, hero cooldowns, wave scheduling — and gameplay callbacks
that need a delay (the Skyhook Strike's strafing run) are queued on it rather
than on a Phaser timer, so they obey pause and speed and are dropped when a
match ends.

Phaser's tweens and particles still run on Phaser's own clock. They are
presentation, and they never decide an outcome.

### Progression and saves

`GameSaveRepository` is the only storage boundary. V1 ships
`LocalStorageGameSaveRepository`; a cloud-backed profile means implementing the
same interface and changing one line in `createSaveRepository`. Saves are
versioned and migrated forward one step at a time, and corrupt, partial or
future-versioned data degrades to a fresh profile instead of crashing.

### Art and audio

No image or audio files ship with the game.

- **Dinosaurs** are drawn from a body spec (proportions, stance, crown, spines,
  tail tip) into four walk-cycle frames per species and tier, baked to textures
  at match start for only the combinations that map's waves actually field.
- **Units** render as a static base plus a rotating top, so weapons visibly
  track their target while the sandbags stay put.
- **Terrain** for a whole map is baked into a single texture — ground noise,
  routes, water, lava, rock with cast shadows, bridge decking wherever a route
  crosses water — leaving one draw call for the environment.
- **Audio** is synthesised from oscillators and filtered noise in
  `src/audio/AudioManager.ts`.

The same body specs and unit specs drive the SVG art in the menus, so the codex
and armory show the same creatures and equipment as the battlefield.

Replacing placeholder art with professional sprite sheets means changing the
texture-baking functions in `src/game/art/`; nothing in the gameplay systems
refers to how a sprite was produced.

---

## Deploying to Vercel

The repository is a static Vite site and needs no configuration beyond what is
committed.

1. Import the repository in Vercel.
2. Framework preset: **Vite** (already declared in `vercel.json`).
3. Build command `npm run build`, output directory `dist`.

`vercel.json` sets the SPA rewrite. Asset paths are relative (`base: './'`), so
the build also works from a subdirectory or a plain static host.

There is no server component, no database and no authentication. Progress is
stored in the player's browser.

---

## Testing

```bash
npm test        # 225 written it() declarations, 255 executed cases
npm run test:e2e   # 11 browser tests against the production build
```

The unit suite covers the parts where a mistake is expensive and invisible:
damage and armour maths, tier scaling, reward and star rules, unlock legality,
save migration, placement eligibility on every map, line-of-sight geometry,
wave composition and challenge modifiers, the end-of-match reducer, and the
integrity of the balance tables themselves.

`tests/dataIntegrity.test.ts` parameterises ten of its declarations over the
four maps, which is why Vitest reports more cases than there are `it()` calls.

`tests/simulationTiming.test.ts` drives the real `Dino`, `DefenderUnit` and
`CombatSystem` headlessly and asserts the core guarantee: **2x and 3x run the
same simulation faster.** A given amount of simulation time produces the same
shots, distance, burn damage, status durations and cooldown completions no
matter how much wall-clock time was spent on it, and a pause consumes none of
it.

`npm run test:e2e` builds the game, serves it, and drives Chromium through the
seams unit tests cannot reach: entering a match, placing a defender, starting a
wave, pausing, abandoning, and reloading with progression intact. A fresh
machine needs `npx playwright install chromium` once.

### The test bridge

Browser tests need to see the simulation clock itself, so a match publishes a
small read-only snapshot to `window.__ctdTest` — but **only** when the page is
opened with `?e2e=1`. It exposes no way to mutate state, grant resources or
skip content, and a test asserts it is absent during normal play.

---

## Originality

Cretaceous Tower Defense is an original game. The premise of defending an
outpost from dinosaurs is a genre setting, not a property. No names, characters,
locations, logos, vehicle designs, audio, music, UI or artwork are taken from
any film or existing game. All species names used are the real palaeontological
genus names, which are not trademarks. Every asset is generated by the code in
this repository.

## Licence

No licence is granted by default; add one before distributing.
