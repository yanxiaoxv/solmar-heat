[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yanxiaoxv/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yanxiaoxv/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Heat

An original open-world crime game for the browser, built for make.fun's gta6-01
bounty. Welcome to **Solmar Bay**, a sun-soaked coastal city of pastel towers,
palm-lined avenues and one long hot summer.

You are **Nico Vega**, who runs errands for half the marina and owes favours to
the other half. Explore the city on foot and by car, borrow vehicles, keep the
Solmar Patrol bored, and work five jobs — a marina cruise, a timed delivery, a
pursuit, a showdown and a finale — until the Rayo Garage is yours.

## Play

Serve `game/` with any static file server and open `index.html` in desktop
Chrome. No build step, no network requests: three.js is vendored under
`game/vendor/` and every sound is synthesised live with WebAudio.

- **WASD / arrows** — move and drive
- **Mouse** — camera (click the game to lock the pointer)
- **E** — get in / out of a car
- **Shift** — run, **Space** — handbrake
- **Left mouse** — shove / attack
- **Esc / P** — pause and save (progress persists in localStorage)

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with `vendor/makefun-game.ts`.
- `game/src/` — the game itself, one module per job: `city.js` builds Solmar
  Bay procedurally, `vehicles.js` and `player.js` move through it,
  `pedestrians.js` and `police.js` fill it with life, `missions.js` runs the
  five-job story and the taxi loop, `combat.js` handles Nico's shove,
  `hud.js` draws the HUD and minimap, `audio.js` synthesises every sound,
  and `save.js` persists progress to localStorage.
- `screenshots/` — real renders of the game, staged with `?shot=` scenes.

## License

MIT — see `LICENSE`. The city, characters, vehicles, names, story, art and
sounds are original to this project.
