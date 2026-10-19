// ---------- Problems: maps (spec 9) and neighbourhoods (spec 8.1) ----------
const SIZE_1D = 200;
const SIZE_2D = 60;
const HEIGHT_MAX = 100;
const GLOBAL_HEIGHT = 97;
const TSP_GLOBAL_RATIO = 1.01;
const TSP_COORD_MIN = 5;
const TSP_COORD_MAX = 95;
const TSP_REF_RESTARTS = 50;
const TSP_REF_SEED = 777;
const RANDOM_MAP_ID = 'random';
const RANDOM_START_SALT = 7919;

const COUNT_LIMITS = Object.freeze({
  '1d': { min: 3, max: 15, def: 8, label: '山峰數' },
  '2d': { min: 3, max: 15, def: 8, label: '山峰數' },
  tsp: { min: 6, max: 20, def: 12, label: '城市數' },
});

const PROBLEM_TYPES = Object.freeze([
  { id: '1d', name: '1D 曲線' },
  { id: '2d', name: '2D 地形' },
  { id: 'tsp', name: 'TSP 旅行推銷員' },
]);

const SAW_HEIGHTS = [40, 55, 35, 60, 50, 70, 45, 100, 65, 50];

const MAP_PRESETS = Object.freeze({
  '1d': [
    { id: '1d-twin', name: '雙峰陷阱', peaks: [{ c: 64, a: 65, s: 10 }, { c: 100, a: 100, s: 15 }], start: 20 },
    { id: '1d-saw', name: '鋸齒山脈', peaks: SAW_HEIGHTS.map((a, k) => ({ c: 10 + 20 * k, a, s: 5 })), start: 6 },
  ],
  '2d': [
    { id: '2d-single', name: '單峰入門', peaks: [{ cx: 40, cy: 20, a: 100, s: 15 }], start: { x: 5, y: 50 } },
    {
      id: '2d-twin', name: '雙峰陷阱',
      peaks: [{ cx: 24, cy: 38, a: 80, s: 8 }, { cx: 38, cy: 22, a: 100, s: 10 }],
      start: { x: 6, y: 54 },
    },
    {
      id: '2d-islands', name: '三峰群島',
      peaks: [{ cx: 16, cy: 40, a: 70, s: 9 }, { cx: 26, cy: 16, a: 85, s: 9 }, { cx: 40, cy: 40, a: 100, s: 9 }],
      start: { x: 4, y: 56 },
    },
  ],
  tsp: [
    // A four-city route tied in one knot: the goat untangles it in a single step.
    { id: 'tsp-intro', name: '4 城入門', kind: 'fixed', cities: [[15, 25], [85, 15], [80, 85], [20, 75]], startTour: [0, 2, 1, 3] },
    { id: 'tsp-circle', name: '圓形 10 城', kind: 'circle', n: 10, seed: 1 },
    { id: 'tsp-random12', name: '隨機 12 城', kind: 'uniform', n: 12, seed: 2024 },
    { id: 'tsp-cluster', name: '群聚 16 城', kind: 'cluster', seed: 7 },
  ],
});

// ----- terrain helpers -----

function normalizeHeights(raw) {
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const span = max - min || 1;
  return Float64Array.from(raw, (v) => ((v - min) / span) * HEIGHT_MAX);
}

function gaussian1d(peaks) {
  return Array.from({ length: SIZE_1D }, (_, x) =>
    peaks.reduce((sum, p) => sum + p.a * Math.exp(-((x - p.c) ** 2) / (2 * p.s * p.s)), 0));
}

function gaussian2d(peaks) {
  return Array.from({ length: SIZE_2D * SIZE_2D }, (_, i) => {
    const x = i % SIZE_2D;
    const y = Math.floor(i / SIZE_2D);
    return peaks.reduce((sum, p) =>
      sum + p.a * Math.exp(-((x - p.cx) ** 2 + (y - p.cy) ** 2) / (2 * p.s * p.s)), 0);
  });
}

function argmax(values) {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

function randomPeaks1d(rng, count) {
  return Array.from({ length: count }, () => ({
    c: randRange(rng, 0, SIZE_1D - 1), a: randRange(rng, 30, 100), s: randRange(rng, 6, 20),
  }));
}

function randomPeaks2d(rng, count) {
  return Array.from({ length: count }, () => ({
    cx: randRange(rng, 0, SIZE_2D - 1), cy: randRange(rng, 0, SIZE_2D - 1),
    a: randRange(rng, 30, 100), s: randRange(rng, 6, 12),
  }));
}

const point2d = (x, y) => Object.freeze({ x, y });

// ----- TSP helpers -----

function circleCities(rng, n) {
  const ordered = Array.from({ length: n }, (_, k) => {
    const angle = (2 * Math.PI * k) / n;
    return { x: 50 + 40 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
  });
  return shuffled(rng, ordered);
}

function uniformCities(rng, n) {
  return Array.from({ length: n }, () => ({
    x: randRange(rng, TSP_COORD_MIN, TSP_COORD_MAX), y: randRange(rng, TSP_COORD_MIN, TSP_COORD_MAX),
  }));
}

function clusterCities(rng) {
  const centers = [[25, 25], [75, 25], [25, 75], [75, 75]];
  return centers.flatMap(([cx, cy]) => Array.from({ length: 4 }, () => {
    const angle = randRange(rng, 0, 2 * Math.PI);
    const r = 8 * Math.sqrt(rng());
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }));
}

function distanceMatrix(cities) {
  return cities.map((a) => Float64Array.from(cities, (b) => Math.hypot(a.x - b.x, a.y - b.y)));
}

function tourLength(problem, tour) {
  let total = 0;
  for (let k = 0; k < tour.length; k++) total += problem.dist[tour[k]][tour[(k + 1) % tour.length]];
  return total;
}

function reverseSegment(tour, i, j) {
  return Object.freeze([...tour.slice(0, i), ...tour.slice(i, j + 1).reverse(), ...tour.slice(j + 1)]);
}

const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * 2-opt moves that change the cycle: 1 <= j - i <= n - 3, and i >= 1 so tour[0] (the home city 🏠) never moves.
 * Reversing [0..j] gives the same cycle as reversing [j+1..n-1], so skipping i = 0 also removes duplicates:
 * exactly n(n-3)/2 distinct moves remain.
 */
function isValidTwoOpt(n, i, j) {
  return i >= 1 && i < j && j - i <= n - 3;
}

function twoOptMove(problem, tour, i, j, length) {
  const n = tour.length;
  const a = tour[(i - 1 + n) % n];
  const b = tour[i];
  const c = tour[j];
  const d = tour[(j + 1) % n];
  const D = problem.dist;
  const newLength = length - D[a][b] - D[c][d] + D[a][c] + D[b][d];
  return { move: Object.freeze({ i, j, a, b, c, d }), score: -newLength };
}

function randomTour(rng, n) {
  return Object.freeze(shuffled(rng, Array.from({ length: n }, (_, k) => k)));
}

/** Steepest 2-opt descent to convergence, used to build the reference optimum. */
function twoOptDescent(problem, startTour) {
  let tour = startTour;
  for (;;) {
    const length = tourLength(problem, tour);
    const moves = OPS_TSP.neighbors(problem, tour);
    const best = moves.reduce((b, m) => (m.score > b.score ? m : b), moves[0]);
    if (-best.score >= length - 1e-9) return { tour, length };
    tour = reverseSegment(tour, best.move.i, best.move.j);
  }
}

function referenceTour(problem, def) {
  if (def && def.kind === 'circle') {
    const byAngle = problem.cities
      .map((c, k) => ({ k, angle: Math.atan2(c.y - 50, c.x - 50) }))
      .sort((p, q) => p.angle - q.angle)
      .map((p) => p.k);
    const tour = Object.freeze(byAngle);
    return { tour, length: tourLength(problem, tour) };
  }
  const rng = mulberry32(TSP_REF_SEED);
  let best = null;
  for (let r = 0; r < TSP_REF_RESTARTS; r++) {
    const result = twoOptDescent(problem, randomTour(rng, problem.n));
    if (!best || result.length < best.length) best = result;
  }
  return best;
}

// ----- neighbourhood operations per problem type -----

const OPS_1D = Object.freeze({
  valueName: '高度',
  score: (p, x) => p.values[x],
  display: (p, x) => p.values[x],
  displayOfScore: (s) => s,
  neighbors: (p, x, step) => [x - step, x + step]
    .filter((n) => n >= 0 && n < SIZE_1D)
    .map((n) => ({ move: n, score: p.values[n] })),
  randomNeighbor: (p, x, step, rng) => {
    const all = OPS_1D.neighbors(p, x, step);
    return all[Math.floor(rng() * all.length)];
  },
  apply: (p, x, move) => move,
  label: (x) => `x=${x}`,
  moveLabel: (p, from, move) => `x=${move}`,
  tabuEntry: (p, from) => Object.freeze({ keys: [String(from)], label: `x=${from}` }),
  isTabu: (p, move, tabu) => tabu.some((e) => e.keys.includes(String(move))),
  randomStart: (p, rng) => randInt(rng, 0, SIZE_1D - 1),
  isGlobal: (p, display) => display >= GLOBAL_HEIGHT,
  isBetter: (a, b) => a > b,
});

const DIRS_2D = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const DIR_NAMES = ['上', '右上', '右', '右下', '下', '左下', '左', '左上'];
const key2d = (pt) => `${pt.x},${pt.y}`;

const OPS_2D = Object.freeze({
  valueName: '高度',
  score: (p, pt) => p.values[pt.y * SIZE_2D + pt.x],
  display: (p, pt) => p.values[pt.y * SIZE_2D + pt.x],
  displayOfScore: (s) => s,
  neighbors: (p, pt, step) => DIRS_2D
    .map(([dx, dy]) => point2d(pt.x + dx * step, pt.y + dy * step))
    .filter((n) => n.x >= 0 && n.x < SIZE_2D && n.y >= 0 && n.y < SIZE_2D)
    .map((n) => ({ move: n, score: p.values[n.y * SIZE_2D + n.x] })),
  randomNeighbor: (p, pt, step, rng) => {
    const all = OPS_2D.neighbors(p, pt, step);
    return all[Math.floor(rng() * all.length)];
  },
  apply: (p, pt, move) => move,
  label: (pt) => `(${pt.x},${pt.y})`,
  moveLabel: (p, from, move) => `(${move.x},${move.y})`,
  tabuEntry: (p, from) => Object.freeze({ keys: [key2d(from)], label: `(${from.x},${from.y})` }),
  isTabu: (p, move, tabu) => tabu.some((e) => e.keys.includes(key2d(move))),
  randomStart: (p, rng) => point2d(randInt(rng, 0, SIZE_2D - 1), randInt(rng, 0, SIZE_2D - 1)),
  isGlobal: (p, display) => display >= GLOBAL_HEIGHT,
  isBetter: (a, b) => a > b,
});

const OPS_TSP = Object.freeze({
  valueName: '路線長度',
  score: (p, tour) => -tourLength(p, tour),
  display: (p, tour) => tourLength(p, tour),
  displayOfScore: (s) => -s,
  neighbors: (p, tour) => {
    const n = tour.length;
    const length = tourLength(p, tour);
    const out = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        if (isValidTwoOpt(n, i, j)) out.push(twoOptMove(p, tour, i, j, length));
      }
    }
    return out;
  },
  randomNeighbor: (p, tour, step, rng) => {
    const n = tour.length;
    for (;;) {
      const x = randInt(rng, 0, n - 1);
      const y = randInt(rng, 0, n - 1);
      const i = Math.min(x, y);
      const j = Math.max(x, y);
      if (isValidTwoOpt(n, i, j)) return twoOptMove(p, tour, i, j, tourLength(p, tour));
    }
  },
  apply: (p, tour, move) => reverseSegment(tour, move.i, move.j),
  label: () => '目前路線',
  moveLabel: (p, from, move) => `拆 ${move.a}–${move.b}、${move.c}–${move.d}`,
  tabuEntry: (p, from, move) => Object.freeze({
    keys: [edgeKey(move.a, move.b), edgeKey(move.c, move.d)],
    label: `${move.a}-${move.b} / ${move.c}-${move.d}`,
  }),
  isTabu: (p, move, tabu) => {
    const added = [edgeKey(move.a, move.c), edgeKey(move.b, move.d)];
    return tabu.some((e) => e.keys.some((k) => added.includes(k)));
  },
  randomStart: (p, rng) => randomTour(rng, p.n),
  isGlobal: (p, display) => display <= p.ref.length * TSP_GLOBAL_RATIO,
  isBetter: (a, b) => a < b,
});

const OPS = Object.freeze({ '1d': OPS_1D, '2d': OPS_2D, tsp: OPS_TSP });

// ----- building problems -----

function presetsFor(type) {
  return MAP_PRESETS[type];
}

function build1d(meta, values, start) {
  const gi = argmax(values);
  return Object.freeze({ ...meta, type: '1d', values, start, global: { state: gi, value: values[gi] } });
}

function build2d(meta, values, start) {
  const gi = argmax(values);
  const state = point2d(gi % SIZE_2D, Math.floor(gi / SIZE_2D));
  return Object.freeze({ ...meta, type: '2d', values, start, global: { state, value: values[gi] } });
}

function buildTsp(meta, cities, def, startSeed) {
  const base = { ...meta, type: 'tsp', cities: Object.freeze(cities), n: cities.length, dist: distanceMatrix(cities) };
  const ref = referenceTour(base, def);
  const start = def && def.startTour ? Object.freeze([...def.startTour]) : randomTour(mulberry32(startSeed), cities.length);
  return Object.freeze({ ...base, ref, start, global: { state: ref.tour, value: ref.length } });
}

function buildPreset(type, def, seed) {
  const meta = { id: def.id, name: def.name, isRandom: false };
  if (type === '1d') return build1d(meta, normalizeHeights(gaussian1d(def.peaks)), def.start);
  if (type === '2d') {
    return build2d(meta, normalizeHeights(gaussian2d(def.peaks)), point2d(def.start.x, def.start.y));
  }
  const rng = mulberry32(def.seed);
  const cities = def.kind === 'fixed' ? def.cities.map(([x, y]) => ({ x, y }))
    : def.kind === 'circle' ? circleCities(rng, def.n)
    : def.kind === 'cluster' ? clusterCities(rng) : uniformCities(rng, def.n);
  return buildTsp(meta, cities, def, seed);
}

function buildRandom(type, seed, count) {
  const rng = mulberry32(seed);
  const meta = { id: RANDOM_MAP_ID, name: `隨機地圖 #${seed}`, isRandom: true };
  const startRng = mulberry32(seed + RANDOM_START_SALT);
  if (type === '1d') {
    const values = normalizeHeights(gaussian1d(randomPeaks1d(rng, count)));
    return build1d(meta, values, OPS_1D.randomStart(null, startRng));
  }
  if (type === '2d') {
    const values = normalizeHeights(gaussian2d(randomPeaks2d(rng, count)));
    return build2d(meta, values, OPS_2D.randomStart(null, startRng));
  }
  return buildTsp(meta, uniformCities(rng, count), null, seed + RANDOM_START_SALT);
}

const problemCache = new Map();

/** config: { type, mapId, seed, count }. Results are cached because TSP reference search is not free. */
function buildProblem(config) {
  const { type, mapId, seed, count } = config;
  const isRandom = mapId === RANDOM_MAP_ID;
  const key = isRandom ? `${type}|random|${seed}|${count}` : `${type}|${mapId}|${type === 'tsp' ? seed : ''}`;
  if (!problemCache.has(key)) {
    const def = presetsFor(type).find((d) => d.id === mapId);
    if (!isRandom && !def) throw new Error(`Unknown map: ${type}/${mapId}`);
    problemCache.set(key, isRandom ? buildRandom(type, seed, count) : buildPreset(type, def, seed));
  }
  return problemCache.get(key);
}

/** Deterministic sequence of random starts for a seed (button "random start"). */
function randomStartFor(problem, seed, counter) {
  return OPS[problem.type].randomStart(problem, mulberry32(seed * 31 + counter * 1009 + 17));
}
