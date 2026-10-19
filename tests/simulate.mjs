// Success-rate simulation used to tune preset maps and challenge levels.
// Usage: node tests/simulate.mjs
import { loadCore } from './load-core.mjs';

const core = loadCore();
const P = core.DEFAULT_PARAMS;
const TRIALS = 40;

function rate(problem, algo, params, useDefaultStart) {
  let wins = 0;
  for (let t = 1; t <= TRIALS; t++) {
    const start = useDefaultStart ? problem.start : core.randomStartFor(problem, t, 0);
    const run = core.runToEnd(core.createRun({ algo, problem, params: { ...P, ...params }, start, seed: t }));
    if (core.foundGlobal(run)) wins++;
  }
  return `${Math.round((wins / TRIALS) * 100)}%`.padStart(5);
}

const maps = [['1d', '1d-twin'], ['1d', '1d-saw'], ['2d', '2d-single'], ['2d', '2d-twin'], ['2d', '2d-islands'],
  ['tsp', 'tsp-intro'], ['tsp', 'tsp-circle'], ['tsp', 'tsp-random12'], ['tsp', 'tsp-cluster']];

console.log('map              | default start: hc   sa   ts | random start: hc   sa   ts');
for (const [type, id] of maps) {
  const p = core.buildProblem({ type, mapId: id, seed: 1, count: 8 });
  const d = ['hc', 'sa', 'ts'].map((a) => rate(p, a, {}, true)).join('');
  const r = ['hc', 'sa', 'ts'].map((a) => rate(p, a, {}, false)).join('');
  console.log(`${id.padEnd(16)} | ${d}        | ${r}`);
}

const extra = process.argv[2] ? JSON.parse(process.argv[2]) : null;
if (extra) {
  const p = core.buildProblem({ type: extra.type, mapId: extra.map, seed: 1, count: 8 });
  console.log('custom', JSON.stringify(extra), rate(p, extra.algo, extra.params, false));
}
