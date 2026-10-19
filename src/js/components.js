// ---------- Shared components (spec 4.1, 4.3 - 4.7) ----------

/** F-10 ~ F-13: problem type, map, seed and random-count picker. */
function createProblemPicker({ initial, onChange }) {
  let config = { ...initial };
  const mapSelect = h('select', { class: 'select', 'aria-label': '地圖', onChange: (e) => update({ mapId: e.target.value }) });
  const seedInput = h('input', { type: 'text', inputmode: 'numeric', class: 'input seed-input', 'aria-label': '種子碼', value: String(config.seed) });
  const seedError = h('div', { class: 'field-error', role: 'alert' });
  const countValue = h('output', { class: 'param-value' });
  const countInput = h('input', { type: 'range', class: 'range', 'aria-label': '數量' });
  const countLabel = h('span', { class: 'param-label' });
  const countRow = h('div', { class: 'param-row' }, countLabel, countInput, countValue);
  const typeSeg = segmented(PROBLEM_TYPES, config.type, (type) =>
    update({ type, mapId: presetsFor(type)[0].id, count: COUNT_LIMITS[type].def }));

  seedInput.addEventListener('input', () => {
    const seed = parseSeed(seedInput.value);
    if (seed === null) {
      seedError.textContent = `請輸入 ${SEED_MIN}～${SEED_MAX} 的整數`;
      return;
    }
    seedError.textContent = '';
    update({ seed });
  });
  countInput.addEventListener('input', () => update({ count: Number(countInput.value) }));
  const dice = h('button', {
    type: 'button', class: 'icon-btn', title: '隨機種子碼', 'aria-label': '隨機種子碼',
    onClick: () => {
      const seed = randomSeed();
      seedInput.value = String(seed);
      seedError.textContent = '';
      update({ seed });
    },
  }, '🎲');

  function render() {
    typeSeg.set(config.type);
    mapSelect.replaceChildren(...presetsFor(config.type).map((d) => h('option', { value: d.id }, d.name)),
      h('option', { value: RANDOM_MAP_ID }, '🎲 隨機產生'));
    mapSelect.value = config.mapId;
    const limits = COUNT_LIMITS[config.type];
    countLabel.textContent = limits.label;
    Object.assign(countInput, { min: limits.min, max: limits.max, step: 1, value: config.count });
    countValue.textContent = String(config.count);
    countRow.hidden = config.mapId !== RANDOM_MAP_ID;
  }

  function update(patch) {
    config = { ...config, ...patch };
    render();
    onChange(config);
  }

  render();
  const el = h('section', { class: 'panel' },
    h('h3', { class: 'panel-title' }, '問題與地圖'),
    typeSeg.el,
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '地圖'), mapSelect),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '種子'), h('div', { class: 'seed-row' }, seedInput, dice)),
    seedError,
    countRow);
  return { el, get: () => config };
}

/** F-40 / F-41: sliders for the parameters relevant to the given algorithms and problem type. */
function createParamPanel({ algos, type, values, keys = null, onChange, title = '參數', showReset = true }) {
  let state = { algos, type, values };
  const rows = h('div', { class: 'param-list' });
  const note = h('div', { class: 'pending-note', hidden: true }, '⏳ 重置後生效');
  const resetBtn = showReset ? h('button', {
    type: 'button', class: 'btn btn-small',
    onClick: () => {
      state = { ...state, values: { ...state.values, ...pickDefaults() } };
      render();
      onChange(state.values);
    },
  }, '恢復預設') : null;

  function visibleDefs() {
    return PARAM_DEFS.filter((d) => d.types.includes(state.type)
      && d.algos.some((a) => state.algos.includes(a)) && (!keys || keys.includes(d.key)));
  }

  function pickDefaults() {
    return Object.fromEntries(visibleDefs().map((d) => [d.key, DEFAULT_PARAMS[d.key]]));
  }

  function render() {
    rows.replaceChildren(...visibleDefs().map((def) => {
      const out = h('output', { class: 'param-value' }, state.values[def.key].toFixed(def.digits));
      const input = h('input', {
        type: 'range', class: 'range', min: def.min, max: def.max, step: def.step, value: state.values[def.key], 'aria-label': def.label,
      });
      input.addEventListener('input', () => {
        const value = Number(input.value);
        out.textContent = value.toFixed(def.digits);
        state = { ...state, values: { ...state.values, [def.key]: value } };
        onChange(state.values);
      });
      return h('label', { class: 'param-row' }, h('span', { class: 'param-label' }, def.label), input, out);
    }));
  }

  render();
  const el = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h3', { class: 'panel-title' }, title), resetBtn), rows, note);
  return {
    el,
    set(patch) {
      state = { ...state, ...patch };
      render();
    },
    setPending(isPending) { note.hidden = !isPending; },
  };
}

/** Timing loop for auto-play (F-50, F-53). tick() returns false when there is nothing left to run. */
function createPlayer({ tick, onChange }) {
  let timer = null;
  let speed = 5;
  const loop = () => {
    if (!tick()) {
      stop();
      return;
    }
    timer = setTimeout(loop, 1000 / speed);
  };
  function stop() {
    clearTimeout(timer);
    timer = null;
    onChange(false);
  }
  return {
    get playing() { return timer !== null; },
    setSpeed(value) { speed = value; },
    play() {
      if (timer !== null) return;
      timer = setTimeout(loop, 0);
      onChange(true);
    },
    pause() { if (timer !== null) stop(); },
    toggle() { if (timer !== null) stop(); else this.play(); },
  };
}

/** F-50 ~ F-53 */
function createControlBar({ onToggle, onStep, onBack = null, onReset, onSpeed, speed = 5 }) {
  const playBtn = h('button', { type: 'button', class: 'btn', onClick: onToggle }, '▶ 播放');
  const speedOut = h('output', { class: 'param-value' }, String(speed));
  const speedInput = h('input', { type: 'range', class: 'range', min: 1, max: 20, step: 1, value: speed, 'aria-label': '速度' });
  speedInput.addEventListener('input', () => {
    speedOut.textContent = speedInput.value;
    onSpeed(Number(speedInput.value));
  });
  const el = h('div', { class: 'control-bar' },
    playBtn,
    onBack ? h('button', { type: 'button', class: 'btn', onClick: onBack }, '⏮ 上一步') : null,
    h('button', { type: 'button', class: 'btn btn-primary', onClick: onStep }, '⏭ 下一步'),
    h('button', { type: 'button', class: 'btn', onClick: onReset }, '↺ 重置'),
    h('label', { class: 'speed' }, h('span', { class: 'param-label' }, '速度'), speedInput, speedOut, h('span', { class: 'unit' }, '步/秒')));
  return {
    el,
    setPlaying(isPlaying) { playBtn.textContent = isPlaying ? '⏸ 暫停' : '▶ 播放'; },
  };
}

function thermometer(run) {
  const { t0, tMin } = run.params;
  const T = run.state.T;
  const frac = clamp((Math.log(T) - Math.log(tMin)) / (Math.log(t0) - Math.log(tMin) || 1), 0, 1);
  const hue = Math.round(220 * (1 - frac));
  return h('div', { class: 'thermo' },
    h('span', { class: 'thermo-icon' }, frac > 0.5 ? '🔥' : '❄️'),
    h('div', { class: 'thermo-track' },
      h('div', { class: 'thermo-fill', style: `width:${Math.round(frac * 100)}%;background:hsl(${hue},80%,55%)` })),
    h('span', { class: 'thermo-value' }, `T = ${fmt1(T)}`));
}

function tabuChips(run) {
  const isTsp = run.problem.type === 'tsp';
  // TSP entries are the two edges cut by a move; show them as "lines that may not be reconnected".
  const label = (e) => (isTsp ? `✂ ${e.keys.map((k) => k.replace('-', '–')).join('、')}` : e.label);
  const chips = run.state.tabu.map((e) => h('span', { class: 'chip' }, label(e)));
  const title = isTsp ? `🦊 不准接回的線（剛拆掉的，${run.params.tenure} 步內不能再接上；左邊最舊）`
    : `🦊 禁忌表（${run.state.tabu.length}/${run.params.tenure}，左邊最舊）`;
  return h('div', { class: 'tabu' },
    h('span', { class: 'tabu-title' }, title),
    h('div', { class: 'chips' }, chips.length ? chips : h('span', { class: 'muted' }, '目前是空的')));
}

/** Spec 4.6 */
function createStatusCard() {
  const el = h('section', { class: 'panel status' });
  return {
    el,
    update(run, isPlaying) {
      const s = run.state;
      const reason = s.stopped === 'local' && foundGlobal(run) ? '到達最佳解，沒有更好的鄰居' : STOP_REASONS[s.stopped];
      const status = s.stopped ? `已停止（${reason}）`
        : isPlaying ? '執行中' : s.step === 0 ? '準備好了' : '已暫停';
      const vn = run.ops.valueName;
      el.replaceChildren(
        h('h3', { class: 'panel-title' }, '狀態'),
        h('dl', { class: 'stats' },
          h('dt', null, '步數'), h('dd', null, `${s.step} / ${run.params.maxSteps}`),
          h('dt', null, `目前${vn}`), h('dd', null, fmt1(s.current.display)),
          h('dt', null, '歷史最佳'), h('dd', null, `${fmt1(s.best.display)}（第 ${s.bestStep} 步）`),
          h('dt', null, '狀態'), h('dd', { class: s.stopped ? 'stopped' : '' }, status)),
        ...(run.algo === 'sa' ? [thermometer(run)] : []),
        ...(run.algo === 'ts' ? [tabuChips(run)] : []));
    },
  };
}

/** F-30 / F-31 */
function createAgentCards({ selected, onSelect }) {
  const cards = ALGO_KEYS.map((key) => {
    const meta = ALGOS[key];
    const info = h('div', { class: 'agent-info', hidden: true },
      h('div', { html: DEMO_SVGS[key] }), h('p', { class: 'analogy' }, `💡 ${meta.analogy}`));
    const help = h('button', {
      type: 'button', class: 'help-btn', 'aria-expanded': 'false',
      onClick: (e) => {
        e.stopPropagation();
        info.hidden = !info.hidden;
        help.setAttribute('aria-expanded', String(!info.hidden));
      },
    }, '(?) 這是什麼');
    const card = h('div', {
      class: 'agent-card', role: 'button', tabindex: '0', 'data-algo': key, style: `--agent:${meta.color}`,
      onClick: () => onSelect(key),
      onKeydown: (e) => { if (e.key === 'Enter') onSelect(key); },
    }, agentImg(key, 48), h('div', { class: 'agent-text' },
      h('strong', null, `${meta.animal}・${meta.name}`), h('span', { class: 'muted' }, meta.tagline), help), info);
    return card;
  });
  const api = {
    el: h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '選一位登山隊員'), h('div', { class: 'agent-cards' }, cards)),
    set(algo) { cards.forEach((c) => c.classList.toggle('selected', c.dataset.algo === algo)); },
  };
  api.set(selected);
  return api;
}
