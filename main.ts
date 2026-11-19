// Solmar Heat — a gta6-01 entry (Node 22, standard library only): the game is this
// directory's game/ folder, a three.js open-world crime game set in the original bay
// city of Solmar (game/index.html and its ES modules, three.js vendored minified under
// game/vendor/, no network request), and this program hands it in. The second visual
// round deepens the sky, streaks it with dusk cloud, and lets the long shadows read.
// The third round adds two districts (Heights towers north, Old Town lanes
// east/west), a three-ring distance system with actor recycling, and a shadow
// frustum that follows the player (the old refresh cadence poisoned the map
// and was removed). The seventh round reframes the screenshots around the
// new districts, puts Nico in a teal shirt so he reads against the crew,
// and anchors the sun's shadow frustum to the player on a 4 m grid.
// The visual-overhaul build repaints the whole bay at golden hour: a gradient sky dome with a sun glow and
// a low western key light with long shadows, canvas-painted facades with signs and
// awnings, marked asphalt with zebra crossings, rippled water with foam at the
// shoreline, shaped cars and rounded human figures, and a graded HUD. The M3 build adds
// the five-job story chain in game/src/missions.js, the localStorage save in
// game/src/save.js and the fully synthesised WebAudio soundscape in
// game/src/audio.js — still zero assets and zero network. The pursuit AI
// was rewritten in the recorded build session (avenue routing, line-of-sight
// wanted decay, busted/wasted settlement), and the showdown queues a swing
// pressed inside its recovery so a slow renderer never eats a click.
// It copies game/ and screenshots/ from beside this file to /output and writes /output/dossier.json, the
// summary the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ENTRY_TITLE = 'Solmar Heat';
void ENTRY_TITLE;

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
