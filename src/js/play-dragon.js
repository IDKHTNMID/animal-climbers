// ---------- Play 1D: "I am the dragon" (spec v1.2 item 8, guidance added in spec v1.3) ----------
// Each round proposes a random neighbour; the player accepts or rejects it, then sees the real acceptance
// probability e^(Δ/T). At the end the player is compared with the real dragon on the same map.
const DRAGON_ROUNDS = 25;
const DRAGON_T0 = 20;
const DRAGON_ALPHA = 0.88;
const DRAGON_STEP = 4;
const RISK_ZONES = Object.freeze([
  { max: 0.4, cls: 'low', text: '小冒險（綠區）：傾向接受' },
  { max: Math.LN2, cls: 'mid', text: '中冒險，但還在分界線左邊（p > 0.5）：傾向接受' },
  { max: 1.1, cls: 'mid', text: '中冒險，已經過了分界線（p < 0.5）：傾向拒絕' },
  { max: Infinity, cls: 'high', text: '大冒險（紅區）：傾向拒絕' },
]);
const RULER_MAX = 2;

const acceptProb = (delta, T) => (delta > 0 ? 1 : Math.exp(delta / T));
const agreesWithRule = (accepted, p) => (accepted ? p >= 0.5 : p < 0.5);

function dragonIntro(onStart) {
  return h('div', { class: 'dragon-intro' },
    h('p', null, h('b', null, '🎯 你的任務：'), '你現在是模擬退火的小龍。每一輪系統會隨機提出「往左」或「往右」的一步，由你決定要不要走過去。'),
    h('ul', null,
      h('li', null, '變高（Δ > 0）：一定接受。'),
      h('li', null, '變低（Δ < 0）：比較「掉多少 |Δ|」和「溫度 T」。|Δ| ÷ T 小於 0.69 時，規則接受的機率大於一半 → 傾向接受；大於 0.69 → 傾向拒絕。冒險尺上的「p=0.5」就是這條分界線。'),
      h('li', null, '溫度每輪都會下降：一開始熱、敢冒險，後來冷、變保守。')),
    h('p', null, h('b', null, '📝 例題')),
    h('ul', null,
      h('li', null, 'T = 20、Δ = −2：|Δ| ÷ T = 0.1，小冒險 → ', h('b', { class: 'good' }, '接受'), '（規則的機率 p = 0.90）'),
      h('li', null, 'T = 1、Δ = −5：|Δ| ÷ T = 5，大冒險 → ', h('b', { class: 'bad' }, '拒絕'), '（p = 0.007）')),
    h('p', { class: 'muted' }, `共 ${DRAGON_ROUNDS} 輪。目標是盡量和規則的傾向一致；最後也會比比看你和真正的小龍誰爬得比較高。`),
    h('button', { type: 'button', class: 'btn btn-primary', onClick: onStart }, '開始挑戰'));
}

/** Where |Δ|/T falls on a green / yellow / red scale, without giving away the exact probability. */
function riskRuler(delta, T) {
  if (delta >= 0) return h('p', { class: 'risk-note good' }, '變好了（或一樣高），不用冒險：規則一定接受。');
  const ratio = -delta / T;
  const zone = RISK_ZONES.find((z) => ratio < z.max);
  const pct = Math.min(ratio / RULER_MAX, 1) * 100;
  return h('div', { class: 'risk' },
    h('div', { class: 'risk-track' },
      h('i', { class: 'rz low', style: `width:${(0.4 / RULER_MAX) * 100}%` }),
      h('i', { class: 'rz mid', style: `width:${(0.7 / RULER_MAX) * 100}%` }),
      h('i', { class: 'rz high' }),
      h('span', { class: 'risk-split', style: `left:${(Math.LN2 / RULER_MAX) * 100}%` }, 'p=0.5'),
      h('b', { class: 'risk-mark', style: `left:${pct}%` }, '▼')),
    h('p', { class: `risk-note ${zone.cls}` }, `冒險大小 |Δ| ÷ T = ${fmt1(-delta)} ÷ ${fmt1(T)} = ${ratio.toFixed(2)} → ${zone.text}`));
}

function createDragonGame({ onRank }) {
  let game = null;
  let introSeen = false;
  const canvas = h('canvas', { class: 'map-canvas', 'aria-label': '1D 地圖，只看得到走過和提案的點' });
  const view = new MapView(canvas, { bubbles: false });
  const panel = h('div', { class: 'dragon-panel' });
  const feedback = h('div', { class: 'dragon-feedback', 'aria-live': 'polite' });
  const resultBox = h('div', { class: 'result-box', hidden: true });

  function propose(state) {
    const cand = OPS_1D.randomNeighbor(state.problem, state.pos, DRAGON_STEP, state.rng);
    return { x: cand.move, value: cand.score, delta: cand.score - state.problem.values[state.pos] };
  }

  function start() {
    const q = randomQuestion('1d');
    const base = {
      problem: q.problem, seed: q.seed, begin: q.start, pos: q.start, rng: mulberry32(q.seed), hinted: false,
      T: DRAGON_T0, round: 1, best: q.problem.values[q.start], path: [q.start], history: [], done: false,
    };
    game = { ...base, proposal: propose(base) };
    view.setProblem(q.problem);
    view.showAnswer = false;
    view.setAgents([]);
    feedback.replaceChildren();
    resultBox.hidden = true;
    if (introSeen) render();
    else {
      renderFog();
      panel.replaceChildren(dragonIntro(() => { introSeen = true; render(); }));
    }
  }

  function renderFog() {
    const revealed = new Set([...game.path, ...(game.done ? [] : [game.proposal.x])].map(String));
    view.setFog(game.done ? null : { revealed, targets: [game.proposal.x] });
    view.userPath = game.path;
  }

  function render() {
    renderFog();
    if (game.done) {
      panel.replaceChildren();
      return;
    }
    const { x, value, delta } = game.proposal;
    const cur = game.problem.values[game.pos];
    const frac = clamp(Math.log(game.T / 0.5) / Math.log(DRAGON_T0 / 0.5), 0, 1);
    const hintBtn = h('button', { type: 'button', class: 'btn btn-small', onClick: showHint }, '💡 看機率（提示）');
    panel.replaceChildren(
      h('div', { class: 'round-info' }, `第 ${game.round} / ${DRAGON_ROUNDS} 輪　｜　你的最佳 ${fmt1(game.best)}`),
      h('div', { class: 'thermo' }, h('span', { class: 'thermo-icon' }, frac > 0.5 ? '🔥' : '❄️'),
        h('div', { class: 'thermo-track' }, h('div', { class: 'thermo-fill', style: `width:${Math.round(frac * 100)}%;background:hsl(${Math.round(220 * (1 - frac))},80%,55%)` })),
        h('span', { class: 'thermo-value' }, `T = ${fmt1(game.T)}`)),
      h('p', { class: 'dragon-q' }, `你在 x=${game.pos}（高度 ${fmt1(cur)}）。提案：往${x > game.pos ? '右' : '左'}到 `,
        h('b', null, `x=${x}`), `，高度 ${fmt1(value)}，`,
        h('b', { class: delta > 0 ? 'good' : 'bad' }, `Δ = ${delta > 0 ? '+' : ''}${fmt1(delta)}`)),
      riskRuler(delta, game.T),
      game.hinted ? h('p', { class: 'hint-p' }, `💡 規則的接受機率 p = ${delta > 0 ? '1（變好一定接受）' : `e^(${fmt1(delta)}/${fmt1(game.T)}) = ${acceptProb(delta, game.T).toFixed(2)}`}`) : hintBtn,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-primary', onClick: () => decide(true) }, '✅ 接受'),
        h('button', { type: 'button', class: 'btn', onClick: () => decide(false) }, '❌ 拒絕')));
  }

  function showHint() {
    game = { ...game, hinted: true };
    render();
  }

  function decide(accepted) {
    if (game.done) return;
    const { x, delta } = game.proposal;
    const p = acceptProb(delta, game.T);
    const agree = agreesWithRule(accepted, p);
    const entry = { round: game.round, delta, T: game.T, p, accepted, agree, hinted: game.hinted };
    const pos = accepted ? x : game.pos;
    const formula = delta > 0 ? '變好了，規則一定接受（p = 1）' : `規則的接受機率 p = e^(${fmt1(delta)}/${fmt1(game.T)}) = ${p.toFixed(2)}`;
    feedback.replaceChildren(h('p', null, `第 ${game.round} 輪：${formula}。你選擇${accepted ? '接受' : '拒絕'} → `,
      h('b', { class: agree ? 'good' : 'bad' }, agree ? '和規則的傾向一致 ✓' : '和規則的傾向相反 ✗')));
    const next = {
      ...game, pos, path: accepted ? [...game.path, x] : game.path, history: [...game.history, entry], hinted: false,
      best: Math.max(game.best, game.problem.values[pos]), T: game.T * DRAGON_ALPHA, round: game.round + 1,
    };
    if (next.round > DRAGON_ROUNDS) {
      game = { ...next, done: true };
      finish();
      return;
    }
    game = { ...next, proposal: propose(next) };
    render();
  }

  function finish() {
    const params = { ...DEFAULT_PARAMS, step1d: DRAGON_STEP, t0: DRAGON_T0, alpha: DRAGON_ALPHA, tMin: 0.01, maxSteps: DRAGON_ROUNDS };
    const dragon = runToEnd(createRun({ algo: 'sa', problem: game.problem, params, start: game.begin, seed: game.seed }));
    view.showAnswer = true;
    view.setAgents([{ key: 'sa', run: dragon }]);
    render();
    const agreeCount = game.history.filter((e) => e.agree).length;
    const hints = game.history.filter((e) => e.hinted).length;
    const misses = game.history.filter((e) => !e.agree).slice(0, 3);
    const chart = h('canvas', { class: 'decision-canvas', 'aria-label': '每一輪的決定：溫度和 Δ 的散布圖' });
    resultBox.replaceChildren(
      h('p', { class: 'summary' }, `和規則傾向一致：${agreeCount} / ${DRAGON_ROUNDS} 輪`),
      h('p', { class: 'muted' }, `用了 ${hints} 次提示。`),
      h('h4', null, '📊 你的決策圖'),
      chart,
      h('p', { class: 'muted small' }, '● 接受、✕ 拒絕，橘色圈＝和規則相反。虛線上方的點應該接受、下方的點應該拒絕：熱的時候（右邊）分界線比較低，可以容忍比較大的下坡。'),
      rankingTable([{ who: 'you', display: game.best }, { who: 'sa', display: dragon.state.best.display }], OPS_1D, onRank),
      ...misses.map((e) => h('p', { class: 'muted' },
        `第 ${e.round} 輪：T=${fmt1(e.T)}、Δ=${fmt1(e.delta)}，p=${e.p.toFixed(2)}，你選了${e.accepted ? '接受' : '拒絕'}${e.p >= 0.5 ? '（p ≥ 0.5，規則傾向接受）' : '（p < 0.5，規則傾向拒絕）'}`)),
      h('p', { class: 'muted' }, '真正的小龍用同樣的溫度和步長，從同一個起點出發；牠的路徑畫在地圖上，⭐ 是全域最高點。'),
      h('button', { type: 'button', class: 'btn btn-primary', onClick: start }, '🔁 再玩一次'));
    resultBox.hidden = false;
    requestAnimationFrame(() => drawDecisionChart(chart, game.history, DRAGON_T0));
  }

  return {
    el: h('div', { class: 'predict-grid' },
      h('div', { class: 'canvas-wrap' }, canvas),
      h('div', { class: 'predict-side' }, h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '🐲 我當小龍'), feedback, panel, resultBox))),
    start,
    deactivate: () => {},
  };
}
