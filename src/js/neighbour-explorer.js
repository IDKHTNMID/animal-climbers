// ---------- TSP neighbour generator (spec v1.4 item 1, four stages in spec v1.5) ----------
// Walks through every 2-opt neighbour of the current route and shows how one is made:
// ① pick two non-adjacent edges, ② cut them (two pieces), ③ reverse the blue piece's visiting order, ④ reconnect.
const EXPLAIN_STAGES = Object.freeze(['① 選 2 條線', '② 剪斷', '③ 倒過來', '④ 接回']);
const EXPLAIN_AUTOPLAY_MS = 1600;

const arrowPath = (cities) => cities.join('→');

function stageText(problem, tour, move, stage) {
  const { a, b, c, d, i, j } = move;
  const piece = tour.slice(i, j + 1);
  const rest = [...tour.slice(j + 1), ...tour.slice(0, i)];
  if (stage === 1) {
    return `從路線上挑出 ${a}–${b} 和 ${c}–${d} 這兩條線（橘色）。這兩條線沒有「相鄰」：相鄰的意思是兩條線碰到同一座城市，`
      + `例如 ${tour[0]}–${tour[1]} 和 ${tour[1]}–${tour[2]} 都接在城市 ${tour[1]} 上；相鄰的兩條線剪掉後，中間只剩一座孤零零的城市，接不出新路線。`;
  }
  if (stage === 2) {
    return `剪斷後，路線斷成兩段。藍色這段原本照 ${arrowPath(piece)} 的順序走（看藍色箭頭），另一段是 ${arrowPath(rest)}。`;
  }
  if (stage === 3) {
    return `「倒過來」＝把藍色這段拜訪城市的順序反過來：${arrowPath(piece)} 變成 ${arrowPath([...piece].reverse())}。`
      + '城市的位置不會動，只是走的方向反了：藍色箭頭反向，城市旁邊的順序編號也跟著對調。';
  }
  const newLength = tourLength(problem, reverseSegment(tour, i, j));
  const change = newLength - tourLength(problem, tour);
  return `最後用綠色的 ${a}–${c}、${b}–${d} 把兩段接回成一圈，就得到一條新路線。新長度 ${fmt1(newLength)}`
    + `（${change < 0 ? '短了' : '長了'} ${fmt1(Math.abs(change))}）。`;
}

/** onPreview({ tour, move, stage }) shows the stage on the map; onPreview(null) clears it. */
function createNeighbourExplorer({ onPreview }) {
  let problem = null;
  let tour = null;
  let moves = [];
  let index = 0;
  let stage = 1;
  let active = false;
  let timer = null;
  const counter = h('span', { class: 'ex-counter' });
  const stageBtns = EXPLAIN_STAGES.map((label, k) => h('button', {
    type: 'button', class: 'seg-btn', 'aria-pressed': 'false', onClick: () => { stopAuto(); show(index, k + 1); },
  }, label));
  const text = h('p', { class: 'ex-text' });
  const chips = h('div', { class: 'ex-chips' });
  const autoBtn = h('button', { type: 'button', class: 'btn btn-small btn-primary', onClick: () => autoPlay() }, '▶ 播放這個鄰居怎麼產生');
  const endBtn = h('button', { type: 'button', class: 'btn btn-small', onClick: () => deactivate() }, '結束預覽');
  const rule = h('div', { class: 'ex-rule' });
  const body = h('div', { class: 'ex-body', hidden: true },
    h('div', { class: 'ex-nav' },
      h('button', { type: 'button', class: 'btn btn-small', onClick: () => { stopAuto(); show((index - 1 + moves.length) % moves.length, 1); } }, '◀'),
      counter,
      h('button', { type: 'button', class: 'btn btn-small', onClick: () => { stopAuto(); show((index + 1) % moves.length, 1); } }, '▶')),
    h('div', { class: 'segmented ex-stages' }, stageBtns), text, chips, h('div', { class: 'row' }, autoBtn, endBtn));
  const openBtn = h('button', { type: 'button', class: 'btn btn-primary', onClick: () => { show(0, 1); } }, '🔍 一個一個看鄰居怎麼產生');

  function stopAuto() {
    clearTimeout(timer);
    timer = null;
  }

  function autoPlay() {
    stopAuto();
    show(index, 1);
    const advance = (next) => {
      timer = setTimeout(() => {
        show(index, next);
        if (next < EXPLAIN_STAGES.length) advance(next + 1);
      }, EXPLAIN_AUTOPLAY_MS);
    };
    advance(2);
  }

  function show(k, s) {
    if (!moves.length) return;
    active = true;
    index = k;
    stage = s;
    const move = moves[index];
    counter.textContent = `第 ${index + 1} / ${moves.length} 個鄰居：拆 ${move.a}–${move.b}、${move.c}–${move.d}`;
    stageBtns.forEach((btn, n) => btn.setAttribute('aria-pressed', String(n + 1 === stage)));
    text.textContent = stageText(problem, tour, move, stage);
    const flipped = stage >= 3;
    chips.replaceChildren(h('div', { class: 'seq' }, h('span', { class: 'seq-label' }, flipped ? '倒過來之後' : '目前的順序'),
      cityChips(flipped ? reverseSegment(tour, move.i, move.j) : tour, move.i, move.j, flipped ? 'seg-new' : 'seg-piece')));
    body.hidden = false;
    openBtn.hidden = true;
    onPreview({ tour, move, stage });
  }

  function deactivate() {
    stopAuto();
    if (!active) return;
    active = false;
    body.hidden = true;
    openBtn.hidden = false;
    onPreview(null);
  }

  return {
    el: h('section', { class: 'panel explorer' }, h('h3', { class: 'panel-title' }, '🔀 鄰居是怎麼產生的？'), rule, openBtn, body),
    /** Called whenever the route may have changed (new problem, step, reset). Ends any running preview. */
    update(run) {
      deactivate();
      problem = run.problem;
      tour = run.state.current.pos;
      moves = OPS_TSP.neighbors(problem, tour).map((m) => m.move);
      const n = problem.n;
      rule.replaceChildren(
        h('p', null, h('b', null, '① 挑 2 條線 → ② 剪斷 → ③ 中間那段倒過來 → ④ 接回'), '，就得到一個鄰居。'),
        h('details', { class: 'ex-more' }, h('summary', null, '名詞說明'), h('ul', { class: 'ex-defs' },
          h('li', null, h('b', null, '相鄰：'), '兩條線碰到同一座城市（共用一個端點）。'),
          h('li', null, h('b', null, '倒過來：'), '把那一段「拜訪城市的順序」反過來走，例如 3→2 變成 2→3；城市位置不變。'),
          h('li', null, h('b', null, '有幾個鄰居：'), `路線有 ${n} 條線；每條線不能配自己、也不能配左右相鄰的 2 條，所以有 ${n}−3 條可以配；`
            + `每一組會被兩條線各算一次要 ÷2 → ${n}×(${n}−3)÷2 = ${moves.length} 個鄰居。`))));
    },
    deactivate,
  };
}
