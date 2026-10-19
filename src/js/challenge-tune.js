// ---------- Challenge 3: tune parameters to pass (spec 7.3, layout revised in spec v1.2) ----------
const TUNE_SEEDS = Object.freeze([11, 22, 33, 44, 55]);
const TUNE_PASS = 3;
const TUNE_SPEED = 25;
const STAR_KEY = 'animal-climbers-stars-v1';
const TRIAL_COLORS = Object.freeze(['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6']);

const heightTarget = () => ({ value: GLOBAL_HEIGHT, label: `目標 ≥ ${GLOBAL_HEIGHT}` });

const TUNE_LEVELS = Object.freeze([
  {
    id: 1, title: '第 1 關：幫小龍跳出陷阱', type: '2d', mapId: '2d-twin', algo: 'sa',
    keys: ['step2d', 't0', 'alpha', 'tMin'], init: { step2d: 1, t0: 1, alpha: 0.9, tMin: 0.1 }, maxSteps: 200,
    goal: '歷史最佳高度 ≥ 97（找到全域最高峰）',
    story: '小龍太冷、冷得太快、步伐又太小，一下就被困在小山丘上。調整參數，讓牠在 200 步內找到最高峰！',
    hint: '試試看提高起始溫度 T₀，或讓冷卻慢一點（α 接近 1）；步長大一點也能走得更遠。',
    hints: [
      '先挑戰一次，再點下方縮圖看失敗的起點：小龍是不是走沒幾步就停了（溫度很快就低於 T_min），一直待在同一座小山丘上？',
      'T₀ 決定一開始有多敢冒險；α 決定冷卻有多慢（越接近 1 越慢）；步長決定一步能跨多遠。現在三個都太小，小龍還沒離開小山丘就冷掉了。',
      '把 T₀ 提高到 10～50、α 調到 0.98 以上、步長調到 2 或 3，再挑戰一次。',
    ],
    answer: { step2d: 2, t0: 20, alpha: 0.99, tMin: 0.1 },
    success: (run) => foundGlobal(run),
    target: heightTarget,
  },
  {
    id: 2, title: '第 2 關：狐狸的鋸齒山脈', type: '1d', mapId: '1d-saw', algo: 'ts',
    keys: ['step1d', 'tenure'], init: { step1d: 10, tenure: 10 }, maxSteps: 100,
    goal: '歷史最佳高度 ≥ 97（找到 x=150 的最高峰）',
    story: '鋸齒山脈有 10 座山峰，狐狸只有 100 步。步長要怎麼設，才不會一直跨過山頂？',
    hint: '步長太大會跨過狹窄的山頂；山峰在 10、30、50…的位置，想想看什麼步長能踩到山頂。禁忌表長度也會影響狐狸能不能回頭。',
    hints: [
      '看失敗起點的大畫面：狐狸是不是一直踩在山腰上，從來沒有剛好踩到山頂？',
      '山峰很尖，只有幾格寬，而且都在 10、30、50…這些位置。狐狸只能停在「起點 ± 步長的倍數」上，所以步長決定牠踩得到哪些點。',
      '步長 10 一次跨太遠；試試比較小的步長，例如 2 或 6，禁忌表長度先維持 10。',
    ],
    answer: { step1d: 6, tenure: 10 },
    success: (run) => foundGlobal(run),
    target: heightTarget,
  },
  {
    id: 3, title: '第 3 關：群聚城市大旅行', type: 'tsp', mapId: 'tsp-cluster', algo: 'sa',
    keys: ['t0', 'alpha', 'tMin'], init: { t0: 500, alpha: 0.95, tMin: 0.1 }, maxSteps: 500,
    goal: '路線長度 ≤ 參考最佳 × 1.05',
    story: '16 座城市分成 4 群。小龍現在太燙又冷得太快，路線亂七八糟。調整溫度，讓牠在 500 步內規劃出好路線！',
    hint: '溫度太高時小龍會亂走，太低又會卡住。試試看 T₀ 在 5～50 之間、α 在 0.98～0.995 之間。',
    hints: [
      '看右邊的疊圖：5 條線是不是一開始亂跳、後來又突然變平？那代表小龍前半段太熱在亂走，後半段又冷得太快。',
      'T₀ 要配合「一次改法讓長度變多少」：這張圖一次改動大約差 5～50。T₀=500 太熱，幾乎什麼都接受；α=0.95 冷得太快，500 步裡大部分時間都是冷的。',
      'T₀ 試 5～30，α 試 0.99 左右，T_min 維持 0.1。',
    ],
    answer: { t0: 10, alpha: 0.99, tMin: 0.1 },
    success: (run) => run.state.best.display <= run.problem.ref.length * 1.05,
    target: (problem) => ({ value: problem.ref.length * 1.05, label: `目標 ≤ ${fmt1(problem.ref.length * 1.05)}` }),
  },
]);

const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const starsFor = (wins) => (wins >= 5 ? 3 : wins >= 4 ? 2 : wins >= TUNE_PASS ? 1 : 0);
const levelProblem = (level) => buildProblem({ type: level.type, mapId: level.mapId, seed: 1, count: COUNT_LIMITS[level.type].def });

function totalStars() {
  const stars = storage.get(STAR_KEY, {});
  return TUNE_LEVELS.reduce((sum, lv) => sum + (stars[lv.id] || 0), 0);
}

function trialThumb(problem, seed, k, onSelect, track) {
  const canvas = h('canvas', { class: 'thumb-canvas', 'aria-label': `試驗 ${k + 1}` });
  const view = track(new MapView(canvas, { compact: true }));
  view.setProblem(problem);
  view.setSpeed(TUNE_SPEED);
  const label = h('div', { class: 'thumb-label' });
  const el = h('button', { type: 'button', class: 'thumb', style: `--trial:${TRIAL_COLORS[k]}`, onClick: () => onSelect(k) }, canvas, label);
  return { seed, view, label, el };
}

const HINT_TIERS = Object.freeze(['🔍 觀察', '💭 概念', '🧭 方向', '🔑 答案']);
const ANSWER_STAR_CAP = 1;

/** Four-tier hints (spec v1.3, B): observe → concept → direction → answer (applying it caps the stars). */
function createHintBox(level, onApply) {
  let shown = 0;
  const list = h('ol', { class: 'hint-list' });
  const btn = h('button', { type: 'button', class: 'btn btn-small' });
  const note = h('p', { class: 'muted small', hidden: true }, `已經看過答案：這一關最多只能拿 ${'★'.repeat(ANSWER_STAR_CAP)}。`);

  function answerText() {
    return level.keys.map((k) => `${PARAM_DEFS.find((d) => d.key === k).label} = ${level.answer[k]}`).join('、');
  }

  function render() {
    const items = HINT_TIERS.slice(0, shown).map((tier, i) => {
      if (i < 3) return h('li', null, h('b', null, `${tier}：`), level.hints[i]);
      return h('li', null, h('b', null, `${tier}：`), answerText(), ' ',
        h('button', { type: 'button', class: 'btn btn-small btn-primary', onClick: () => onApply(level.answer) }, '一鍵套用'));
    });
    list.replaceChildren(...items);
    btn.hidden = shown >= HINT_TIERS.length;
    btn.textContent = shown === HINT_TIERS.length - 1 ? '🔑 看答案（這關最多 ★）' : `💡 看提示（第 ${shown + 1} / ${HINT_TIERS.length} 階：${HINT_TIERS[shown]}）`;
    note.hidden = shown < HINT_TIERS.length;
  }

  btn.addEventListener('click', () => {
    shown += 1;
    render();
  });
  render();
  return {
    el: h('section', { class: 'panel hint-box' }, h('h3', { class: 'panel-title' }, '💡 卡關了嗎？'), list, btn, note),
    usedAnswer: () => shown >= HINT_TIERS.length,
  };
}

/** Level page: big view of the selected trial, a filmstrip of 5 trials, params and an overlay chart. */
function buildLevelView(level, { onBack, setPlayer, track }) {
  let values = { ...DEFAULT_PARAMS, ...level.init, maxSteps: level.maxSteps };
  let runs = [];
  let selected = 0;
  const problem = levelProblem(level);
  const bigCanvas = h('canvas', { class: 'map-canvas', 'aria-label': '選中試驗的大畫面' });
  const big = track(new MapView(bigCanvas, { showCandidates: true, bubbles: true }));
  big.setProblem(problem);
  big.setSpeed(TUNE_SPEED);
  const bigTitle = h('h3', { class: 'panel-title' });
  const chartCanvas = h('canvas', { class: 'chart-canvas', 'aria-label': '5 次試驗的最佳值折線圖' });
  const chart = new ChartView(chartCanvas);
  const summary = h('div', { class: 'result-box', hidden: true });
  const goBtn = h('button', { type: 'button', class: 'btn btn-primary' }, '🚀 挑戰！');
  const skipBtn = h('button', { type: 'button', class: 'btn', hidden: true }, '⏩ 跳到結果');
  const params = createParamPanel({
    algos: [level.algo], type: level.type, values, keys: level.keys, title: `${ALGOS[level.algo].animal}的參數`, showReset: false,
    onChange: (next) => { values = { ...next, maxSteps: level.maxSteps }; },
  });
  const thumbs = TUNE_SEEDS.map((seed, k) => trialThumb(problem, seed, k, select, track));
  const hintBox = createHintBox(level, (answer) => {
    values = { ...values, ...answer };
    params.set({ values });
  });

  function select(k) {
    selected = k;
    thumbs.forEach((t, i) => t.el.classList.toggle('selected', i === k));
    big.setAgents([{ key: `trial-${k}`, run: runs[k] }]);
    bigTitle.textContent = `起點 #${k + 1} 的大畫面（點下方縮圖可以切換）`;
  }

  function resultText(k) {
    const r = runs[k];
    if (!r.state.stopped) return `#${k + 1}　${fmt1(r.state.best.display)}`;
    return `#${k + 1}　${level.success(r) ? '✓' : '✗'} ${fmt1(r.state.best.display)}`;
  }

  function sync() {
    thumbs.forEach((t, k) => {
      const done = Boolean(runs[k].state.stopped);
      t.view.setAgents([{ key: 'a', run: runs[k] }]);
      t.label.textContent = resultText(k);
      t.el.classList.toggle('pass', done && level.success(runs[k]));
      t.el.classList.toggle('fail', done && !level.success(runs[k]));
    });
    big.setAgents([{ key: `trial-${selected}`, run: runs[selected] }]);
    chart.setRuns(runs, {
      styles: TRIAL_COLORS.map((color, k) => ({ color, name: `#${k + 1}` })), target: level.target(problem), hideCurrent: true,
    });
  }

  function freshRuns() {
    runs = thumbs.map((t) => createRun({ algo: level.algo, problem, params: values, start: randomStartFor(problem, t.seed, 0), seed: t.seed }));
    sync();
  }

  function evaluate() {
    sync();
    const wins = runs.filter((r) => level.success(r)).length;
    const stars = hintBox.usedAnswer() ? Math.min(ANSWER_STAR_CAP, starsFor(wins)) : starsFor(wins);
    const saved = storage.get(STAR_KEY, {});
    if (stars > (saved[level.id] || 0)) storage.set(STAR_KEY, { ...saved, [level.id]: stars });
    const firstFail = runs.findIndex((r) => !level.success(r));
    if (firstFail >= 0) select(firstFail);
    summary.replaceChildren(
      h('p', { class: stars ? 'good' : 'bad' }, stars ? `🎉 過關！成功 ${wins} / 5 次　${starText(stars)}` : `😣 只成功 ${wins} / 5 次，至少要 ${TUNE_PASS} 次才過關。`),
      ...(firstFail >= 0 ? [h('p', { class: 'muted' }, `大畫面已切到失敗的起點 #${firstFail + 1}，看看牠卡在哪裡。`)] : []),
      ...(stars ? [] : [h('p', null, `💡 ${level.hint}`)]));
    summary.hidden = false;
    goBtn.disabled = false;
    skipBtn.hidden = true;
  }

  const player = createPlayer({
    tick: () => {
      runs = runs.map((r) => stepRun(r));
      sync();
      if (!runs.every((r) => r.state.stopped)) return true;
      evaluate();
      return false;
    },
    onChange: () => {},
  });
  player.setSpeed(TUNE_SPEED);
  setPlayer(player);
  goBtn.addEventListener('click', () => {
    player.pause();
    freshRuns();
    select(selected);
    summary.hidden = true;
    goBtn.disabled = true;
    skipBtn.hidden = false;
    player.play();
  });
  skipBtn.addEventListener('click', () => {
    player.pause();
    runs = runs.map(runToEnd);
    evaluate();
  });

  freshRuns();
  select(0);
  return h('div', { class: 'level-page' },
    h('div', { class: 'level-head' },
      h('button', { type: 'button', class: 'btn btn-small', onClick: () => { player.pause(); onBack(); } }, '← 選擇關卡'),
      h('h3', null, level.title)),
    h('p', null, level.story),
    h('p', { class: 'goal' }, `🎯 目標：從 5 個不同起點各跑一次（最多 ${level.maxSteps} 步），至少 ${TUNE_PASS} 次達成「${level.goal}」。`),
    h('div', { class: 'tune-layout' },
      h('div', { class: 'tune-main' },
        h('section', { class: 'panel' }, bigTitle, bigCanvas),
        h('div', { class: 'filmstrip' }, thumbs.map((t) => t.el))),
      h('div', { class: 'tune-side' },
        params.el,
        h('div', { class: 'row' }, goBtn, skipBtn),
        summary,
        hintBox.el,
        h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '5 次試驗的歷史最佳'), chartCanvas))));
}

function levelCard(level, stars, onOpen, track) {
  const canvas = h('canvas', { class: 'thumb-canvas', 'aria-label': `${level.title} 的地圖` });
  const view = track(new MapView(canvas, { compact: true }));
  view.setProblem(levelProblem(level));
  view.showAnswer = true;
  return h('button', { type: 'button', class: 'level-card', onClick: () => onOpen(level) },
    canvas,
    h('div', { class: 'level-card-head' }, agentImg(level.algo, 36), h('strong', null, level.title)),
    h('div', { class: 'muted' }, `🎯 ${level.goal}`),
    h('div', { class: 'muted' }, `可調：${level.keys.map((k) => PARAM_DEFS.find((d) => d.key === k).label).join('、')}`),
    h('span', { class: 'stars' }, starText(stars[level.id] || 0)));
}

function createTuneMode({ onBack }) {
  const levelList = h('div', { class: 'level-grid' });
  const levelView = h('div', { class: 'level-view', hidden: true });
  let player = null;
  let views = [];

  function dispose() {
    if (player) player.pause();
    views.forEach((v) => v.destroy());
    views = [];
  }
  const track = (view) => {
    views.push(view);
    return view;
  };

  function renderList() {
    dispose();
    const stars = storage.get(STAR_KEY, {});
    levelList.replaceChildren(...TUNE_LEVELS.map((lv) => levelCard(lv, stars, openLevel, track)),
      h('div', { class: 'level-card tip' },
        h('strong', null, `⭐ 目前星星 ${totalStars()} / ${TUNE_LEVELS.length * 3}`),
        h('p', { class: 'muted' }, '每關會用 5 個不同起點各跑一次：成功 3 次 ★、4 次 ★★、5 次 ★★★。'),
        h('p', { class: 'muted' }, '每關的初始參數都故意設得不好，先挑戰一次看看失敗在哪裡，再動手調整。')));
    levelList.hidden = false;
    levelView.hidden = true;
  }

  function openLevel(level) {
    dispose();
    levelView.replaceChildren(buildLevelView(level, { onBack: renderList, setPlayer: (p) => { player = p; }, track }));
    levelList.hidden = true;
    levelView.hidden = false;
  }

  const el = h('div', { class: 'mode' },
    h('div', { class: 'mode-head' }, h('button', { type: 'button', class: 'btn btn-small', onClick: () => { dispose(); onBack(); } }, '← 回到選單'),
      h('h2', null, '🎛 調參過關'), modeGuideButton('tune')),
    levelList, levelView);

  return {
    el,
    start: () => {
      renderList();
      openModeGuideIfFirstTime('tune');
    },
    deactivate: () => { if (player) player.pause(); },
  };
}
