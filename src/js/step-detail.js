// ---------- Step explanation panels for every problem type (TSP: spec v1.3; 1D / 2D parity: spec v1.5) ----------
const RANKING_TOP = 5;
const RANKING_SHOW_ALL = 9;

/** City order as chips, starting at the home city 🏠; [i..j] gets segClass (the reversed part). */
function cityChips(tour, i, j, segClass) {
  const chips = tour.flatMap((city, k) => [
    h('span', { class: `city-chip ${k === 0 ? 'start' : ''} ${k >= i && k <= j ? segClass : ''}` }, k === 0 ? `🏠${city}` : String(city)),
    h('span', { class: 'arrow' }, '→')]);
  return h('div', { class: 'chips-row' }, chips, h('span', { class: 'city-chip home' }, `🏠${tour[0]}`));
}

/** "−ab −cd +ac +bd = change" for a 2-opt move; lengthChange is new length minus old length. */
function edgeFormula(problem, move, lengthChange) {
  const D = problem.dist;
  const { a, b, c, d } = move;
  const term = (sign, u, v, cls) => h('span', { class: cls }, `${sign}${fmt1(D[u][v])}（${u}–${v}）`);
  return h('p', { class: 'formula' }, '長度變化 = ',
    term('−', a, b, 'rm'), ' ', term('−', c, d, 'rm'), ' ', term('+', a, c, 'add'), ' ', term('+', b, d, 'add'),
    ` = ${lengthChange > 0 ? '+' : lengthChange < 0 ? '−' : ''}${fmt1(Math.abs(lengthChange))}`,
    h('b', null, lengthChange < 0 ? '（變短）' : lengthChange > 0 ? '（變長）' : '（不變）'));
}

/** How far the current solution is from the best one (route length or height). */
function gapBar(run) {
  const cur = run.state.current.display;
  if (run.problem.type === 'tsp') {
    const ref = run.problem.ref.length;
    const extra = (cur / ref - 1) * 100;
    return h('div', { class: 'gap' },
      h('div', { class: 'gap-text' }, `目前長度 ${fmt1(cur)}　｜　參考最佳 ${fmt1(ref)}　｜　`,
        h('b', null, extra < 0.05 ? '已經是最佳！' : `還多 ${extra.toFixed(0)}%`)),
      h('div', { class: 'gap-track' }, h('div', { class: 'gap-fill', style: `width:${Math.min(100, (ref / cur) * 100).toFixed(1)}%` })));
  }
  const top = run.problem.global.value;
  const short = top - cur;
  return h('div', { class: 'gap' },
    h('div', { class: 'gap-text' }, `目前高度 ${fmt1(cur)}　｜　全域最高 ${fmt1(top)}　｜　`,
      h('b', null, short < 0.05 ? '已經在最高點！' : `還差 ${fmt1(short)}`)),
    h('div', { class: 'gap-track' }, h('div', { class: 'gap-fill', style: `width:${Math.min(100, (cur / top) * 100).toFixed(1)}%` })));
}

function candidateLabel(run, record, cand) {
  if (run.problem.type === 'tsp') return run.ops.moveLabel(run.problem, record.from.pos, cand.move);
  const dir = moveDirection(run.problem.type, record.from.pos, cand.move);
  return `${dir ? `往${dir} ` : ''}${run.ops.moveLabel(run.problem, record.from.pos, cand.move)}`;
}

function pickTag(run, record) {
  const isTsp = run.problem.type === 'tsp';
  if (record.accepted) return isTsp ? '✓ 選這個' : '✓ 走這裡';
  if (record.event === 'stop') return isTsp ? '最好的也沒變短' : '最高的也沒比現在高';
  return '✗ 拒絕';
}

function rankingRow(run, record, cand, rank) {
  const isTsp = run.problem.type === 'tsp';
  const change = cand.display - record.from.display;
  const better = run.ops.isBetter(cand.display, record.from.display);
  const chosen = cand.move === record.chosen;
  const sign = Math.abs(change) < 0.05 ? '±' : change > 0 ? '+' : '−';
  const valueText = isTsp ? `${sign}${fmt1(Math.abs(change))}` : `${fmt1(cand.display)}（${sign}${fmt1(Math.abs(change))}）`;
  return h('li', { class: `rank-row ${cand.tabu ? 'tabu' : ''} ${chosen ? 'chosen' : ''}` },
    h('span', { class: 'rank-no' }, `#${rank}`),
    h('span', { class: 'rank-move' }, candidateLabel(run, record, cand)),
    h('span', { class: better ? 'good' : 'bad' }, `${sign === '±' ? '＝' : better ? '▲' : '▼'} ${valueText}`),
    cand.tabu ? h('span', { class: 'tag tabu' }, '🚫 禁忌') : null,
    chosen ? h('span', { class: 'tag pick' }, pickTag(run, record)) : null);
}

/** Every neighbour tried this step, best first: makes "the goat checks all of them" visible. */
function neighbourRanking(run, record) {
  const isTsp = run.problem.type === 'tsp';
  const total = neighbourCount(run.problem);
  const unit = isTsp ? '種改法' : '個鄰居';
  if (!record) {
    return h('p', { class: 'muted' }, isTsp ? `這張圖每一步共有 ${total} 種 2-opt 改法可以試（每一種都是一條「鄰居路線」）。`
      : `每一步最多有 ${total} 個鄰居可以看。按「⏭ 下一步」後，這裡會列出這一步比較過的鄰居。`);
  }
  if (run.algo === 'sa') {
    return h('div', null, h('p', { class: 'rank-title' }, `小龍這一步只從 ${total} ${unit}裡隨機抽 1 ${isTsp ? '種' : '個'}：`),
      h('ol', { class: 'ranking' }, rankingRow(run, record, record.candidates[0], '?')));
  }
  const better = run.ops.isBetter;
  const sorted = [...record.candidates].sort((a, b) => (better(a.display, b.display) ? -1 : better(b.display, a.display) ? 1 : 0));
  const improving = sorted.filter((c) => better(c.display, record.from.display)).length;
  const tabu = sorted.filter((c) => c.tabu).length;
  const rows = sorted.map((c, k) => rankingRow(run, record, c, k + 1));
  const head = h('p', { class: 'rank-title' },
    `${ALGOS[run.algo].animal}比較了全部 ${record.candidates.length} ${unit}：${improving} ${isTsp ? '種會變短' : '個比現在高'}${tabu ? `，${tabu} 個是禁忌` : ''}。`);
  if (rows.length <= RANKING_SHOW_ALL) return h('div', null, head, h('ol', { class: 'ranking' }, rows));
  const chosenRow = rows.findIndex((r) => r.classList.contains('chosen'));
  const extra = chosenRow >= RANKING_TOP ? [h('li', { class: 'rank-gap' }, '⋯'), rows[chosenRow]] : [];
  return h('div', null, head, h('ol', { class: 'ranking' }, rows.slice(0, RANKING_TOP), extra),
    h('details', { class: 'rank-all' }, h('summary', null, `看全部 ${rows.length} ${unit}`),
      h('ol', { class: 'ranking' }, sorted.map((c, k) => rankingRow(run, record, c, k + 1)))));
}

function legendItem(cls, text) {
  return h('span', { class: 'lg-item' }, h('i', { class: `lg-line ${cls}` }), text);
}

function mapLegend(type) {
  const rows = type === 'tsp'
    ? [legendItem('route', '目前路線'), legendItem('best', '歷史最佳路線'), legendItem('cut', '✂ 這一步拆掉'), legendItem('add', '這一步接上'),
      legendItem('reject', '✗ 被拒絕的提案'), legendItem('tabu', '不准接回（禁忌）'),
      h('span', { class: 'lg-item' }, '🏠 起點　▶ 行進方向　數字＝這一段的長度')]
    : [legendItem('trail', '走過的路線'), h('span', { class: 'lg-item' }, h('i', { class: 'lg-box up' }), '比現在高的鄰居'),
      h('span', { class: 'lg-item' }, h('i', { class: 'lg-box down' }), '比現在低的鄰居'), legendItem('aim', '這一步要走的方向'),
      h('span', { class: 'lg-item' }, h('i', { class: 'lg-box tabu' }), '✕ 禁忌（狐狸不能回去）'),
      h('span', { class: 'lg-item' }, '⭐ 全域最高（勾「顯示答案」）　💤 停下來了　💬 這一步的一句話')];
  return h('details', { class: 'tsp-legend', open: true }, h('summary', null, '圖例'), h('div', { class: 'lg-row' }, rows));
}

function sequenceRows(run, record) {
  if (!record || record.chosen === null) {
    return [h('div', { class: 'seq' }, h('span', { class: 'seq-label' }, '目前路線'), cityChips(run.state.current.pos, -1, -1, ''))];
  }
  const { i, j } = record.chosen;
  const before = record.from.pos;
  const label = record.event === 'stop' ? '最好的改法（也會變長，所以不改）' : record.accepted ? '改之後' : '提案（被拒絕）';
  return [
    h('div', { class: 'seq' }, h('span', { class: 'seq-label' }, '改之前'), cityChips(before, i, j, 'seg-old')),
    h('div', { class: 'seq' }, h('span', { class: 'seq-label' }, label), cityChips(reverseSegment(before, i, j), i, j, 'seg-new')),
    edgeFormula(run.problem, record.chosen, -record.delta),
  ];
}

/**
 * topEl: gap bar + legend right under the canvas (all problem types).
 * el: what this step compared (TSP adds the city order and length formula), under the step card.
 */
function createStepDetail() {
  const top = h('div', { class: 'tsp-top' });
  const title = h('h3', { class: 'panel-title' });
  const body = h('div', { class: 'tsp-body' });
  const el = h('section', { class: 'panel tsp-detail' }, title, body);
  return {
    el,
    topEl: top,
    update(run, record) {
      const isTsp = run.problem.type === 'tsp';
      title.textContent = isTsp ? '🧭 這一步的 2-opt' : '🧭 這一步比較了哪些鄰居';
      top.replaceChildren(gapBar(run), mapLegend(run.problem.type));
      body.replaceChildren(...(isTsp ? sequenceRows(run, record) : []), neighbourRanking(run, record));
    },
  };
}
