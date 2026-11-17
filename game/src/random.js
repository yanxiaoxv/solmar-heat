// Deterministic seeded random for Solmar Heat: the same seed always builds
// the same city dressing and screenshot scenes, so a ?seed= page is stable
// from one load to the next. A plain linear congruential generator is plenty
// for decoration choices.

export function createSeededRandom(seed) {
  let value = (seed >>> 0) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function pickWith(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}
