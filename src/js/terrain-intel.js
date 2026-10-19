// ---------- Terrain intel card for the predict challenge (spec v1.2, item 6) ----------

function countPeaks(problem) {
  const v = problem.values;
  if (problem.type === '1d') {
    let n = 0;
    for (let x = 0; x < SIZE_1D; x++) {
      if ((x === 0 || v[x] > v[x - 1]) && (x === SIZE_1D - 1 || v[x] > v[x + 1])) n++;
    }
    return n;
  }
  let n = 0;
  for (let i = 0; i < v.length; i++) {
    const pt = point2d(i % SIZE_2D, Math.floor(i / SIZE_2D));
    if (OPS_2D.neighbors(problem, pt, 1).every((c) => c.score < v[i])) n++;
  }
  return n;
}

/** Lowest height on the straight line between two positions (the valley to cross). */
function valleyBetween(problem, from, to) {
  const samples = 60;
  let low = Infinity;
  for (let k = 0; k <= samples; k++) {
    const t = k / samples;
    if (problem.type === '1d') {
      low = Math.min(low, problem.values[Math.round(from + (to - from) * t)]);
    } else {
      const pt = point2d(Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t));
      low = Math.min(low, OPS_2D.display(problem, pt));
    }
  }
  return low;
}

function terrainIntel(problem, start) {
  const ops = OPS[problem.type];
  const climb = runToEnd(createRun({ algo: 'hc', problem, params: DEFAULT_PARAMS, start, seed: 1 }));
  const peak = climb.state.best;
  const globalPos = problem.global.state;
  const climbsToGlobal = foundGlobal(climb);
  const distance = problem.type === '1d' ? Math.abs(globalPos - start)
    : Math.hypot(globalPos.x - start.x, globalPos.y - start.y);
  const valley = climbsToGlobal ? 0 : peak.display - valleyBetween(problem, peak.pos, globalPos);
  return {
    type: problem.type,
    peaks: countPeaks(problem),
    startValue: ops.display(problem, start),
    climbValue: peak.display,
    climbSteps: climb.state.bestStep,
    climbsToGlobal,
    distance,
    valley: Math.max(0, valley),
  };
}

function tspIntel(problem, start) {
  const climb = runToEnd(createRun({ algo: 'hc', problem, params: DEFAULT_PARAMS, start, seed: 1 }));
  const length = tourLength(problem, start);
  return {
    type: 'tsp',
    cities: problem.n,
    moves: OPS_TSP.neighbors(problem, start).length,
    startLength: length,
    ratio: length / problem.ref.length,
    crossings: tourCrossings(problem, start).length,
    climbValue: climb.state.best.display,
    climbGap: climb.state.best.display / problem.ref.length - 1,
    climbsToGlobal: foundGlobal(climb),
  };
}

function analyzeQuestion(problem, start) {
  return problem.type === 'tsp' ? tspIntel(problem, start) : terrainIntel(problem, start);
}
