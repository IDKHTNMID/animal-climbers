// ---------- Learn page (spec 5, revised layout in spec v1.2) ----------
const DEFAULT_PROBLEM_CONFIG = Object.freeze({ type: '2d', mapId: '2d-twin', seed: 12345, count: COUNT_LIMITS['2d'].def });

function defaultParamsByAlgo() {
  return Object.fromEntries(ALGO_KEYS.map((k) => [k, { ...DEFAULT_PARAMS }]));
}

function createLearnPage() {
  let config = { ...DEFAULT_PROBLEM_CONFIG };
  let problem = buildProblem(config);
  let algo = 'hc';
  let paramsByAlgo = defaultParamsByAlgo();
  let start = problem.start;
  let startCounter = 0;
  let run = null;
  let past = [];

  const hint = createHint();
  const canvas = h('canvas', { class: 'map-canvas', 'aria-label': '地圖畫布：點擊可以設定起點' });
  const view = new MapView(canvas, { showCandidates: true, bubbles: true, onClick: handleMapClick });
  const status = createStatusCard();
  const stepCard = createStepCard();
  const history = createHistoryPanel();
  const magnifier = createMagnifier();
  const tspDetail = createStepDetail();
  const explorer = createNeighbourExplorer({ onPreview: (preview) => { view.explain = preview; } });
  const summary = createRuleSummary((p) => openProblemGuide(p));
  const player = createPlayer({ tick: doStep, onChange: (playing) => { controls.setPlaying(playing); refresh(); } });
  const controls = createControlBar({
    onToggle: () => player.toggle(),
    onStep: () => { player.pause(); doStep(); },
    onBack: () => stepBack(),
    onReset: () => { player.pause(); resetRun(); },
    onSpeed: (v) => { player.setSpeed(v); view.setSpeed(v); },
  });
  view.setSpeed(5);
  const picker = createProblemPicker({ initial: config, onChange: (next) => { config = next; loadProblem(); } });
  const cards = createAgentCards({ selected: algo, onSelect: selectAlgo });
  const params = createParamPanel({
    algos: [algo], type: config.type, values: paramsByAlgo[algo],
    onChange: (values) => {
      paramsByAlgo = { ...paramsByAlgo, [algo]: values };
      if (run.state.step === 0) resetRun();
      else params.setPending(true);
    },
  });
  const answerToggle = h('input', { type: 'checkbox' });
  answerToggle.addEventListener('change', () => { view.showAnswer = answerToggle.checked; });
  const vizRow = h('div', { class: 'viz-row' }, h('div', { class: 'viz-canvas' }, hint.el, canvas), magnifier.el);

  function loadProblem() {
    player.pause();
    problem = buildProblem(config);
    start = problem.start;
    startCounter = 0;
    view.setProblem(problem);
    params.set({ type: config.type, values: paramsByAlgo[algo] });
    vizRow.classList.toggle('with-side', problem.type === '2d');
    explorer.el.hidden = problem.type !== 'tsp';
    // The site tour comes first on a brand-new visit; the problem guide waits until it is done.
    if (!siteTourPending()) getGuideModal().openIfFirstTime(problemSlides(problem), problemGuideKey(problem.type));
    resetRun();
  }

  function selectAlgo(next) {
    player.pause();
    algo = next;
    cards.set(algo);
    params.set({ algos: [algo], values: paramsByAlgo[algo] });
    resetRun();
  }

  function resetRun() {
    run = createRun({ algo, problem, params: paramsByAlgo[algo], start, seed: config.seed });
    past = [];
    params.setPending(false);
    stepCard.setAlgo(algo, problem);
    const meta = ALGOS[algo];
    stepCard.reset(`${meta.animal}準備好了！按「⏭ 下一步」一步一步看，或按「▶ 播放」連續執行。${problem.type === 'tsp' ? '' : '也可以點地圖換起點。'}`);
    history.clear();
    if (problem.type === 'tsp') explorer.update(run);
    refresh();
  }

  function refresh() {
    const rec = lastRecord(run);
    view.setAgents([{ key: algo, run }]);
    status.update(run, player.playing);
    magnifier.update(run, rec);
    tspDetail.update(run, rec);
    summary.update(problem, run.params);
  }

  function doStep() {
    if (run.state.stopped) return false;
    past = [...past, run];
    run = stepRun(run);
    const rec = lastRecord(run);
    stepCard.show(run, rec);
    history.add(rec.step, narrate(run, rec));
    if (rec.stopped === 'local' && !foundGlobal(run)) stepCard.showStuck(selectAlgo);
    if (problem.type === 'tsp') explorer.update(run);
    refresh();
    return !run.state.stopped;
  }

  /** Spec v1.4 item 3: go back one step by restoring the previous (immutable) run. */
  function stepBack() {
    player.pause();
    if (!past.length) {
      hint.show('已經在第 0 步了');
      return;
    }
    run = past[past.length - 1];
    past = past.slice(0, -1);
    const rec = lastRecord(run);
    history.clear();
    run.records.slice(-MAX_HISTORY).forEach((r) => history.add(r.step, narrate(run, r)));
    if (rec) stepCard.show(run, rec);
    else stepCard.reset('回到第 0 步了。按「⏭ 下一步」重新開始。');
    if (problem.type === 'tsp') explorer.update(run);
    refresh();
  }

  function openProblemGuide(p) {
    getGuideModal().open(problemSlides(p), problemGuideKey(p.type));
  }

  function handleMapClick({ pos }) {
    if (pos === undefined) return;
    if (run.state.step > 0) {
      hint.show('先按「↺ 重置」才能更換起點');
      return;
    }
    start = pos;
    resetRun();
  }

  function randomStart() {
    player.pause();
    startCounter += 1;
    start = randomStartFor(problem, config.seed, startCounter);
    resetRun();
  }

  const el = h('div', { class: 'layout-3' },
    h('aside', { class: 'col-left' }, picker.el, cards.el, params.el),
    h('div', { class: 'col-main' },
      h('div', { class: 'canvas-wrap' }, summary.el, vizRow, tspDetail.topEl, explorer.el),
      h('div', { class: 'canvas-tools' },
        h('button', { type: 'button', class: 'btn btn-small', onClick: randomStart }, '🎲 隨機起點'),
        h('button', { type: 'button', class: 'btn btn-small guide-btn', onClick: () => openProblemGuide(problem) }, '📘 這個問題的導覽'),
        h('label', { class: 'toggle' }, answerToggle, ' 顯示答案 ⭐')),
      controls.el,
      stepCard.el,
      tspDetail.el),
    h('aside', { class: 'col-right' }, status.el, history.el));

  loadProblem();
  return {
    el,
    deactivate: () => player.pause(),
    openGuideIfFirstTime: () => getGuideModal().openIfFirstTime(problemSlides(problem), problemGuideKey(problem.type)),
    onKey(action) {
      if (action === 'toggle') player.toggle();
      if (action === 'step') { player.pause(); doStep(); }
      if (action === 'back') stepBack();
      if (action === 'reset') { player.pause(); resetRun(); }
    },
  };
}
