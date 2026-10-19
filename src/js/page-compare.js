// ---------- Compare page (spec 6) ----------

/** F-82: same map, start and step budget; each algorithm gets its own random stream from the seed. */
function createRaceRuns(problem, start, seed, algos, paramsByAlgo) {
  return algos.map((algo, i) => createRun({ algo, problem, params: paramsByAlgo[algo], start, seed: seed + i + 1 }));
}

function rankRuns(runs) {
  const better = runs[0].ops.isBetter;
  return [...runs].sort((a, b) => (better(a.state.best.display, b.state.best.display) ? -1
    : better(b.state.best.display, a.state.best.display) ? 1 : 0));
}

function resultTable(runs) {
  const best = rankRuns(runs)[0].state.best.display;
  const isWinner = (r) => Math.abs(r.state.best.display - best) < 1e-6;
  const vn = runs[0].ops.valueName;
  return h('table', { class: 'result-table' },
    h('thead', null, h('tr', null, h('th', null, '角色'), h('th', null, `最終最佳${vn}`), h('th', null, '第幾步找到'), h('th', null, '找到全域最佳？'))),
    h('tbody', null, runs.map((r) => h('tr', { class: isWinner(r) ? 'winner' : '' },
      h('td', null, agentImg(r.algo, 22), ` ${ALGOS[r.algo].animal}`, isWinner(r) ? ' 👑' : ''),
      h('td', null, fmt1(r.state.best.display)),
      h('td', null, String(r.state.bestStep)),
      h('td', null, foundGlobal(r) ? '✓' : '✗')))));
}

/** One plain-language line per animal under the result table (spec v1.4 review fix). */
function compareNotes(runs) {
  const notes = runs.map((r) => {
    const won = foundGlobal(r);
    if (r.algo === 'hc') return won ? '🐐 山羊一路往更好的方向走，就到了最佳解。' : `🐐 山羊在第 ${r.state.step} 步就停了：四周都沒有更好的鄰居，卡在局部最佳。`;
    if (r.algo === 'sa') return `🐲 小龍接受了 ${r.state.worseAccepts} 次變差的移動，${won ? '最後找到了最佳解。' : '但沒有找到最佳解。'}`;
    return won ? '🦊 狐狸被禁忌表逼著繼續往外走，找到了最佳解。' : '🦊 狐狸繞了一圈，還是沒找到最佳解。';
  });
  return h('div', { class: 'compare-notes' }, notes.map((t) => h('p', null, t)));
}

function createComparePage() {
  let config = { ...DEFAULT_PROBLEM_CONFIG };
  let problem = buildProblem(config);
  let start = problem.start;
  let startCounter = 0;
  let selected = new Set(ALGO_KEYS);
  let paramsByAlgo = defaultParamsByAlgo();
  let runs = [];
  let past = [];

  const hint = createHint();
  const canvas = h('canvas', { class: 'map-canvas', 'aria-label': '比較用地圖畫布' });
  const view = new MapView(canvas, { onClick: handleMapClick });
  const trio = createTspTrio();
  const mapWrap = h('div', { class: 'canvas-wrap' }, hint.el, canvas);
  const startBtn = h('button', { type: 'button', class: 'btn btn-small', onClick: () => randomStart() }, '🎲 隨機起點');
  const chartCanvas = h('canvas', { class: 'chart-canvas', 'aria-label': '目前最佳值與步數折線圖' });
  const chart = new ChartView(chartCanvas);
  const results = h('div', { class: 'results' });
  const error = h('div', { class: 'field-error', role: 'alert' });
  const player = createPlayer({ tick: doStep, onChange: (playing) => controls.setPlaying(playing) });
  const controls = createControlBar({
    onToggle: () => togglePlay(),
    onStep: () => { player.pause(); if (validate()) doStep(); },
    onBack: () => stepBack(),
    onReset: () => { player.pause(); resetRuns(); },
    onSpeed: (v) => { player.setSpeed(v); view.setSpeed(v); },
  });
  view.setSpeed(5);
  const skipBtn = h('button', { type: 'button', class: 'btn', onClick: () => skipToEnd() }, '⏩ 跳到結果');
  controls.el.insertBefore(skipBtn, controls.el.querySelector('.speed'));
  const picker = createProblemPicker({ initial: config, onChange: (next) => { config = next; loadProblem(); } });
  const answerToggle = h('input', { type: 'checkbox' });
  answerToggle.addEventListener('change', () => {
    view.showAnswer = answerToggle.checked;
    trio.setShowAnswer(answerToggle.checked);
  });

  const participantPanels = ALGO_KEYS.map((algo) => {
    const panel = createParamPanel({
      algos: [algo], type: config.type, values: paramsByAlgo[algo], title: `${ALGOS[algo].animal}的參數`,
      onChange: (values) => {
        paramsByAlgo = { ...paramsByAlgo, [algo]: values };
        if (runs.every((r) => r.state.step === 0)) resetRuns();
        else panel.setPending(true);
      },
    });
    const details = h('details', { class: 'participant-params' }, h('summary', null, '展開參數'), panel.el);
    const check = h('input', { type: 'checkbox', checked: true });
    check.addEventListener('change', () => {
      const next = new Set(selected);
      if (check.checked) next.add(algo); else next.delete(algo);
      selected = next;
      player.pause();
      resetRuns();
    });
    const el = h('div', { class: 'participant', style: `--agent:${ALGOS[algo].color}` },
      h('label', { class: 'participant-head' }, check, agentImg(algo, 28), ` ${ALGOS[algo].animal}・${ALGOS[algo].name}`), details);
    return { algo, panel, el };
  });

  function validate() {
    if (selected.size > 0) {
      error.textContent = '';
      return true;
    }
    error.textContent = '至少選一位參賽者';
    return false;
  }

  function togglePlay() {
    if (player.playing) player.pause();
    else if (validate()) player.play();
  }

  function loadProblem() {
    player.pause();
    problem = buildProblem(config);
    start = problem.start;
    startCounter = 0;
    view.setProblem(problem);
    trio.setProblem(problem);
    const isTsp = problem.type === 'tsp';
    mapWrap.hidden = isTsp;
    trio.el.hidden = !isTsp;
    startBtn.textContent = isTsp ? '🎲 換一條初始路線' : '🎲 隨機起點';
    participantPanels.forEach((p) => p.panel.set({ type: config.type, values: paramsByAlgo[p.algo] }));
    resetRuns();
  }

  function resetRuns() {
    const algos = ALGO_KEYS.filter((a) => selected.has(a));
    runs = createRaceRuns(problem, start, config.seed, algos, paramsByAlgo);
    past = [];
    participantPanels.forEach((p) => p.panel.setPending(false));
    results.replaceChildren(h('p', { class: 'muted' }, '全部參賽者停止後，這裡會顯示結果表。'));
    if (algos.length) validate();
    refresh();
  }

  function refresh() {
    if (problem.type === 'tsp') trio.update(runs);
    else view.setAgents(runs.map((run) => ({ key: run.algo, run })));
    chart.setRuns(runs);
  }

  function doStep() {
    if (!runs.length || runs.every((r) => r.state.stopped)) return false;
    past = [...past, runs];
    runs = runs.map((r) => stepRun(r));
    refresh();
    const done = runs.every((r) => r.state.stopped);
    if (done) results.replaceChildren(resultTable(runs), compareNotes(runs));
    return !done;
  }

  /** Spec v1.3, B: run every participant to the end at once. */
  function skipToEnd() {
    player.pause();
    if (!validate()) return;
    past = [...past, runs];
    runs = runs.map((r) => runToEnd(r));
    refresh();
    results.replaceChildren(resultTable(runs), compareNotes(runs));
  }

  /** Spec v1.4 item 3: go back one step (or undo the jump to the result). */
  function stepBack() {
    player.pause();
    if (!past.length) {
      hint.show('已經在第 0 步了');
      return;
    }
    runs = past[past.length - 1];
    past = past.slice(0, -1);
    results.replaceChildren(h('p', { class: 'muted' }, '全部參賽者停止後，這裡會顯示結果表。'));
    refresh();
  }

  function handleMapClick({ pos }) {
    if (pos === undefined) return;
    if (runs.some((r) => r.state.step > 0)) {
      hint.show('先按「↺ 重置」才能更換起點');
      return;
    }
    start = pos;
    resetRuns();
  }

  function randomStart() {
    player.pause();
    startCounter += 1;
    start = randomStartFor(problem, config.seed, startCounter);
    resetRuns();
  }

  const el = h('div', { class: 'layout-2' },
    h('aside', { class: 'col-left' }, picker.el,
      h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '參賽者'), participantPanels.map((p) => p.el), error)),
    h('div', { class: 'col-main' },
      mapWrap, trio.el,
      h('div', { class: 'canvas-tools' },
        startBtn,
        modeGuideButton('compare', '❓ 比較頁怎麼用'),
        h('label', { class: 'toggle' }, answerToggle, ' 顯示答案 ⭐')),
      controls.el,
      h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '目前最佳值 vs 步數'), chartCanvas),
      h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '結果'), results)));

  loadProblem();
  return {
    el,
    activate: () => {
      chart.draw();
      openModeGuideIfFirstTime('compare');
    },
    deactivate: () => player.pause(),
    onKey(action) {
      if (action === 'toggle') togglePlay();
      if (action === 'step') { player.pause(); if (validate()) doStep(); }
      if (action === 'back') stepBack();
      if (action === 'reset') { player.pause(); resetRuns(); }
    },
  };
}
