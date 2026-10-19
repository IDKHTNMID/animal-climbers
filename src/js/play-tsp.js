// ---------- Play TSP: pick two edges, preview, confirm (spec v1.2, item 9) ----------
const TSP_PLAY_BUDGET = 15;

function edgesAdjacent(n, k1, k2) {
  return k2 - k1 === 1 || (k1 === 0 && k2 === n - 1);
}

function createTspGame({ onRank }) {
  let game = null;
  const hint = createHint();
  const canvas = h('canvas', { class: 'square-canvas play-tsp-canvas', 'aria-label': 'TSP 地圖：點路線上的邊來選擇' });
  const view = new MapView(canvas, { square: true, onEdgeClick: ({ edge }) => pickEdge(edge) });
  const side = h('div', { class: 'tsp-play-side' });
  const resultBox = h('div', { class: 'result-box', hidden: true });

  function start() {
    const q = randomQuestion('tsp');
    const length = tourLength(q.problem, q.problem.start);
    game = Object.freeze({
      problem: q.problem, seed: q.seed, begin: q.problem.start, tour: q.problem.start, length, best: length,
      movesLeft: TSP_PLAY_BUDGET, selected: [], preview: null, done: false,
    });
    view.setProblem(q.problem);
    view.showAnswer = false;
    resultBox.hidden = true;
    render();
  }

  function render() {
    view.userTour = game.tour;
    view.selectedEdges = game.selected;
    view.crossings = game.done ? null : tourCrossings(game.problem, game.tour);
    view.edgeChange = game.preview ? { ...twoOptEdges(game.preview.move), status: 'preview' } : null;
    const crossings = tourCrossings(game.problem, game.tour).length;
    const head = h('div', { class: 'round-info' }, `剩下 ${game.movesLeft} 次　｜　目前長度 ${fmt1(game.length)}　｜　你的最佳 ${fmt1(game.best)}`);
    if (game.done) {
      side.replaceChildren(head);
      return;
    }
    const instructions = game.selected.length === 0 ? '① 點路線上一條想拆掉的邊（會變成橘色）。'
      : game.selected.length === 1 ? '② 再點第二條想拆掉的邊（不能和第一條相鄰）。' : '③ 看看預覽，決定要不要這樣改。';
    const previewBox = game.preview ? h('div', { class: 'preview-box' },
      h('p', null, `拆掉 ${game.preview.move.a}–${game.preview.move.b}、${game.preview.move.c}–${game.preview.move.d}，接上 ${game.preview.move.a}–${game.preview.move.c}、${game.preview.move.b}–${game.preview.move.d}`),
      edgeFormula(game.problem, game.preview.move, -game.preview.score - game.length),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-primary', onClick: confirm }, '✅ 確定這樣改'),
        h('button', { type: 'button', class: 'btn', onClick: clearSelection }, '↩ 取消'))) : null;
    side.replaceChildren(head,
      h('p', { class: 'step-body' }, instructions),
      h('p', { class: 'muted' }, `🔴 紅圈＝路線交叉的地方（目前 ${crossings} 處）。拆掉交叉的那兩條邊再重接，通常會變短。`),
      ...(previewBox ? [previewBox] : []),
      h('div', { class: 'seq' }, h('span', { class: 'seq-label' }, '目前路線'), cityChips(game.tour, -1, -1, '')),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onClick: finish }, '🏳 我不改了')));
  }

  function clearSelection() {
    game = Object.freeze({ ...game, selected: [], preview: null });
    render();
  }

  function pickEdge(k) {
    if (game.done || game.preview) return;
    if (game.selected.includes(k)) {
      game = Object.freeze({ ...game, selected: game.selected.filter((e) => e !== k) });
      render();
      return;
    }
    const selected = [...game.selected, k];
    if (selected.length < 2) {
      game = Object.freeze({ ...game, selected });
      render();
      return;
    }
    const [k1, k2] = [Math.min(...selected), Math.max(...selected)];
    if (edgesAdjacent(game.tour.length, k1, k2)) {
      hint.show('這兩條邊相鄰（共用一座城市），拆了也接不出新路線，換一條');
      return;
    }
    const preview = twoOptMove(game.problem, game.tour, k1 + 1, k2, game.length);
    game = Object.freeze({ ...game, selected, preview });
    render();
  }

  function confirm() {
    const { move } = game.preview;
    const tour = reverseSegment(game.tour, move.i, move.j);
    const length = tourLength(game.problem, tour);
    game = Object.freeze({
      ...game, tour, length, best: Math.min(game.best, length), movesLeft: game.movesLeft - 1, selected: [], preview: null,
    });
    if (game.movesLeft <= 0) finish();
    else render();
  }

  function finish() {
    if (game.done) return;
    game = Object.freeze({ ...game, done: true, selected: [], preview: null });
    const params = { ...DEFAULT_PARAMS, maxSteps: TSP_PLAY_BUDGET };
    const runs = createRaceRuns(game.problem, game.begin, game.seed, ALGO_KEYS, Object.fromEntries(ALGO_KEYS.map((k) => [k, params]))).map(runToEnd);
    view.showAnswer = true;
    render();
    resultBox.replaceChildren(
      h('p', null, `你的最佳長度：${fmt1(game.best)}　｜　參考最佳：${fmt1(game.problem.ref.length)}（金色虛線）`),
      rankingTable([{ who: 'you', display: game.best }, ...runs.map((r) => ({ who: r.algo, display: r.state.best.display }))], OPS_TSP, onRank),
      h('p', { class: 'muted' }, `三隻動物從同一條初始路線出發，也只能改 ${TSP_PLAY_BUDGET} 次。`),
      h('button', { type: 'button', class: 'btn btn-primary', onClick: start }, '🔁 再玩一次'));
    resultBox.hidden = false;
  }

  return {
    el: h('div', { class: 'explore-layout' },
      h('div', { class: 'canvas-wrap' }, hint.el, canvas),
      h('div', { class: 'explore-side' }, h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '🧭 自己改路線'), side, resultBox))),
    start,
    deactivate: () => {},
  };
}
