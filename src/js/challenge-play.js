// ---------- Challenge 2: "I am the algorithm" shell (spec 7.2, games redesigned in spec v1.2) ----------
const PLAY_GAMES = Object.freeze([
  { id: '2d', name: '🗺 2D 探險', create: createExploreGame,
    intro: '地圖被雲遮住，只看得到視野範圍內的高度。點畫面上的箭頭移動，看過的地方會留在記憶裡。用有限的步數爬到最高吧！' },
  { id: '1d', name: '🐲 1D 我當小龍', create: createDragonGame,
    intro: '你就是模擬退火的小龍：系統每輪隨機提出一個鄰居，由你決定接受或拒絕，最後和真正的小龍比一比。' },
  { id: 'tsp', name: '🧭 TSP 改路線', create: createTspGame,
    intro: '自己動手做 2-opt：點兩條要拆掉的邊，先看預覽和長度變化，再決定要不要改。只能改 15 次！' },
]);

/** Ranking with shared places for ties; reports the player's rank so the best one can be saved. */
function rankingTable(entries, ops, onRank) {
  const rankOf = (e) => 1 + entries.filter((o) => ops.isBetter(o.display, e.display)).length;
  const sorted = [...entries].sort((a, b) => rankOf(a) - rankOf(b));
  const mine = entries.find((e) => e.who === 'you');
  if (mine) onRank(rankOf(mine));
  return h('table', { class: 'result-table' },
    h('thead', null, h('tr', null, h('th', null, '名次'), h('th', null, '誰'), h('th', null, `最佳${ops.valueName}`))),
    h('tbody', null, sorted.map((e) => h('tr', { class: e.who === 'you' ? 'you' : '' },
      h('td', null, String(rankOf(e))),
      h('td', null, e.who === 'you' ? '🙋 你' : [agentImg(e.who, 20), ` ${ALGOS[e.who].animal}`]),
      h('td', null, fmt1(e.display))))));
}

function saveBestRank(rank) {
  const best = storage.get(PLAY_BEST_KEY, null);
  if (best === null || rank < best) storage.set(PLAY_BEST_KEY, rank);
}

function createPlayMode({ onBack }) {
  const games = {};
  const holder = h('div', { class: 'play-holder' });
  const intro = h('p', { class: 'muted' });
  let current = null;

  function open(id) {
    const def = PLAY_GAMES.find((g) => g.id === id);
    if (!games[id]) games[id] = def.create({ onRank: saveBestRank });
    current = games[id];
    intro.textContent = def.intro;
    holder.replaceChildren(current.el);
    current.start();
    guideBtn.onclick = () => openModeGuide(`play-${id}`);
    openModeGuideIfFirstTime(`play-${id}`);
  }

  const guideBtn = h('button', { type: 'button', class: 'btn btn-small guide-btn' }, '❓ 怎麼玩');
  const seg = segmented(PLAY_GAMES, '2d', open);
  const el = h('div', { class: 'mode' },
    h('div', { class: 'mode-head' }, h('button', { type: 'button', class: 'btn btn-small', onClick: onBack }, '← 回到選單'),
      h('h2', null, '🙋 我當演算法'), guideBtn, seg.el),
    intro, holder);

  return {
    el,
    start: () => {
      seg.set('2d');
      open('2d');
    },
    deactivate: () => { if (current) current.deactivate(); },
  };
}
