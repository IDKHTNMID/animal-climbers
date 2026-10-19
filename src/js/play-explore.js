// ---------- Play 2D: explore with limited vision (spec v1.2, item 7) ----------
// The player walks on a coarse lattice (every 2nd cell of the 60x60 map), sees a zoomed window around
// themself, remembers every lattice point seen, and picks a vision radius that trades view for steps.
const LATTICE_STEP = 2;
const LATTICE_SIZE = SIZE_2D / LATTICE_STEP;
const ZOOM_CELLS = 15;
const VISION_OPTIONS = Object.freeze([
  { id: '1', radius: 1, budget: 40, name: '👀 視野 1（40 步）' },
  { id: '2', radius: 2, budget: 25, name: '🔭 視野 2（25 步）' },
  { id: '3', radius: 3, budget: 15, name: '🛰 視野 3（15 步）' },
]);
const ARROWS = Object.freeze({ '0,-1': '↑', '1,-1': '↗', '1,0': '→', '1,1': '↘', '0,1': '↓', '-1,1': '↙', '-1,0': '←', '-1,-1': '↖' });

const latticeKey = (p) => `${p.x},${p.y}`;
const toMap = (p) => point2d(p.x * LATTICE_STEP, p.y * LATTICE_STEP);
const insideLattice = (p) => p.x >= 0 && p.y >= 0 && p.x < LATTICE_SIZE && p.y < LATTICE_SIZE;
const latticeValue = (problem, p) => OPS_2D.display(problem, toMap(p));

function latticeMax(problem) {
  let best = 0;
  for (let y = 0; y < LATTICE_SIZE; y++) {
    for (let x = 0; x < LATTICE_SIZE; x++) best = Math.max(best, latticeValue(problem, point2d(x, y)));
  }
  return best;
}

function withinRadius(center, radius) {
  const out = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const p = point2d(center.x + dx, center.y + dy);
      if (insideLattice(p)) out.push(p);
    }
  }
  return out;
}

/** Map-cell keys covered by the seen lattice points, for the minimap fog. */
function fogKeys(seen) {
  const keys = new Set();
  seen.forEach((key) => {
    const [x, y] = key.split(',').map(Number);
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx, dy]) => keys.add(`${x * LATTICE_STEP + dx},${y * LATTICE_STEP + dy}`));
  });
  return keys;
}

function createExploreGame({ onRank }) {
  let vision = VISION_OPTIONS[1];
  let game = null;
  const grid = h('div', { class: 'zoom-grid', role: 'grid', 'aria-label': '放大的地圖，箭頭格子可以點擊移動' });
  const miniCanvas = h('canvas', { class: 'square-canvas', 'aria-label': '小地圖' });
  const mini = new MapView(miniCanvas, { square: true, compact: true });
  const stats = h('div', { class: 'round-info' });
  const resultBox = h('div', { class: 'result-box', hidden: true });
  const quitBtn = h('button', { type: 'button', class: 'btn', onClick: () => finish() }, '🏳 我不走了');
  const visionSeg = segmented(VISION_OPTIONS, vision.id, (id) => {
    vision = VISION_OPTIONS.find((v) => v.id === id);
    start();
  });

  function start() {
    const q = randomQuestion('2d');
    const begin = point2d(Math.floor(q.start.x / LATTICE_STEP), Math.floor(q.start.y / LATTICE_STEP));
    game = Object.freeze({
      problem: q.problem, seed: q.seed, begin, pos: begin, path: Object.freeze([begin]),
      best: latticeValue(q.problem, begin), movesLeft: vision.budget, done: false,
      seen: new Set(withinRadius(begin, vision.radius).map(latticeKey)), top: latticeMax(q.problem),
    });
    mini.setProblem(q.problem);
    mini.showAnswer = false;
    resultBox.hidden = true;
    quitBtn.hidden = false;
    render();
  }

  function zoomCell(p) {
    if (!insideLattice(p)) return h('div', { class: 'zc edge' });
    const isMe = p.x === game.pos.x && p.y === game.pos.y;
    const seen = game.done || game.seen.has(latticeKey(p));
    const value = latticeValue(game.problem, p);
    const style = seen ? `background:${terrainCss(value)};color:${terrainInk(value)}` : null;
    const visited = game.path.some((q) => q.x === p.x && q.y === p.y);
    const offset = `${p.x - game.pos.x},${p.y - game.pos.y}`;
    const arrow = !game.done && ARROWS[offset];
    const label = isMe ? h('span', { class: 'me' }, '🙋') : null;
    const text = seen ? h('span', { class: 'zc-val' }, fmt1(value)) : null;
    if (arrow) {
      return h('button', { type: 'button', class: 'zc move', style, 'aria-label': `往 ${arrow} 走，高度 ${fmt1(value)}`, onClick: () => move(p) },
        h('i', { class: 'zc-arrow' }, arrow), text);
    }
    return h('div', { class: `zc ${seen ? '' : 'fog'} ${visited ? 'visited' : ''} ${isMe ? 'here' : ''}`, style }, label, text);
  }

  function render() {
    const half = Math.floor(ZOOM_CELLS / 2);
    const cells = [];
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) cells.push(zoomCell(point2d(game.pos.x + dx, game.pos.y + dy)));
    }
    grid.replaceChildren(...cells);
    if (!game.done) mini.setFog({ revealed: fogKeys(game.seen), targets: [] });
    mini.userPath = game.path.map(toMap);
    stats.textContent = `剩下 ${game.movesLeft} 步　｜　目前高度 ${fmt1(latticeValue(game.problem, game.pos))}　｜　你的最佳 ${fmt1(game.best)}`;
  }

  function move(p) {
    if (game.done) return;
    const seen = new Set(game.seen);
    withinRadius(p, vision.radius).forEach((q) => seen.add(latticeKey(q)));
    game = Object.freeze({
      ...game, pos: p, path: Object.freeze([...game.path, p]), seen, movesLeft: game.movesLeft - 1,
      best: Math.max(game.best, latticeValue(game.problem, p)),
    });
    if (game.movesLeft <= 0) finish();
    else render();
  }

  function finish() {
    if (game.done) return;
    game = Object.freeze({ ...game, done: true });
    quitBtn.hidden = true;
    const params = { ...DEFAULT_PARAMS, step2d: LATTICE_STEP, maxSteps: vision.budget };
    const runs = createRaceRuns(game.problem, toMap(game.begin), game.seed, ALGO_KEYS, Object.fromEntries(ALGO_KEYS.map((k) => [k, params]))).map(runToEnd);
    mini.setFog(null);
    mini.showAnswer = true;
    mini.setAgents(runs.map((r) => ({ key: r.algo, run: r })));
    render();
    resultBox.replaceChildren(
      h('p', null, `你的最佳高度：${fmt1(game.best)}　｜　這張圖能走到的最高：${fmt1(game.top)}`),
      rankingTable([{ who: 'you', display: game.best }, ...runs.map((r) => ({ who: r.algo, display: r.state.best.display }))], OPS_2D, onRank),
      h('p', { class: 'muted' }, `三隻動物從同一個起點出發，每步同樣走 2 格，也只有 ${vision.budget} 步；牠們每步只看得到身邊的鄰居。`),
      h('button', { type: 'button', class: 'btn btn-primary', onClick: start }, '🔁 再玩一次'));
    resultBox.hidden = false;
  }

  return {
    el: h('div', { class: 'explore-layout' },
      h('div', { class: 'zoom-wrap' }, grid),
      h('div', { class: 'explore-side' },
        h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '視野範圍'), visionSeg.el,
          h('p', { class: 'muted small' }, '看得越遠，每一步花的「力氣」越大，步數就越少。就像狐狸每步檢查所有鄰居，小龍只看一個。')),
        stats,
        h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '🗺 小地圖（探索過的範圍）'), miniCanvas),
        h('div', { class: 'row' }, quitBtn), resultBox)),
    start,
    deactivate: () => {},
  };
}
