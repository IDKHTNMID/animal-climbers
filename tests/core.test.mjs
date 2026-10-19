import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load-core.mjs';

const core = loadCore();
const P = core.DEFAULT_PARAMS;
const presetProblem = (type, mapId, seed = 1) => core.buildProblem({ type, mapId, seed, count: 8 });
const run = (algo, problem, params = {}, seed = 1, start = problem.start) =>
  core.createRun({ algo, problem, params: { ...P, ...params }, start, seed });

test('mulberry32 is deterministic for the same seed', () => {
  const a = core.mulberry32(42);
  const b = core.mulberry32(42);
  const seqA = Array.from({ length: 5 }, a);
  assert.deepEqual(seqA, Array.from({ length: 5 }, b));
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
});

test('parseSeed accepts 1..99999 integers only (T-07)', () => {
  assert.equal(core.parseSeed('12345'), 12345);
  assert.equal(core.parseSeed(' 7 '), 7);
  for (const bad of ['abc', '0', '100000', '1.5', '-3', '']) assert.equal(core.parseSeed(bad), null, bad);
});

test('1D and 2D terrains are normalized to 0..100 with global at 100', () => {
  for (const [type, id] of [['1d', '1d-twin'], ['1d', '1d-saw'], ['2d', '2d-single'], ['2d', '2d-twin'], ['2d', '2d-islands']]) {
    const p = presetProblem(type, id);
    assert.equal(Math.round(Math.max(...p.values)), 100, id);
    assert.equal(Math.round(Math.min(...p.values)), 0, id);
    assert.equal(Math.round(p.global.value), 100, id);
  }
  assert.deepEqual({ ...presetProblem('2d', '2d-islands').global.state }, { x: 39, y: 40 });
});

test('random maps are reproducible from the seed (T-08)', () => {
  for (const type of ['1d', '2d', 'tsp']) {
    const a = core.buildProblem({ type, mapId: core.RANDOM_MAP_ID, seed: 4321, count: 9 });
    const b = core.buildProblem({ type, mapId: core.RANDOM_MAP_ID, seed: 4321, count: 9 });
    assert.equal(a, b, 'cached instance');
    const r1 = core.runToEnd(run('sa', a, {}, 5)).state.best.display;
    const r2 = core.runToEnd(run('sa', b, {}, 5)).state.best.display;
    assert.equal(r1, r2);
  }
});

test('2-opt score equals the recomputed tour length', () => {
  const p = presetProblem('tsp', 'tsp-random12');
  const moves = core.OPS.tsp.neighbors(p, p.start);
  // distinct 2-opt moves = n(n-3)/2 = 54, and the home city tour[0] never moves
  assert.equal(moves.length, 54);
  assert.ok(moves.every((m) => core.reverseSegment(p.start, m.move.i, m.move.j)[0] === p.start[0]));
  for (const m of moves) {
    const tour = core.reverseSegment(p.start, m.move.i, m.move.j);
    assert.ok(Math.abs(core.tourLength(p, tour) + m.score) < 1e-9);
  }
});

test('circle TSP reference equals the theoretical optimum', () => {
  const p = presetProblem('tsp', 'tsp-circle');
  const expected = 2 * 10 * 40 * Math.sin(Math.PI / 10);
  assert.ok(Math.abs(p.ref.length - expected) < 1e-6);
});

test('hill climbing gets stuck on the wide hill of 2D twin peaks (T-02)', () => {
  const result = core.runToEnd(run('hc', presetProblem('2d', '2d-twin')));
  assert.equal(result.state.stopped, 'local');
  assert.ok(!core.foundGlobal(result));
  assert.ok(result.records.slice(0, -1).every((r) => r.delta > 0), 'only strictly better moves');
});

test('simulated annealing accepts worse moves only when rand < prob (T-04)', () => {
  const result = core.runToEnd(run('sa', presetProblem('2d', '2d-twin'), { t0: 100, alpha: 0.95 }));
  const worse = result.records.filter((r) => r.event === 'worse_accept');
  const rejects = result.records.filter((r) => r.event === 'reject');
  assert.ok(worse.length > 0);
  assert.ok(worse.every((r) => r.rand < r.prob && r.delta < 0));
  assert.ok(rejects.every((r) => r.rand >= r.prob));
  assert.equal(result.state.stopped, 'cold');
  assert.ok(Math.abs(result.state.step - 135) <= 1, `stops near step 135, got ${result.state.step}`);
  const temps = result.records.map((r) => r.temperature);
  assert.ok(temps.every((t, k) => k === 0 || t < temps[k - 1]));
});

test('tabu list never exceeds L and the fox takes worse moves (T-06)', () => {
  const result = core.runToEnd(run('ts', presetProblem('1d', '1d-saw'), { tenure: 4 }));
  assert.ok(result.records.every((r) => r.tabu.length <= 4));
  assert.ok(result.records.some((r) => r.event === 'move_worse'));
  assert.ok(['max', 'tabu'].includes(result.state.stopped), result.state.stopped);
});

test('aspiration only fires for moves beating the best so far', () => {
  for (const id of ['tsp-random12', 'tsp-cluster']) {
    const result = core.runToEnd(run('ts', presetProblem('tsp', id), { tenure: 30 }));
    for (const r of result.records.filter((x) => x.aspiration)) {
      assert.ok(r.to.score > r.prevBest.score);
    }
  }
});

test('tabu search on the 10-city circle approaches 247.2 (T-16)', () => {
  const result = core.runToEnd(run('ts', presetProblem('tsp', 'tsp-circle')));
  assert.ok(result.state.best.display < 247.2 * 1.01, `best ${result.state.best.display}`);
});

test('narration contains real numbers for annealing', () => {
  const r = core.runToEnd(run('sa', presetProblem('2d', '2d-twin')));
  const runAt = { ...r };
  const rec = r.records.find((x) => x.event === 'worse_accept');
  const [line] = core.narrate(runAt, rec);
  assert.match(line, /e\^\(-\d+\.\d\/\d+\.\d\) = <b>\d\.\d{2,3}<\/b>/);
  assert.match(line, /&lt;/);
});

test('highlight lines follow spec 8.6', () => {
  const hc = core.runToEnd(run('hc', presetProblem('1d', '1d-twin')));
  assert.deepEqual([...core.highlightLines(hc, hc.records[0])], [6]);
  assert.deepEqual([...core.highlightLines(hc, hc.records.at(-1))], [8]);
});

test('code trace lists executed lines in order (v1.2 item 2)', () => {
  const hc = core.runToEnd(run('hc', presetProblem('2d', '2d-twin')));
  assert.deepEqual([...core.codeTrace(hc, hc.records[0]).map((t) => t.line)], [3, 4, 5, 6]);
  assert.deepEqual([...core.codeTrace(hc, hc.records.at(-1)).map((t) => t.line)], [3, 4, 5, 7, 8]);
  const sa = core.runToEnd(run('sa', presetProblem('2d', '2d-twin'), { t0: 100, alpha: 0.95 }));
  const reject = sa.records.find((r) => r.event === 'reject');
  assert.deepEqual([...core.codeTrace(sa, reject).map((t) => t.line)], [2, 3, 4, 5, 6, 7, 8]);
  assert.match(core.codeTrace(sa, reject)[4].note, /rand=.* < e\^\(Δ\/T\)=.* ✗/);
});

test('bubble text is short and names the direction (v1.2 item 1)', () => {
  const hc = core.runToEnd(run('hc', presetProblem('2d', '2d-twin')));
  assert.match(core.shortNarration(hc, hc.records[0]), /^往(上|右上|右|右下|下|左下|左|左上) \+\d+\.\d！$/);
  assert.equal(core.shortNarration(hc, hc.records.at(-1)), '沒有更好的鄰居…');
});

test('optimal circle tour has no crossings and 2-opt edges match the move (v1.2 item 9)', () => {
  const p = presetProblem('tsp', 'tsp-circle');
  assert.equal(core.tourCrossings(p, p.ref.tour).length, 0);
  assert.ok(core.tourCrossings(p, p.start).length > 0);
  const edges = core.twoOptEdges({ a: 1, b: 2, c: 3, d: 4 });
  assert.deepEqual(JSON.parse(JSON.stringify(edges)), { removed: [[1, 2], [3, 4]], added: [[1, 3], [2, 4]] });
});

test('terrain intel spots the trap on 2D twin peaks (v1.2 item 6)', () => {
  const p = presetProblem('2d', '2d-twin');
  const intel = core.analyzeQuestion(p, p.start);
  assert.equal(intel.climbsToGlobal, false);
  assert.ok(intel.valley > 0);
  assert.ok(intel.peaks >= 2);
});

test('4-city intro map: 2 distinct 2-opt moves, a knotted start, and the home city never moves (v1.6)', () => {
  const p = presetProblem('tsp', 'tsp-intro');
  assert.equal(p.n, 4);
  const moves = core.OPS.tsp.neighbors(p, p.start);
  assert.equal(moves.length, 2);
  assert.equal(core.tourCrossings(p, p.start).length, 1);
  const hc = core.runToEnd(run('hc', p));
  assert.ok(core.foundGlobal(hc));
  assert.equal(hc.state.bestStep, 1);
  const r = core.runToEnd(run('ts', p));
  assert.ok(r.records.every((rec) => rec.to.pos[0] === p.start[0]));
});

test('hill climbing that stops on the global optimum is not called a local optimum (v1.3 bug fix)', () => {
  const p = presetProblem('tsp', 'tsp-circle');
  const r = core.runToEnd(run('hc', p));
  assert.ok(core.foundGlobal(r));
  const last = r.records.at(-1);
  assert.match(core.narrate(r, last)[0], /全域最佳/);
  assert.equal(core.shortNarration(r, last), '到達最佳解！');
});

test('TSP narration talks about 2-opt moves, not neighbouring cells (v1.3 A)', () => {
  const p = presetProblem('tsp', 'tsp-intro');
  const r = core.stepRun(run('hc', p));
  assert.match(core.narrate(r, r.records[0])[0], /試了 2 種改法/);
  assert.match(core.narrate(r, r.records[0])[0], /拆 \d–\d、\d–\d/);
});
