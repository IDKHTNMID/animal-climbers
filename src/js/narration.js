// ---------- Narration templates (spec 8.5) and pseudocode (spec 8.2 - 8.6, TSP wording in spec v1.3) ----------
const PSEUDOCODE_TERRAIN = Object.freeze({
  hc: [
    'current ← 起點',
    'loop:',
    '    neighbors ← 所有鄰居(current)',
    '    best_n ← neighbors 中最高者',
    '    if 高度(best_n) > 高度(current):',
    '        current ← best_n',
    '    else:',
    '        停止：卡在局部最佳',
  ],
  sa: [
    'current ← 起點；T ← T₀',
    'while T > T_min 且 步數 < 最大步數:',
    '    next ← 隨機鄰居(current)',
    '    Δ ← 高度(next) − 高度(current)',
    '    if Δ > 0: current ← next',
    '    else if rand() < e^(Δ/T): current ← next',
    '    else: 留在原地',
    '    T ← T × α',
  ],
  ts: [
    'current ← 起點；best ← current；tabu ← 空佇列',
    'while 步數 < 最大步數:',
    '    candidates ← 所有鄰居(current)',
    '    allowed ← 非禁忌 ∪ 能打破 best 的（特赦）',
    '    if allowed 為空: 停止',
    '    next ← allowed 中最高者',
    '    current ← next；把剛離開的位置記入 tabu',
    '    if tabu 筆數 > L: 移除最舊的一筆',
    '    if 高度(current) > 高度(best): best ← current',
  ],
});

/** Same line numbers as the terrain version, so traces and highlights work for both. */
const PSEUDOCODE_TSP = Object.freeze({
  hc: [
    'current ← 起始路線',
    'loop:',
    '    neighbors ← 所有 2-opt 改法(current)',
    '    best_n ← neighbors 中長度最短者',
    '    if 長度(best_n) < 長度(current):',
    '        current ← best_n',
    '    else:',
    '        停止：卡在局部最佳',
  ],
  sa: [
    'current ← 起始路線；T ← T₀',
    'while T > T_min 且 步數 < 最大步數:',
    '    next ← 隨機一種 2-opt 改法(current)',
    '    Δ ← 長度(current) − 長度(next)  （變短為正）',
    '    if Δ > 0: current ← next',
    '    else if rand() < e^(Δ/T): current ← next',
    '    else: 留在原地',
    '    T ← T × α',
  ],
  ts: [
    'current ← 起始路線；best ← current；tabu ← 空佇列',
    'while 步數 < 最大步數:',
    '    candidates ← 所有 2-opt 改法(current)',
    '    allowed ← 不會接回禁忌線的 ∪ 能打破 best 的（特赦）',
    '    if allowed 為空: 停止',
    '    next ← allowed 中長度最短者',
    '    current ← next；把拆掉的 2 條線記入 tabu',
    '    if tabu 筆數 > L: 移除最舊的一筆',
    '    if 長度(current) < 長度(best): best ← current',
  ],
});

/** Kept for the v1.0 tests: terrain pseudocode keyed by algorithm. */
const PSEUDOCODE = PSEUDOCODE_TERRAIN;

function pseudocodeFor(algo, type) {
  return (type === 'tsp' ? PSEUDOCODE_TSP : PSEUDOCODE_TERRAIN)[algo];
}

const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

/** Two decimals, or three when two would make r and p look equal. */
function fmtProbPair(r, p) {
  const r2 = r.toFixed(2);
  const p2 = p.toFixed(2);
  return r2 === p2 ? [r.toFixed(3), p.toFixed(3)] : [r2, p2];
}

/** Change wording: heights go up/down, TSP lengths get shorter/longer. */
function changeText(type, delta) {
  const amount = fmt1(Math.abs(delta));
  if (type === 'tsp') return delta > 0 ? `縮短 ${amount}` : `變長 ${amount}`;
  return delta > 0 ? `高了 ${amount}` : `低了 ${amount}`;
}

/** Number of neighbours each step can look at: 2 in 1D, 8 in 2D, n(n-3)/2 two-opt moves in TSP. */
function neighbourCount(problem) {
  if (problem.type === '1d') return 2;
  if (problem.type === '2d') return 8;
  return (problem.n * (problem.n - 3)) / 2;
}

/** One-line "how this animal works on this problem" shown on the step card (spec v1.3, A). */
function algoHowText(algo, problem) {
  const k = neighbourCount(problem);
  if (problem.type === 'tsp') {
    return {
      hc: `🐐 山羊在 TSP：試遍全部 ${k} 種改法，挑長度最短的那條路線；沒有任何一種能變短就停。`,
      sa: '🐲 小龍在 TSP：每步只隨機抽 1 種改法；變短就接受，變長就看溫度擲骰子決定。',
      ts: `🦊 狐狸在 TSP：試遍全部 ${k} 種改法，挑「不會把剛拆掉的線接回去」裡最短的，就算變長也照走。`,
    }[algo];
  }
  const where = problem.type === '1d' ? '左右 2 個鄰居' : '周圍 8 個鄰居';
  return {
    hc: `🐐 山羊：看${where}，走到最高的那一個；沒有比現在高的就停。`,
    sa: `🐲 小龍：每步從${where}裡隨機挑 1 個；變高就走，變低就看溫度擲骰子決定。`,
    ts: `🦊 狐狸：看${where}，走到不在禁忌表裡最高的那一個，就算變低也照走。`,
  }[algo];
}

function narrationContext(run, record) {
  const { problem, ops } = run;
  const type = problem.type;
  const isTsp = type === 'tsp';
  const chosenDisplay = record.chosen === null ? null
    : record.candidates.find((c) => c.move === record.chosen)?.display ?? record.to.display;
  return {
    type,
    vn: ops.valueName,
    pos: record.chosen === null ? '' : ops.moveLabel(problem, record.from.pos, record.chosen),
    k: record.candidates.length,
    unit: isTsp ? '種改法' : '個鄰居',
    tryVerb: isTsp ? '隨機抽到改法' : '試走到',
    go: isTsp ? '就這樣改' : '往那裡走',
    v0: fmt1(record.from.display),
    v1: fmt1(chosenDisplay ?? record.to.display),
    change: changeText(type, record.delta),
    atGlobal: ops.isGlobal(problem, record.best.display),
    localWord: isTsp ? '局部最佳' : '局部最高點',
    globalWord: isTsp ? '全域最佳（最短的路線）' : '全域最高點',
  };
}

function narrateHill(c, record) {
  if (record.event === 'move') {
    return `山羊試了 ${c.k} ${c.unit}，最好的是 <b>${c.pos}</b>（${c.vn} ${c.v1}），比現在${c.change}，${c.go}！`;
  }
  const bestDisplay = record.candidates.length
    ? fmt1(record.candidates.reduce((b, x) => (c.type === 'tsp' ? Math.min(b, x.display) : Math.max(b, x.display)),
      record.candidates[0].display))
    : c.v0;
  const verdict = c.atGlobal ? `這裡剛好就是<b>${c.globalWord}</b>！` : `這是<b>${c.localWord}</b>，但不是最好的答案。`;
  return `${c.k} ${c.unit}都沒有比現在好（最好只有 ${bestDisplay}），山羊停在這裡了。${verdict}`;
}

function narrateAnneal(c, record) {
  const T = fmt1(record.temperature);
  if (record.event === 'better') {
    return `小龍${c.tryVerb} <b>${c.pos}</b>，${c.vn}從 ${c.v0} 變成 ${c.v1}（${c.change}），變好了，直接接受！`;
  }
  if (record.event === 'same') {
    return `小龍${c.tryVerb} <b>${c.pos}</b>，${c.vn}沒有變。e^(0/${T}) = 1，一定接受。`;
  }
  const [r, p] = fmtProbPair(record.rand, record.prob);
  const formula = `溫度 T=${T}，接受機率 e^(${fmt1(record.delta)}/${T}) = <b>${p}</b>`;
  if (record.event === 'worse_accept') {
    return `小龍${c.tryVerb} <b>${c.pos}</b>，${c.vn}${c.change}。${formula}；擲骰子得到 ${r} &lt; ${p}，<b>接受！</b>現在還熱，願意冒險。`;
  }
  return `小龍${c.tryVerb} <b>${c.pos}</b>，${c.vn}${c.change}。${formula}；擲骰子得到 ${r} ≥ ${p}，<b>拒絕</b>，留在原地。`;
}

function narrateTabu(c, record, best) {
  const m = record.tabuCount;
  const banned = c.type === 'tsp' ? '會把禁忌的線接回去' : '在禁忌表裡不能去';
  if (record.event === 'stop') return `所有${c.unit}都是禁忌，而且沒有一個能打破歷史最佳，狐狸無路可走。`;
  if (record.event === 'aspiration') {
    return `<b>${c.pos}</b> 雖然${banned}，但它的${c.vn} ${c.v1} 打破了歷史最佳 ${fmt1(best)}，觸發<b>特赦</b>，可以走！`;
  }
  if (record.event === 'move_better') {
    return `狐狸檢查了 ${c.k} ${c.unit}，其中 ${m} 個${banned}。剩下最好的是 <b>${c.pos}</b>（${c.change}），${c.go}。`;
  }
  if (record.event === 'move_flat') {
    return `狐狸檢查了 ${c.k} ${c.unit}（${m} 個是禁忌）。剩下最好的是 <b>${c.pos}</b>，${c.vn}跟現在一樣，照樣${c.go}。`;
  }
  return `狐狸檢查了 ${c.k} ${c.unit}（${m} 個是禁忌）。剩下最好的是 <b>${c.pos}</b>，雖然${c.change}，狐狸還是會走，這樣才不會原地打轉。`;
}

/** Returns narration HTML lines for a record (main line, optional new-record line, optional stop line). */
function narrate(run, record) {
  const c = narrationContext(run, record);
  const main = run.algo === 'hc' ? narrateHill(c, record)
    : run.algo === 'sa' ? narrateAnneal(c, record)
      : narrateTabu(c, record, record.prevBest.display);
  const lines = [main];
  if (record.isNewBest) lines.push(`✨ 新的歷史最佳：${fmt1(record.best.display)}（第 ${record.step} 步）`);
  if (record.stopped === 'cold') lines.push(`溫度已經降到 ${fmt1(record.temperature * run.params.alpha)}，低於 T_min，小龍冷靜下來了。`);
  if (record.stopped === 'max') lines.push('已達最大步數，停止。');
  return lines;
}

/** Lines to highlight; the loop condition (line 2) also lights up when the loop ends there. */
function highlightLines(run, record) {
  const endsAtLoop = record.stopped === 'cold' || (record.stopped === 'max' && run.algo !== 'hc');
  return endsAtLoop ? [...record.lines, 2] : record.lines;
}

/** Direction word of a move: 左/右 in 1D, 上/右上/... in 2D, null for TSP. */
function moveDirection(type, from, to) {
  if (type === '1d') return to > from ? '右' : '左';
  if (type !== '2d') return null;
  const k = DIRS_2D.findIndex(([dx, dy]) => dx === Math.sign(to.x - from.x) && dy === Math.sign(to.y - from.y));
  return k >= 0 ? DIR_NAMES[k] : null;
}

function shortChange(type, delta) {
  const amount = fmt1(Math.abs(delta));
  if (type === 'tsp') return delta > 0 ? `縮短 ${amount}` : `變長 ${amount}`;
  return delta > 0 ? `+${amount}` : `−${amount}`;
}

const SHORT_STOP = Object.freeze({ local: '沒有更好的鄰居…', cold: '冷靜下來了', tabu: '無路可走…', max: '步數用完了' });

/** Speech-bubble text drawn above the animal (spec v1.2, item 1). */
function shortNarration(run, record) {
  if (record.stopped === 'local' && run.ops.isGlobal(run.problem, record.best.display)) return '到達最佳解！';
  if (record.stopped) return SHORT_STOP[record.stopped];
  const type = run.problem.type;
  const dir = record.chosen === null ? null : moveDirection(type, record.from.pos, record.chosen);
  const go = dir ? `往${dir} ` : '';
  const change = shortChange(type, record.delta);
  switch (record.event) {
    case 'move': return `${go}${change}！`;
    case 'better': return `更好！${go}${change}`;
    case 'same': return '一樣好，接受';
    case 'worse_accept': return `冒險接受！p=${record.prob.toFixed(2)}`;
    case 'reject': return `拒絕（p=${record.prob.toFixed(2)}）`;
    case 'aspiration': return '特赦！破紀錄';
    case 'move_better': return `${go}${change}`;
    case 'move_flat': return '一樣高，照走';
    case 'move_worse': return `${change}，還是要走`;
    default: return SHORT_STOP[record.stopped] || '';
  }
}
