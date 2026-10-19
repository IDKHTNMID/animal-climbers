// ---------- Seeded random numbers (spec 9.1) ----------
const SEED_MIN = 1;
const SEED_MAX = 99999;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer in [min, max]. */
function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

function shuffled(rng, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Returns the seed as a number, or null when the text is not an integer in range. */
function parseSeed(text) {
  const trimmed = String(text).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= SEED_MIN && value <= SEED_MAX ? value : null;
}

function randomSeed() {
  return randInt(Math.random, SEED_MIN, SEED_MAX);
}
