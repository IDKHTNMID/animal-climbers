// ---------- Step explanation panels (spec v1.2, items 1 - 3) ----------
const MAX_HISTORY = 30;
const MAG_RINGS = 2;

/** "This step" card right under the canvas, with the optional pseudocode execution trace. */
function createStepCard() {
  const title = h('h3', { class: 'panel-title' });
  const how = h('p', { class: 'how-line' });
  const body = h('div', { class: 'step-body', 'aria-live': 'polite' });
  const stuck = h('div', { class: 'stuck', hidden: true });
  const code = h('ol', { class: 'pseudo', hidden: true });
  const toggle = h('input', { type: 'checkbox' });
  toggle.addEventListener('change', () => { code.hidden = !toggle.checked; });
  let algo = null;
  let type = '2d';

  function renderCode(trace, decisive) {
    const order = new Map(trace.map((t, i) => [t.line, i]));
    code.replaceChildren(...pseudocodeFor(algo, type).map((text, idx) => {
      const line = idx + 1;
      const hit = trace.find((t) => t.line === line);
      const cls = [hit ? 'ran' : '', decisive.includes(line) ? 'hl' : ''].join(' ').trim();
      return h('li', { class: cls, style: hit ? `--d:${order.get(line)}` : null },
        h('code', null, text), hit ? h('span', { class: 'trace-note' }, hit.note) : null);
    }));
  }

  return {
    el: h('section', { class: 'panel step-card' },
      h('div', { class: 'panel-head' }, title, h('label', { class: 'toggle' }, toggle, ' 顯示程式執行過程')),
      how, stuck, body, code),
    setAlgo(next, problem) {
      algo = next;
      type = problem.type;
      how.textContent = algoHowText(algo, problem);
      renderCode([], []);
    },
    reset(intro) {
      title.textContent = '準備開始';
      body.innerHTML = intro;
      stuck.hidden = true;
      renderCode([], []);
    },
    show(run, record) {
      title.textContent = `第 ${record.step} 步`;
      body.innerHTML = narrate(run, record).join('<br>');
      renderCode(codeTrace(run, record), record.lines);
    },
    showStuck(onSwitch) {
      stuck.replaceChildren(
        h('p', null, '🐐 山羊卡住了！這裡是局部最高點，但不是全域最高。試試看小龍或狐狸？'),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn-small', onClick: () => onSwitch('sa') }, agentImg('sa', 20), ' 換小龍'),
          h('button', { type: 'button', class: 'btn btn-small', onClick: () => onSwitch('ts') }, agentImg('ts', 20), ' 換狐狸')));
      stuck.hidden = false;
    },
  };
}

/** Older narration entries, newest first. */
function createHistoryPanel() {
  const list = h('ol', { class: 'narration-list' });
  return {
    el: h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '歷史紀錄'), list),
    clear() { list.replaceChildren(h('li', { class: 'intro' }, '每一步的說明會留在這裡。')); },
    add(step, lines) {
      if (list.firstElementChild && list.firstElementChild.classList.contains('intro')) list.replaceChildren();
      list.prepend(h('li', null, h('span', { class: 'step-tag' }, `#${step}`), h('div', { html: lines.join('<br>') })));
      while (list.children.length > MAX_HISTORY) list.lastElementChild.remove();
    },
  };
}

function magnifierCell(run, record, center, dx, dy, step) {
  const pos = point2d(center.x + dx * step, center.y + dy * step);
  const inside = pos.x >= 0 && pos.y >= 0 && pos.x < SIZE_2D && pos.y < SIZE_2D;
  if (!inside) return h('div', { class: 'mag-cell out' }, '邊界');
  const value = run.ops.display(run.problem, pos);
  const style = `background:${terrainCss(value)};color:${terrainInk(value)}`;
  if (dx === 0 && dy === 0) {
    return h('div', { class: 'mag-cell center', style }, agentImg(run.algo, 26), h('span', null, fmt1(value)));
  }
  const isInner = Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  const cand = record && isInner ? record.candidates.find((c) => c.move.x === pos.x && c.move.y === pos.y) : null;
  const chosen = cand && record.chosen === cand.move && record.accepted;
  const cls = ['mag-cell',
    isInner ? 'inner' : 'outer',
    cand ? (cand.tabu ? 'tabu' : cand.better ? 'better' : 'worse') : (record && isInner ? 'unchecked' : ''),
    chosen ? 'chosen' : ''].join(' ');
  const tag = !cand ? null : cand.tabu ? h('i', { class: 'mag-tag tabu' }, '✕')
    : h('i', { class: `mag-tag ${cand.better ? 'up' : 'down'}` }, cand.better ? '▲' : '▼');
  return h('div', { class: cls, style }, tag, h('span', null, fmt1(value)), chosen ? h('i', { class: 'mag-pick' }, '選中') : null);
}

/** 2D zoom panel centred on where this step's decision was made. */
function createMagnifier() {
  const title = h('h3', { class: 'panel-title' });
  const grid = h('div', { class: 'mag-grid' });
  const note = h('p', { class: 'mag-note' });
  const el = h('section', { class: 'panel magnifier' }, title, grid, note,
    h('p', { class: 'mag-legend' }, h('span', { class: 'lg better' }, '比現在高'), h('span', { class: 'lg worse' }, '比現在低'),
      h('span', { class: 'lg chosen' }, '選中'), h('span', { class: 'lg tabu' }, '禁忌')));
  return {
    el,
    update(run, record) {
      el.hidden = run.problem.type !== '2d';
      if (el.hidden) return;
      const step = stepSizeFor('2d', run.params);
      const center = record ? record.from.pos : run.state.current.pos;
      const cells = [];
      for (let dy = -MAG_RINGS; dy <= MAG_RINGS; dy++) {
        for (let dx = -MAG_RINGS; dx <= MAG_RINGS; dx++) cells.push(magnifierCell(run, record, center, dx, dy, step));
      }
      grid.replaceChildren(...cells);
      title.textContent = record ? `🔍 第 ${record.step} 步的決策` : '🔍 放大鏡';
      const who = ALGOS[run.algo].animal;
      const how = run.algo === 'sa' ? `${who}這一步只隨機檢查 1 個鄰居（淡色＝沒檢查）。` : `${who}檢查了周圍 8 個鄰居。`;
      note.textContent = `以${who}${record ? '出發點' : '目前位置'}為中心，每格相隔 ${step}。${record ? how : ''}`;
    },
  };
}
