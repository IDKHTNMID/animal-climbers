// ---------- Challenge page: card menu with live previews (spec 7, layout revised in spec v1.2) ----------
const PREDICT_BEST_KEY = 'animal-climbers-predict-best-v1';
const PLAY_BEST_KEY = 'animal-climbers-play-best-v1';
const DEMO_TICK_MS = 140;
const DEMO_PAUSE_TICKS = 12;

/** A looping mini animation shown on a menu card. next() returns false when the demo should restart. */
function createDemo(canvas, setup) {
  const view = new MapView(canvas, { compact: true });
  view.setSpeed(1000 / DEMO_TICK_MS);
  let state = null;
  let pause = 0;
  let round = 0;
  const restart = () => {
    round += 1;
    state = setup(view, round);
  };
  restart();
  return {
    tick() {
      if (pause > 0) {
        pause -= 1;
        if (pause === 0) restart();
        return;
      }
      if (!state.next()) pause = DEMO_PAUSE_TICKS;
    },
  };
}

function raceDemo(view, round) {
  const problem = buildProblem({ type: '2d', mapId: '2d-twin', seed: 1, count: 8 });
  view.setProblem(problem);
  let runs = createRaceRuns(problem, randomStartFor(problem, 7, round), round, ALGO_KEYS, defaultParamsByAlgo());
  return {
    next() {
      runs = runs.map((r) => stepRun(r));
      view.setAgents(runs.map((r) => ({ key: r.algo, run: r })));
      return !runs.every((r) => r.state.stopped);
    },
  };
}

function fogDemo(view, round) {
  const problem = buildProblem({ type: '2d', mapId: RANDOM_MAP_ID, seed: 40 + (round % 6), count: 8 });
  view.setProblem(problem);
  let run = createRun({ algo: 'ts', problem, params: { ...DEFAULT_PARAMS, maxSteps: 40 }, start: randomStartFor(problem, round, 0), seed: round });
  const seen = new Set();
  const reveal = (pos) => {
    [pos, ...OPS['2d'].neighbors(problem, pos, 2).map((c) => c.move)].forEach((p) => {
      [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1], [-1, 1]].forEach(([dx, dy]) => seen.add(`${p.x + dx},${p.y + dy}`));
    });
    view.setFog({ revealed: new Set(seen), targets: [] });
  };
  reveal(run.state.current.pos);
  view.setAgents([{ key: 'ts', run }]);
  return {
    next() {
      run = stepRun(run);
      reveal(run.state.current.pos);
      view.setAgents([{ key: 'ts', run }]);
      return !run.state.stopped;
    },
  };
}

function tspDemo(view, round) {
  const problem = buildProblem({ type: 'tsp', mapId: 'tsp-cluster', seed: 1 + (round % 5), count: 12 });
  view.setProblem(problem);
  let run = createRun({ algo: 'sa', problem, params: { ...DEFAULT_PARAMS, t0: 20, alpha: 0.985, maxSteps: 260 }, start: problem.start, seed: round });
  return {
    next() {
      for (let k = 0; k < 3; k++) run = stepRun(run);
      view.setAgents([{ key: 'sa', run }]);
      return !run.state.stopped;
    },
  };
}

const CHALLENGE_MODES = Object.freeze([
  {
    id: 'predict', icon: '🔮', title: '預測誰會贏', create: createPredictMode, demo: raceDemo,
    points: ['看地圖和 🔑 線索', '猜小龍還是狐狸會贏', '一局 5 題，賽後告訴你為什麼'],
    learn: '不同地形適合哪一種演算法',
    record: () => { const v = storage.get(PREDICT_BEST_KEY, null); return v === null ? '還沒玩過' : `最佳：答對 ${v} / 5 題`; },
  },
  {
    id: 'play', icon: '🙋', title: '我當演算法', create: createPlayMode, demo: fogDemo,
    points: ['2D：有限視野，自己決定往哪走', '1D：當小龍，決定接受或拒絕', 'TSP：自己拆邊、接邊改路線'],
    learn: '演算法只看得到局部，判斷有多難',
    record: () => { const v = storage.get(PLAY_BEST_KEY, null); return v === null ? '還沒玩過' : `最佳名次：第 ${v} 名`; },
  },
  {
    id: 'tune', icon: '🎛', title: '調參過關', create: createTuneMode, demo: tspDemo,
    points: ['3 個關卡，初始參數都不好', '從 5 個起點各跑一次', '成功越多次，星星越多'],
    learn: '溫度、步長、禁忌表長度的影響',
    record: () => `星星：${starText(Math.round(totalStars() / TUNE_LEVELS.length))}　${totalStars()} / ${TUNE_LEVELS.length * 3}`,
  },
]);

const LEARN_ORDER = ['先到「學習」認識三隻動物', '🔮 預測誰會贏', '🙋 我當演算法', '🎛 調參過關'];

function createChallengePage() {
  const menu = h('div', { class: 'mode-menu-wrap' });
  const holder = h('div', { class: 'mode-holder' });
  const modes = {};
  let current = null;
  let demos = [];
  let records = [];

  function showMenu() {
    if (current) current.deactivate();
    current = null;
    holder.replaceChildren();
    records.forEach((r) => { r.el.textContent = r.read(); });
    menu.hidden = false;
  }

  function openMode(def) {
    if (!modes[def.id]) modes[def.id] = def.create({ onBack: showMenu });
    current = modes[def.id];
    menu.hidden = true;
    holder.replaceChildren(current.el);
    current.start();
  }

  const cards = CHALLENGE_MODES.map((def) => {
    const canvas = h('canvas', { class: 'demo-canvas', 'aria-hidden': 'true' });
    demos.push(createDemo(canvas, def.demo));
    const recordEl = h('div', { class: 'mode-record' }, def.record());
    records.push({ el: recordEl, read: def.record });
    return h('article', { class: 'mode-card' },
      canvas,
      h('div', { class: 'mode-card-body' },
        h('h3', null, `${def.icon} ${def.title}`),
        h('ul', { class: 'mode-points' }, def.points.map((p) => h('li', null, p))),
        h('p', { class: 'mode-learn' }, `學到：${def.learn}`),
        recordEl,
        h('button', { type: 'button', class: 'btn btn-primary', onClick: () => openMode(def) }, '開始')));
  });
  menu.replaceChildren(
    h('div', { class: 'menu-head' }, h('h2', null, '🏆 挑戰'), modeGuideButton('challenge', '❓ 挑戰頁怎麼玩')),
    h('div', { class: 'mode-menu' }, cards),
    h('div', { class: 'learn-order' }, h('strong', null, '建議順序'),
      LEARN_ORDER.flatMap((t, i) => [i ? h('span', { class: 'arrow' }, '→') : null, h('span', { class: 'order-step' }, `${i + 1}. ${t}`)])));

  setInterval(() => {
    if (menu.hidden || menu.offsetParent === null) return;
    demos.forEach((d) => d.tick());
  }, DEMO_TICK_MS);

  return {
    el: h('div', { class: 'challenge' }, menu, holder),
    activate: () => {
      if (current) return;
      records.forEach((r) => { r.el.textContent = r.read(); });
      openModeGuideIfFirstTime('challenge');
    },
    deactivate: () => { if (current) current.deactivate(); },
    onKey: () => {},
  };
}
