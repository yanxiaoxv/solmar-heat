// Solmar Heat, hand-in program: stage the game and its screenshots
// into the output directory, then write the dossier the scorer
// re-derives byte for byte from those same files.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The gta6-01 gate's caps, as published in the vendor library's notes.
// Of these only text_max_bytes shapes the dossier's bytes; the rest
// merely refuse, so passing them all makes this program fail exactly
// where the scorer would fail the entry.
const GATE_CAPS = {
	text_max_bytes: 163840,
	screenshots: { max: 4, max_bytes: 262144 },
	game_max_files: 993,
	game_max_bytes: 50331648,
	game_path_max_bytes: 1000,
};

// The repository root is wherever this file sits; the output defaults
// to /output and may be pointed elsewhere for a local rehearsal run.
const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.argv[2] ?? '/output';

if (!existsSync(outDir)) {
	mkdirSync(outDir, { recursive: true });
}

// Copy first, dossier second: buildDossier reads the staged tree, so
// what lands in the output is exactly what the dossier describes.
for (const part of ['game', 'screenshots']) {
	cpSync(join(repoDir, part), join(outDir, part), { recursive: true });
}

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, GATE_CAPS));
