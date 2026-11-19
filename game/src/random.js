// Seeded random: the same seed builds the same city, every load.

export function createSeededRandom(seed) {

	let value=(seed >>> 0) || 1;
	return () => {
		value=(value * 1664525 + 1013904223) >>> 0;
		return value / 4294967296;
	};
}

export function rangeValue(random,min,max) {
	return min + random() * (max - min);
}
