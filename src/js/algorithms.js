// ---------- Algorithms (spec 8.2 - 8.4) and step records (spec 8.7) ----------
const ALGO_KEYS = Object.freeze(['hc', 'sa', 'ts']);

const ALGOS = Object.freeze({
  hc: Object.freeze({
    key: 'hc', name: '爬山法', animal: '山羊', icon: 'goat', color: '#3B82F6', tagline: '只往高處走',
    intro: '每一步都看看身邊所有鄰居，挑最好的走過去；如果沒有任何鄰居比現在好，就停下來。簡單又快，但很容易卡在小山頭（局部最佳）。',
    analogy: '在大霧裡登山，只看得到腳邊，永遠往最陡的上坡走。',
  }),
  sa: Object.freeze({
    key: 'sa', name: '模擬退火', animal: '小龍', icon: 'dragon', color: '#EF4444', tagline: '熱的時候敢冒險',
    intro: '每一步隨機試走一個鄰居，變好就接受；變差時不一定拒絕：掉得越少、溫度越高，就越可能接受（機率是 e^(Δ/T)，旁白會幫你算好）。溫度 T 每一步都會下降，所以一開始很愛冒險，後來越來越保守。',
    analogy: '打鐵時先把鐵燒紅，敲打時可以大幅變形，冷卻後就定型。',
  }),
  ts: Object.freeze({
    key: 'ts', name: '禁忌搜尋', animal: '狐狸', icon: 'fox', color: '#8B5CF6', tagline: '記得走過的路',
    intro: '每一步走到「不在禁忌表裡」的最好鄰居，就算比現在差也照走。禁忌表記住最近走過的地方，避免繞回去；但如果某個禁忌的移動能打破歷史最佳，就特赦它。',
    analogy: '在迷宮裡帶著筆記本，記下最近走過的岔路，避免一直繞圈。',
  }),
});

const DEFAULT_PARAMS = Object.freeze({
  step1d: 4, step2d: 2, maxSteps: 300, t0: 20, alpha: 0.99, tMin: 0.1, tenure: 10,
});

const PARAM_DEFS = Object.freeze([
  { key: 'step1d', label: '步長 s', min: 1, max: 10, step: 1, digits: 0, algos: ALGO_KEYS, types: ['1d'] },
  { key: 'step2d', label: '步長 s', min: 1, max: 5, step: 1, digits: 0, algos: ALGO_KEYS, types: ['2d'] },
  { key: 'maxSteps', label: '最大步數', min: 50, max: 1000, step: 10, digits: 0, algos: ALGO_KEYS, types: ['1d', '2d', 'tsp'] },
  { key: 't0', label: '起始溫度 T₀', min: 1, max: 500, step: 1, digits: 0, algos: ['sa'], types: ['1d', '2d', 'tsp'] },
  { key: 'alpha', label: '冷卻率 α', min: 0.8, max: 0.999, step: 0.001, digits: 3, algos: ['sa'], types: ['1d', '2d', 'tsp'] },
  { key: 'tMin', label: '最低溫度 T_min', min: 0.01, max: 10, step: 0.01, digits: 2, algos: ['sa'], types: ['1d', '2d', 'tsp'] },
  { key: 'tenure', label: '禁忌表長度 L', min: 1, max: 50, step: 1, digits: 0, algos: ['ts'], types: ['1d', '2d', 'tsp'] },
]);

/** Float tolerance: 2-opt scores come from an incremental formula, tours are re-summed. */
const SCORE_EPS = 1e-9;

const STOP_REASONS = Object.freeze({
  local: '卡在局部最佳',
  cold: '溫度已低於 T_min',
  max: '已達最大步數',
  tabu: '所有鄰居都被禁忌',
});

function stepSizeFor(type, params) {
  if (type === '1d') return params.step1d;
  if (type === '2d') return params.step2d;
  return 1;
}

function makePoint(ops, problem, pos) {
  return Object.freeze({ pos, score: ops.score(problem, pos), display: ops.display(problem, pos) });
}

function createRun({ algo, problem, params, start, seed }) {
  const ops = OPS[problem.type];
  const point = makePoint(ops, problem, start);
  const coldAtStart = algo === 'sa' && params.t0 <= params.tMin;
  return Object.freeze({
    algo, problem, params, seed, ops,
    rng: mulberry32(seed),
    state: Object.freeze({
      current: point, best: point, bestStep: 0, step: 0, T: params.t0,
      tabu: Object.freeze([]), stopped: coldAtStart ? 'cold' : null, worseAccepts: 0,
    }),
    records: Object.freeze([]),
  });
}

function describeCandidates(run, candidates, tabuFlags) {
  const { ops, state } = run;
  return Object.freeze(candidates.map((c, k) => Object.freeze({
    move: c.move,
    display: ops.displayOfScore(c.score),
    better: c.score > state.current.score + SCORE_EPS,
    tabu: tabuFlags ? tabuFlags[k] : false,
  })));
}

function pickBest(candidates) {
  return candidates.reduce((best, c) => (c.score > best.score ? c : best), candidates[0]);
}

function moveTo(run, candidate) {
  const { ops, problem, state } = run;
  return makePoint(ops, problem, ops.apply(problem, state.current.pos, candidate.move));
}

function stepHillClimb(run) {
  const { ops, problem, params, state } = run;
  const candidates = ops.neighbors(problem, state.current.pos, stepSizeFor(problem.type, params));
  const best = pickBest(candidates);
  const base = { candidates: describeCandidates(run, candidates), chosen: best.move, delta: best.score - state.current.score };
  if (best.score > state.current.score + SCORE_EPS) {
    return { ...base, to: moveTo(run, best), accepted: true, event: 'move', lines: [6] };
  }
  return { ...base, to: null, accepted: false, event: 'stop', lines: [8], stopped: 'local' };
}

function stepAnneal(run) {
  const { ops, problem, params, state, rng } = run;
  const T = state.T;
  const cand = ops.randomNeighbor(problem, state.current.pos, stepSizeFor(problem.type, params), rng);
  const rawDelta = cand.score - state.current.score;
  const delta = Math.abs(rawDelta) <= SCORE_EPS ? 0 : rawDelta;
  const base = { candidates: describeCandidates(run, [cand]), chosen: cand.move, delta, temperature: T };
  const nextT = T * params.alpha;
  const cooled = nextT <= params.tMin ? { stopped: 'cold' } : {};
  if (delta > 0) {
    return { ...base, ...cooled, T: nextT, to: moveTo(run, cand), accepted: true, event: 'better', lines: [5] };
  }
  const prob = Math.exp(delta / T);
  const rand = rng();
  const accepted = rand < prob;
  const event = accepted ? (delta === 0 ? 'same' : 'worse_accept') : 'reject';
  return {
    ...base, ...cooled, T: nextT, prob, rand, accepted, event,
    to: accepted ? moveTo(run, cand) : null, lines: [accepted ? 6 : 7],
  };
}

function stepTabu(run) {
  const { ops, problem, params, state } = run;
  const candidates = ops.neighbors(problem, state.current.pos, stepSizeFor(problem.type, params));
  const tabuFlags = candidates.map((c) => ops.isTabu(problem, c.move, state.tabu));
  const allowed = candidates.filter((c, k) => !tabuFlags[k] || c.score > state.best.score + SCORE_EPS);
  const base = { candidates: describeCandidates(run, candidates, tabuFlags), tabuCount: tabuFlags.filter(Boolean).length };
  if (allowed.length === 0) {
    return { ...base, to: null, accepted: false, event: 'stop', lines: [5], stopped: 'tabu', delta: 0 };
  }
  const next = pickBest(allowed);
  const aspiration = tabuFlags[candidates.indexOf(next)];
  const entry = ops.tabuEntry(problem, state.current.pos, next.move);
  const tabu = Object.freeze([...state.tabu, entry].slice(-params.tenure));
  const rawDelta = next.score - state.current.score;
  const delta = Math.abs(rawDelta) <= SCORE_EPS ? 0 : rawDelta;
  const event = aspiration ? 'aspiration' : delta > 0 ? 'move_better' : delta === 0 ? 'move_flat' : 'move_worse';
  return {
    ...base, chosen: next.move, delta, tabu, aspiration, event,
    to: moveTo(run, next), accepted: true, lines: aspiration ? [4, 7] : [7],
  };
}

const STEP_FNS = Object.freeze({ hc: stepHillClimb, sa: stepAnneal, ts: stepTabu });

/** Returns a new run advanced by one step (or the same run when already stopped). */
function stepRun(run) {
  const { state } = run;
  if (state.stopped) return run;
  const out = STEP_FNS[run.algo](run);
  const step = state.step + 1;
  const current = out.to || state.current;
  const isNewBest = current.score > state.best.score + SCORE_EPS;
  const best = isNewBest ? current : state.best;
  const bestStep = isNewBest ? step : state.bestStep;
  const stopped = out.stopped || (step >= run.params.maxSteps ? 'max' : null);
  const record = Object.freeze({
    step, from: state.current, to: current,
    candidates: out.candidates, chosen: out.chosen ?? null,
    delta: out.delta ?? 0, prob: out.prob ?? null, rand: out.rand ?? null,
    accepted: out.accepted, event: out.event, lines: out.lines,
    temperature: out.temperature ?? null, tabu: out.tabu || state.tabu,
    tabuCount: out.tabuCount ?? 0, aspiration: Boolean(out.aspiration),
    prevBest: state.best, best, bestStep, isNewBest, stopped,
  });
  const nextState = Object.freeze({
    current, best, bestStep, step, stopped,
    T: out.T ?? state.T,
    tabu: out.tabu || state.tabu,
    worseAccepts: state.worseAccepts + (out.event === 'worse_accept' ? 1 : 0),
  });
  return Object.freeze({ ...run, state: nextState, records: Object.freeze([...run.records, record]) });
}

function runToEnd(run) {
  let current = run;
  while (!current.state.stopped) current = stepRun(current);
  return current;
}

function lastRecord(run) {
  return run.records.length ? run.records[run.records.length - 1] : null;
}

function foundGlobal(run) {
  return run.ops.isGlobal(run.problem, run.state.best.display);
}
