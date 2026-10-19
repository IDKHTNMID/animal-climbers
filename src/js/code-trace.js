// ---------- Pseudocode execution trace (spec v1.2, item 2) ----------
// For one step record, lists the pseudocode lines actually executed, in order, with the values at that moment.

function compareText(type, a, b) {
  return type === 'tsp' ? `長度 ${fmt1(a)} < ${fmt1(b)}` : `${fmt1(a)} > ${fmt1(b)}`;
}

function chosenDisplayOf(record) {
  const hit = record.candidates.find((c) => c.move === record.chosen);
  return hit ? hit.display : record.to.display;
}

function bestCandidateDisplay(type, record) {
  const values = record.candidates.map((c) => c.display);
  return type === 'tsp' ? Math.min(...values) : Math.max(...values);
}

function traceHill(run, record) {
  const { problem, ops } = run;
  const type = problem.type;
  const best = record.chosen === null ? bestCandidateDisplay(type, record) : chosenDisplayOf(record);
  const label = record.chosen === null ? '' : ops.moveLabel(problem, record.from.pos, record.chosen);
  const steps = [
    { line: 3, note: `找到 ${record.candidates.length} ${type === 'tsp' ? '種改法' : '個鄰居'}` },
    { line: 4, note: `${label || '最好的鄰居'}：${ops.valueName} ${fmt1(best)}` },
  ];
  if (record.event === 'move') {
    return [...steps,
      { line: 5, note: `${compareText(type, best, record.from.display)} ✓` },
      { line: 6, note: `走到 ${label}` }];
  }
  return [...steps,
    { line: 5, note: `${compareText(type, best, record.from.display)} ✗` },
    { line: 7, note: '條件不成立，進入 else' },
    { line: 8, note: ops.isGlobal(problem, record.best.display) ? '停止（這裡剛好就是全域最佳）' : '停止：卡在局部最佳' }];
}

function traceAnneal(run, record) {
  const { problem, ops, params } = run;
  const T = record.temperature;
  const label = ops.moveLabel(problem, record.from.pos, record.chosen);
  const steps = [
    { line: 2, note: `T=${fmt1(T)} > ${params.tMin} ✓，第 ${record.step} 步` },
    { line: 3, note: `隨機挑到 ${label}` },
    { line: 4, note: `Δ = ${fmt1(record.delta)}` },
  ];
  const cool = { line: 8, note: `T = ${fmt1(T)} × ${params.alpha} = ${fmt1(T * params.alpha)}` };
  if (record.event === 'better') return [...steps, { line: 5, note: 'Δ > 0 ✓ 接受' }, cool];
  const [r, p] = fmtProbPair(record.rand, record.prob);
  const decide = { line: 5, note: 'Δ > 0 ✗' };
  if (record.accepted) return [...steps, decide, { line: 6, note: `rand=${r} < e^(Δ/T)=${p} ✓ 接受` }, cool];
  return [...steps, decide, { line: 6, note: `rand=${r} < e^(Δ/T)=${p} ✗` }, { line: 7, note: '拒絕，留在原地' }, cool];
}

function traceTabu(run, record) {
  const { problem, ops, params } = run;
  const k = record.candidates.length;
  const allowed = record.candidates.filter((c) => !c.tabu).length;
  const steps = [
    { line: 2, note: `已走 ${record.step - 1} 步 < ${params.maxSteps} ✓` },
    { line: 3, note: `${k} 個鄰居` },
    { line: 4, note: `${allowed} 個非禁忌${record.aspiration ? '＋1 個特赦' : ''}` },
  ];
  if (record.event === 'stop') return [...steps, { line: 5, note: 'allowed 是空的 → 停止' }];
  const label = ops.moveLabel(problem, record.from.pos, record.chosen);
  const value = chosenDisplayOf(record);
  // One entry is added per step, so once the step count passes L the oldest entry is dropped.
  const trimmed = record.step > params.tenure;
  return [...steps,
    { line: 6, note: `${label}：${ops.valueName} ${fmt1(value)}` },
    { line: 7, note: `走過去，記入禁忌表` },
    { line: 8, note: trimmed ? `超過 L=${params.tenure}，移除最舊的一筆` : `禁忌表 ${record.tabu.length}/${params.tenure}` },
    { line: 9, note: record.isNewBest ? `${fmt1(value)} 打破紀錄 ✓` : `沒有打破紀錄 ${fmt1(record.prevBest.display)}` }];
}

const TRACE_FNS = Object.freeze({ hc: traceHill, sa: traceAnneal, ts: traceTabu });

/** [{ line, note }] in execution order. The decisive lines are record.lines (highlighted strongest). */
function codeTrace(run, record) {
  return TRACE_FNS[run.algo](run, record);
}
