// ---------- Map geometry and colour helpers (shared by map views and panels) ----------
const VIEW_W = 600;
const VIEW_H = 400;
const PLOT_1D = Object.freeze({ left: 44, right: 584, top: 24, bottom: 372 });
const SQUARE = Object.freeze({ left: 110, top: 10, size: 380 });
const SQUARE_ONLY = Object.freeze({ left: 10, top: 10, size: 380 });
const TERRAIN_STOPS = [[0, [43, 76, 140]], [0.35, [91, 178, 106]], [0.7, [217, 179, 108]], [1, [255, 255, 255]]];
const FOG_COLOR = '#dfe7ef';
const GOLD = '#E9B949';
const TABU_COLOR = 'rgba(255,140,40,0.55)';
const REMOVED_COLOR = '#dc2626';
const ADDED_COLOR = '#16a34a';
const ROUTE_COLOR = '#7a6a58';

function terrainColor(value) {
  const t = clamp(value / HEIGHT_MAX, 0, 1);
  for (let k = 1; k < TERRAIN_STOPS.length; k++) {
    const [t1, c1] = TERRAIN_STOPS[k];
    const [t0, c0] = TERRAIN_STOPS[k - 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return c0.map((v, i) => Math.round(v + (c1[i] - v) * f));
    }
  }
  return TERRAIN_STOPS[TERRAIN_STOPS.length - 1][1];
}

const terrainCss = (value) => `rgb(${terrainColor(value).join(',')})`;
/** Dark text on light terrain, white text on the dark blue lowlands. */
const terrainInk = (value) => (value < 30 ? '#ffffff' : '#3d2f22');

const x1d = (x) => PLOT_1D.left + (x / (SIZE_1D - 1)) * (PLOT_1D.right - PLOT_1D.left);
const y1d = (v) => PLOT_1D.bottom - (v / HEIGHT_MAX) * (PLOT_1D.bottom - PLOT_1D.top);

function posKey(type, pos) {
  return type === '2d' ? `${pos.x},${pos.y}` : String(pos);
}

function makeOffscreen(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  paint(img.data);
  ctx.putImageData(img, 0, 0);
  return c;
}

function terrainImage(problem) {
  return makeOffscreen(SIZE_2D, SIZE_2D, (data) => {
    problem.values.forEach((v, i) => data.set([...terrainColor(v), 255], i * 4));
  });
}

function fogImage(revealed) {
  return makeOffscreen(SIZE_2D, SIZE_2D, (data) => {
    for (let i = 0; i < SIZE_2D * SIZE_2D; i++) {
      const key = `${i % SIZE_2D},${Math.floor(i / SIZE_2D)}`;
      data.set(revealed.has(key) ? [0, 0, 0, 0] : [223, 231, 239, 255], i * 4);
    }
  });
}

function pointSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Proper intersection point of segments p1p2 and p3p4, or null. */
function segmentIntersection(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 1e-6 || u >= 1 - 1e-6) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/** Edge k of a tour joins tour[k] and tour[k + 1] (wrapping). */
function tourEdge(tour, k) {
  return [tour[k], tour[(k + 1) % tour.length]];
}

/** Crossing points between non-adjacent edges of a tour (city coordinates, 0..100). */
function tourCrossings(problem, tour) {
  const n = tour.length;
  const pts = [];
  for (let k = 0; k < n; k++) {
    for (let m = k + 2; m < n; m++) {
      if (k === 0 && m === n - 1) continue;
      const [a, b] = tourEdge(tour, k);
      const [c, d] = tourEdge(tour, m);
      const hit = segmentIntersection(problem.cities[a], problem.cities[b], problem.cities[c], problem.cities[d]);
      if (hit) pts.push({ ...hit, edges: [k, m] });
    }
  }
  return pts;
}

/** Edge change of a 2-opt move: two removed edges and two added edges. */
function twoOptEdges(move) {
  return { removed: [[move.a, move.b], [move.c, move.d]], added: [[move.a, move.c], [move.b, move.d]] };
}
