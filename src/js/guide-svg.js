// ---------- Illustrations for guides and the site tour (inline SVG, animated with SMIL) ----------
const CURVE_PATH = 'M5 110 C40 110 50 50 80 50 C110 50 115 95 140 95 C170 95 185 12 215 12 C240 12 250 110 255 110 Z';
const CURVE_FILL = `<path d="${CURVE_PATH}" fill="#9ED88E" stroke="#4E9F3D" stroke-width="2"/>`;

const SVG_PEAKS_1D = `<svg viewBox="0 0 260 120" class="guide-svg" aria-hidden="true">${CURVE_FILL}
  <text x="80" y="42" font-size="11" text-anchor="middle" fill="#3d2f22">局部最高（小山頭）</text>
  <text x="215" y="9" font-size="11" text-anchor="middle" fill="#3d2f22">⭐ 全域最高</text>
  <text x="80" y="66" font-size="16" text-anchor="middle">🐐</text></svg>`;

const SVG_NEIGHBOR_1D = `<svg viewBox="0 0 260 90" class="guide-svg" aria-hidden="true">
  <line x1="10" y1="60" x2="250" y2="60" stroke="#8a7660" stroke-width="2"/>
  <g fill="#fff" stroke="#3d2f22" stroke-width="2"><circle cx="70" cy="60" r="7"/><circle cx="190" cy="60" r="7"/></g>
  <circle cx="130" cy="60" r="9" fill="#FFE3B3" stroke="#3d2f22" stroke-width="2"/>
  <text x="130" y="44" font-size="16" text-anchor="middle">🐐</text>
  <g font-size="11" fill="#3d2f22" text-anchor="middle"><text x="70" y="82">x − s</text><text x="130" y="82">x（現在）</text><text x="190" y="82">x + s</text>
  <text x="100" y="52">←</text><text x="160" y="52">→</text></g></svg>`;

const SVG_NEIGHBOR_2D = `<svg viewBox="0 0 260 120" class="guide-svg" aria-hidden="true">
  <g transform="translate(70,6)" font-size="11" text-anchor="middle">
  ${[0, 1, 2].map((r) => [0, 1, 2].map((c) => `<rect x="${c * 38}" y="${r * 36}" width="34" height="32" rx="5" fill="${r === 1 && c === 1 ? '#FFE3B3' : '#9ED88E'}" stroke="#3d2f22"/>`).join('')).join('')}
  <text x="55" y="58" font-size="16">🐐</text>
  <text x="17" y="21">↖</text><text x="55" y="21">↑</text><text x="93" y="21">↗</text><text x="17" y="57">←</text><text x="93" y="57">→</text>
  <text x="17" y="93">↙</text><text x="55" y="93">↓</text><text x="93" y="93">↘</text></g></svg>`;

const SVG_ROUTE = `<svg viewBox="0 0 220 120" class="guide-svg" aria-hidden="true">
  <polygon points="30,90 60,25 130,15 195,50 160,105" fill="none" stroke="#7a6a58" stroke-width="3"/>
  <g font-size="10" fill="#5b4a38" text-anchor="middle"><text x="38" y="55">23</text><text x="96" y="14">22</text>
  <text x="170" y="28">23</text><text x="186" y="84">19</text><text x="95" y="108">35</text></g>
  <g fill="#fff" stroke="#3d2f22" stroke-width="1.5"><circle cx="30" cy="90" r="8" fill="#FFE3B3"/><circle cx="60" cy="25" r="6"/>
  <circle cx="130" cy="15" r="6"/><circle cx="195" cy="50" r="6"/><circle cx="160" cy="105" r="6"/></g>
  <text x="30" y="77" font-size="13" text-anchor="middle">🏠</text></svg>`;

/**
 * Animated 2-opt on the four-city knot (same shape as 「4 城入門」), looping through four phases:
 * ① the two crossing edges glow orange, ② they are cut, ③ the middle piece flips direction, ④ green edges reconnect.
 */
const SVG_TWO_OPT_ANIM = (() => {
  const P = { 0: [40, 40], 1: [200, 25], 2: [190, 140], 3: [50, 125] };
  const dur = 8;
  const phase = (on) => {
    const keys = [0, 0.25, 0.5, 0.75, 1];
    const values = [0, 1, 2, 3].map((k) => (on.includes(k) ? 1 : 0));
    return `<animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" calcMode="discrete" values="${[...values, values[3]].join(';')}" keyTimes="${keys.join(';')}"/>`;
  };
  const seg = (u, v, color, width, extra, on) => `<line x1="${P[u][0]}" y1="${P[u][1]}" x2="${P[v][0]}" y2="${P[v][1]}" stroke="${color}" stroke-width="${width}" ${extra} opacity="${on.includes(0) ? 1 : 0}">${phase(on)}</line>`;
  const label = (text, on) => `<text x="120" y="172" font-size="14" text-anchor="middle" fill="#3d2f22" font-weight="bold" opacity="${on.includes(0) ? 1 : 0}">${text}${phase(on)}</text>`;
  const city = (k) => `<circle cx="${P[k][0]}" cy="${P[k][1]}" r="9" fill="${k === 0 ? '#FFE3B3' : '#fff'}" stroke="#3d2f22" stroke-width="2"/><text x="${P[k][0]}" y="${P[k][1] + 4}" font-size="10" text-anchor="middle" fill="#3d2f22">${k}</text>`;
  return `<svg viewBox="0 0 240 180" class="guide-svg" aria-hidden="true">
  ${seg(3, 0, '#7a6a58', 3, '', [0, 1, 2, 3])}
  ${seg(2, 1, '#7a6a58', 3, '', [0, 1, 2, 3])}
  ${seg(0, 2, '#7a6a58', 3, '', [0])}${seg(1, 3, '#7a6a58', 3, '', [0])}
  ${seg(0, 2, '#FF9F43', 7, '', [0])}${seg(1, 3, '#FF9F43', 7, '', [0])}
  ${seg(0, 2, '#dc2626', 3, 'stroke-dasharray="6 5"', [1, 2])}${seg(1, 3, '#dc2626', 3, 'stroke-dasharray="6 5"', [1, 2])}
  ${seg(2, 1, '#3B82F6', 10, 'stroke-linecap="round"', [1, 2, 3])}
  <text x="205" y="85" font-size="20" fill="#1d4ed8" opacity="0">↑${phase([1])}</text>
  <text x="205" y="85" font-size="20" fill="#1d4ed8" opacity="0">↓${phase([2, 3])}</text>
  ${seg(0, 1, '#16a34a', 4, '', [3])}${seg(2, 3, '#16a34a', 4, '', [3])}
  ${[0, 1, 2, 3].map(city).join('')}<text x="40" y="22" font-size="14" text-anchor="middle">🏠</text>
  ${label('① 路線打了一個結：找出交叉的 2 條線', [0])}${label('② 把這 2 條線剪斷', [1])}
  ${label('③ 中間那段（藍色）倒過來走', [2])}${label('④ 用 2 條新線接回：結解開了！', [3])}</svg>`;
})();

/**
 * Animated algorithm demos on the same 1D curve. Each loops every DEMO_DUR seconds.
 * The curve is shifted down so the animal never leaves the picture, and the status text sits in its own
 * band under the ground, so text never covers the animal or the curve.
 */
const DEMO_DUR = 7;
const DEMO_SHIFT = 22;
const DEMO_BAND_Y = 152;
const CURVE_MOTION = 'M20 100 L50 70 L80 52 L110 72 L140 93 L175 50 L215 14';

/** Status text in the band under the ground, visible between two moments of the loop (0..1). */
function demoBand(text, color, from, to) {
  const fade = 0.03;
  const values = to >= 1 ? '0;0;1;1' : '0;0;1;1;0;0';
  const keyTimes = to >= 1 ? `0;${from};${from + fade};1` : `0;${from};${from + fade};${to};${to + fade};1`;
  return `<text x="130" y="${DEMO_BAND_Y}" font-size="13" font-weight="bold" text-anchor="middle" fill="${color}" opacity="0">${text}<animate attributeName="opacity" dur="${DEMO_DUR}s" repeatCount="indefinite" values="${values}" keyTimes="${keyTimes}"/></text>`;
}

function animatedCurve(emoji, keyPoints, keyTimes, marks = '', band = '') {
  return `<svg viewBox="0 0 260 160" class="guide-svg demo" aria-hidden="true">
  <g transform="translate(0,${DEMO_SHIFT})">${CURVE_FILL}
  <text x="240" y="18" font-size="12" text-anchor="middle">⭐</text>${marks}
  <text font-size="20" text-anchor="middle" y="-4">${emoji}<animateMotion dur="${DEMO_DUR}s" repeatCount="indefinite" calcMode="linear"
    path="${CURVE_MOTION}" keyPoints="${keyPoints}" keyTimes="${keyTimes}"/></text></g>${band}</svg>`;
}

/** Goat climbs to the small hill and stays there. */
const SVG_DEMO_HC = animatedCurve('🐐', '0;0.3;0.3', '0;0.45;1', '',
  demoBand('⬆️ 只往高處走', '#1d4ed8', 0, 0.45) + demoBand('😵 卡在小山頭，停下來了', '#c2410c', 0.48, 1));

/** Dragon climbs, risks going down into the valley while hot, then reaches the top. */
const SVG_DEMO_SA = animatedCurve('🐲', '0;0.3;0.25;0.55;1;1', '0;0.25;0.35;0.55;0.85;1', '',
  demoBand('🔥 熱：敢往下走', '#dc2626', 0.3, 0.62) + demoBand('❄️ 冷：只往上爬', '#1d4ed8', 0.65, 1));

/** Fox reaches the small hill, cannot go back (✕ marks the path behind it), so it walks down and on to the top. */
const SVG_DEMO_TS = animatedCurve('🦊', '0;0.3;0.55;1;1', '0;0.3;0.5;0.8;1',
  `<g font-size="12" font-weight="bold" fill="#c2410c" text-anchor="middle" opacity="0"><text x="47" y="92">✕</text><text x="80" y="72">✕</text>
  <animate attributeName="opacity" dur="${DEMO_DUR}s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.42;0.45;1"/></g>`,
  demoBand('✕ 走過的路不能回頭，只好往前', '#7c3aed', 0.36, 1));

const DEMO_SVGS = Object.freeze({ hc: SVG_DEMO_HC, sa: SVG_DEMO_SA, ts: SVG_DEMO_TS });

const DEMO_CAPTIONS = Object.freeze({
  hc: '🐐 山羊：只往高處走，遇到小山頭就停',
  sa: '🐲 小龍：熱的時候敢往下走，冷了只往上',
  ts: '🦊 狐狸：不走回頭路，被逼著往前找別的山',
});

/**
 * TSP demos on one six-city map, shown frame by frame. Found by search so the goat stops at a route that is not the
 * shortest (231), while the dragon (after accepting a longer route) and the fox (after a slightly longer move) reach 215.
 * New edges are green when the route got shorter and red when it got longer.
 * All three loops have four frames, so they stay in step and end side by side (231 vs 215).
 */
const TSP_DEMO_CITIES = Object.freeze([[44, 64], [154, 36], [182, 116], [141, 91], [100, 111], [224, 49]]);
const TSP_FRAME_SEC = 2;
const TSP_DEMO_TOURS = Object.freeze({
  start: [0, 3, 1, 2, 5, 4],
  stuck: [0, 3, 1, 5, 2, 4],
  detour: [0, 3, 2, 5, 1, 4],
  best: [0, 1, 5, 2, 3, 4],
  hot: [0, 3, 4, 5, 2, 1],
  cooling: [0, 4, 3, 5, 2, 1],
});

const demoTourLength = (tour) => Math.round(tour.reduce((sum, c, k) => {
  const [x1, y1] = TSP_DEMO_CITIES[c];
  const [x2, y2] = TSP_DEMO_CITIES[tour[(k + 1) % tour.length]];
  return sum + Math.hypot(x2 - x1, y2 - y1);
}, 0) / 2);

const tourEdges = (tour) => tour.map((c, k) => [c, tour[(k + 1) % tour.length]]);
const sameEdge = ([a, b], [c, d]) => (a === c && b === d) || (a === d && b === c);

/** Opacity animation that shows frame k of n, one equal slot each. */
function frameAnim(k, n) {
  const times = Array.from({ length: n + 1 }, (_, i) => +(i / n).toFixed(4));
  const values = times.map((_, i) => (Math.min(i, n - 1) === k ? 1 : 0));
  return `<animate attributeName="opacity" dur="${n * TSP_FRAME_SEC}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${times.join(';')}" values="${values.join(';')}"/>`;
}

function tspFrame(frame, prev, k, n) {
  const length = demoTourLength(frame.tour);
  const change = prev ? Math.sign(length - demoTourLength(prev.tour)) : 0;
  const newColor = change < 0 ? '#16a34a' : '#dc2626';
  const lenColor = change < 0 ? '#16a34a' : change > 0 ? '#dc2626' : '#3d2f22';
  const line = ([a, b], color, width) => {
    const [x1, y1] = TSP_DEMO_CITIES[a];
    const [x2, y2] = TSP_DEMO_CITIES[b];
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  };
  const edges = tourEdges(frame.tour);
  const isNew = (e) => prev && !tourEdges(prev.tour).some((old) => sameEdge(old, e));
  return `<g opacity="${k === 0 ? 1 : 0}">${edges.filter((e) => !isNew(e)).map((e) => line(e, '#7a6a58', 3)).join('')}
  ${edges.filter(isNew).map((e) => line(e, newColor, 5)).join('')}
  <text x="254" y="16" font-size="13" font-weight="bold" text-anchor="end" fill="${lenColor}">長度 ${length}</text>
  <text x="130" y="${DEMO_BAND_Y}" font-size="13" font-weight="bold" text-anchor="middle" fill="${frame.color}">${frame.text}</text>${frameAnim(k, n)}</g>`;
}

function animatedTour(emoji, frames) {
  const cities = TSP_DEMO_CITIES.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="7" fill="${k === 0 ? '#FFE9A8' : '#fff'}" stroke="#3d2f22" stroke-width="2"/>`).join('');
  return `<svg viewBox="0 0 260 160" class="guide-svg demo" aria-hidden="true">
  ${frames.map((f, k) => tspFrame(f, frames[k - 1], k, frames.length)).join('')}${cities}
  <text x="44" y="50" font-size="13" text-anchor="middle">🏠</text><text x="16" y="24" font-size="20" text-anchor="middle">${emoji}</text></svg>`;
}

const TRY_ALL = { color: '#1d4ed8', text: '🔍 試遍所有改法，挑最短的' };

const TSP_DEMO_SVGS = Object.freeze({
  hc: animatedTour('🐐', [
    { tour: TSP_DEMO_TOURS.start, ...TRY_ALL },
    { tour: TSP_DEMO_TOURS.stuck, color: '#16a34a', text: '✅ 變短了！' },
    ...[0, 1].map(() => ({ tour: TSP_DEMO_TOURS.stuck, color: '#c2410c', text: `😵 沒有更短的改法，停在 ${demoTourLength(TSP_DEMO_TOURS.stuck)}` })),
  ]),
  sa: animatedTour('🐲', [
    { tour: TSP_DEMO_TOURS.start, color: '#1d4ed8', text: '🎲 每次隨機抽一種改法' },
    { tour: TSP_DEMO_TOURS.hot, color: '#dc2626', text: '🔥 熱：變長也接受' },
    { tour: TSP_DEMO_TOURS.cooling, color: '#16a34a', text: '✅ 變短了' },
    { tour: TSP_DEMO_TOURS.best, color: '#1d4ed8', text: '❄️ 冷了只接受變短：找到最短' },
  ]),
  ts: animatedTour('🦊', [
    { tour: TSP_DEMO_TOURS.start, ...TRY_ALL },
    { tour: TSP_DEMO_TOURS.stuck, color: '#16a34a', text: '✅ 變短了！' },
    { tour: TSP_DEMO_TOURS.detour, color: '#7c3aed', text: '➡️ 沒有更短的，變長一點也照走' },
    { tour: TSP_DEMO_TOURS.best, color: '#16a34a', text: '⭐ 找到最短路線' },
  ]),
});

const TSP_DEMO_CAPTIONS = Object.freeze({
  hc: '🐐 山羊：挑最短的改法，沒有更短就停',
  sa: '🐲 小龍：隨機抽改法，熱的時候變長也接受',
  ts: '🦊 狐狸：沒有更短的也照走，不把剛拆的線接回去',
});

/** Three looping animations side by side, one short caption each (replaces paragraphs of text). */
function demoTrioHtml(svgs = DEMO_SVGS, captions = DEMO_CAPTIONS) {
  return `<div class="demo-trio">${ALGO_KEYS.map((k) => `<figure>${svgs[k]}<figcaption>${captions[k]}</figcaption></figure>`).join('')}</div>`;
}
