// ---------- Challenge 1: predict the winner (spec 7.1; redesigned in spec v1.6) ----------
// Only the dragon (SA) and the fox (TS) can win: the goat follows exactly the fox's first climb and stops,
// so at best it ties. Every question is pre-simulated so it matches one teaching scenario and has a single winner.
const PREDICT_ROUNDS = 5;
const PREDICT_SPEED = 20;
const PREDICT_MARGIN = 0.5;
const SCENARIO_TRIES = 400;
const PREDICT_CHOICES = Object.freeze(['sa', 'ts']);

const PREDICT_SCENARIOS = Object.freeze({
  trap2d: {
    type: '2d', winner: 'sa',
    fits: (intel) => !intel.climbsToGlobal && intel.valley >= 10,
    clue: (intel) => `2D 地形。起點附近的小山和主峰之間，隔著一道深 ${fmt1(intel.valley)} 的山谷。`,
    why: '在 2D 有 8 個方向可以繞，狐狸常在小山附近繞圈（禁忌表只記得最近 10 步），翻不過深谷；小龍熱的時候願意往下走，有機會大步跨過山谷。',
  },
  slope2d: {
    type: '2d', winner: 'ts',
    fits: (intel) => intel.climbsToGlobal,
    clue: () => '2D 地形。起點就在主峰的山坡上，一路往上爬就會到山頂。',
    why: '一路往上就到主峰，狐狸穩穩爬上去；小龍一開始很熱，會接受很多變差的移動，反而走丟。',
  },
  line1d: {
    type: '1d', winner: 'ts',
    fits: (intel) => !intel.climbsToGlobal,
    clue: (intel) => `1D 曲線，只能往左或往右。起點和主峰之間有一道深 ${fmt1(intel.valley)} 的谷。`,
    why: '1D 只有左右兩條路，狐狸不能回頭，會被逼著一路往前翻過山谷；小龍要連續好幾次「運氣好」才翻得過去。',
  },
});
const ROUND_PLAN = Object.freeze(['trap2d', 'slope2d', 'line1d', 'trap2d', 'line1d']);

function raceWinner(runs) {
  const by = Object.fromEntries(runs.map((r) => [r.algo, r.state.best.display]));
  if (Math.abs(by.sa - by.ts) <= PREDICT_MARGIN) return null;
  return by.sa > by.ts ? 'sa' : 'ts';
}

/** A random map that fits the scenario and whose race has a single winner (checked by simulation). */
function scenarioQuestion(id) {
  const scenario = PREDICT_SCENARIOS[id];
  const presets = presetsFor(scenario.type);
  for (let k = 0; k < SCENARIO_TRIES; k++) {
    const seed = randomSeed();
    const pick = randInt(Math.random, 0, presets.length);
    const mapId = pick === presets.length ? RANDOM_MAP_ID : presets[pick].id;
    const problem = buildProblem({ type: scenario.type, mapId, seed, count: COUNT_LIMITS[scenario.type].def });
    const start = randomStartFor(problem, seed, 1);
    const intel = analyzeQuestion(problem, start);
    if (!scenario.fits(intel)) continue;
    const finished = createRaceRuns(problem, start, seed, ALGO_KEYS, defaultParamsByAlgo()).map(runToEnd);
    if (raceWinner(finished) === scenario.winner) return { problem, start, seed, intel, scenario };
  }
  return null;
}

/** Kept for the play mode: a random map (preset or generated) with a random start. */
function randomQuestion(type) {
  const seed = randomSeed();
  const presets = presetsFor(type);
  const pick = randInt(Math.random, 0, presets.length);
  const mapId = pick === presets.length ? RANDOM_MAP_ID : presets[pick].id;
  const problem = buildProblem({ type, mapId, seed, count: COUNT_LIMITS[type].def });
  const start = type === 'tsp' ? problem.start : randomStartFor(problem, seed, 1);
  return { problem, start, seed };
}

function createPredictMode({ onBack }) {
  let round = 1;
  let score = 0;
  let plan = [];
  let question = null;
  let runs = [];
  let prediction = null;
  let phase = 'choose';

  const canvas = h('canvas', { class: 'map-canvas', 'aria-label': '預測比賽地圖' });
  const view = new MapView(canvas);
  view.setSpeed(PREDICT_SPEED);
  const player = createPlayer({ tick: doStep, onChange: () => {} });
  player.setSpeed(PREDICT_SPEED);
  const info = h('div', { class: 'round-info' });
  const clueBox = h('p', { class: 'goal' });
  const error = h('div', { class: 'field-error', role: 'alert' });
  const resultBox = h('div', { class: 'result-box', hidden: true });
  const actionBtn = h('button', { type: 'button', class: 'btn btn-primary', onClick: onAction });
  const skipBtn = h('button', { type: 'button', class: 'btn', hidden: true, onClick: skipToEnd }, '⏩ 跳到結果');
  const answerToggle = h('input', { type: 'checkbox' });
  answerToggle.addEventListener('change', () => { view.showAnswer = answerToggle.checked; });
  const pickButtons = PREDICT_CHOICES.map((key) => h('button', {
    type: 'button', class: 'pick-btn', 'data-key': key, 'aria-pressed': 'false', onClick: () => choose(key),
  }, agentImg(key, 44), ALGOS[key].animal));

  function choose(key) {
    if (phase !== 'choose') return;
    prediction = key;
    error.textContent = '';
    pickButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === key)));
  }

  function newGame() {
    round = 1;
    score = 0;
    plan = shuffled(Math.random, ROUND_PLAN);
    newQuestion();
  }

  function newQuestion() {
    player.pause();
    question = scenarioQuestion(plan[round - 1]) || scenarioQuestion('line1d');
    view.setProblem(question.problem);
    answerToggle.checked = false;
    view.showAnswer = false;
    runs = createRaceRuns(question.problem, question.start, question.seed, ALGO_KEYS, defaultParamsByAlgo());
    view.setAgents(runs.map((r) => ({ key: r.algo, run: r })));
    clueBox.replaceChildren(h('b', null, '🔑 線索：'), question.scenario.clue(question.intel));
    prediction = null;
    phase = 'choose';
    pickButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    resultBox.hidden = true;
    render();
  }

  function render() {
    info.textContent = `第 ${round} / ${PREDICT_ROUNDS} 題　｜　答對 ${score} 題`;
    const labels = { choose: '🏁 開始比賽', running: '比賽中…', reveal: round < PREDICT_ROUNDS ? '下一題' : '看總分', summary: '🔁 再玩一局' };
    actionBtn.textContent = labels[phase];
    actionBtn.disabled = phase === 'running';
    skipBtn.hidden = phase !== 'running';
    pickButtons.forEach((b) => { b.disabled = phase !== 'choose'; });
  }

  function onAction() {
    if (phase === 'choose') {
      if (!prediction) {
        error.textContent = '先選小龍或狐狸';
        return;
      }
      phase = 'running';
      render();
      player.play();
    } else if (phase === 'reveal') {
      if (round < PREDICT_ROUNDS) {
        round += 1;
        newQuestion();
      } else showSummary();
    } else if (phase === 'summary') newGame();
  }

  function doStep() {
    runs = runs.map((r) => stepRun(r));
    view.setAgents(runs.map((r) => ({ key: r.algo, run: r })));
    if (!runs.every((r) => r.state.stopped)) return true;
    reveal();
    return false;
  }

  function skipToEnd() {
    player.pause();
    runs = runs.map((r) => runToEnd(r));
    view.setAgents(runs.map((r) => ({ key: r.algo, run: r })));
    reveal();
  }

  function reveal() {
    if (phase !== 'running') return;
    const winner = raceWinner(runs) || question.scenario.winner;
    const correct = winner === prediction;
    if (correct) score += 1;
    phase = 'reveal';
    answerToggle.checked = true;
    view.showAnswer = true;
    const goat = runs.find((r) => r.algo === 'hc');
    resultBox.replaceChildren(
      h('p', { class: correct ? 'good' : 'bad' }, `${correct ? '🎉 答對了！' : '😅 猜錯了！'}　${ALGOS[winner].animal}贏了！`),
      h('p', null, `💡 為什麼：${question.scenario.why}`),
      h('p', { class: 'muted' }, `🐐 對照組山羊：${foundGlobal(goat) ? '一路爬到了山頂（狐狸前半段也是這樣走）。' : `第 ${goat.state.step} 步就卡在局部最高點。`}`),
      resultTable(runs));
    resultBox.hidden = false;
    render();
  }

  function showSummary() {
    phase = 'summary';
    const best = storage.get(PREDICT_BEST_KEY, 0);
    if (score > best) storage.set(PREDICT_BEST_KEY, score);
    const medal = score >= 4 ? '🏆' : score >= 2 ? '👍' : '💪';
    resultBox.replaceChildren(h('p', { class: 'summary' }, `${medal} 這局答對 ${score} / ${PREDICT_ROUNDS} 題`));
    render();
  }

  const el = h('div', { class: 'mode' },
    h('div', { class: 'mode-head' }, h('button', { type: 'button', class: 'btn btn-small', onClick: () => { player.pause(); onBack(); } }, '← 回到選單'),
      h('h2', null, '🔮 預測誰會贏'), modeGuideButton('predict')),
    info,
    h('div', { class: 'predict-grid' },
      h('div', { class: 'predict-board' }, h('div', { class: 'canvas-wrap' }, canvas),
        h('div', { class: 'canvas-tools' }, h('label', { class: 'toggle' }, answerToggle, ' 顯示答案 ⭐'), h('span', { class: 'muted small' }, '🐐 山羊一起跑，當對照組'))),
      h('div', { class: 'predict-side' },
        h('section', { class: 'panel' }, clueBox,
          h('h3', { class: 'panel-title' }, '小龍和狐狸，誰會找到更高的地方？'),
          h('div', { class: 'pick-row' }, pickButtons), error,
          h('div', { class: 'row' }, actionBtn, skipBtn), resultBox))));

  return {
    el,
    start: () => {
      newGame();
      openModeGuideIfFirstTime('predict');
    },
    deactivate: () => player.pause(),
  };
}
