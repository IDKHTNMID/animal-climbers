// Loads the DOM-free core scripts into one VM context so node tests can use them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const CORE_FILES = ['rng.js', 'problems.js', 'algorithms.js', 'narration.js', 'code-trace.js', 'dom.js', 'map-geometry.js', 'terrain-intel.js'];
const EXPORTS = [
  'mulberry32', 'parseSeed', 'shuffled', 'buildProblem', 'OPS', 'tourLength', 'reverseSegment', 'MAP_PRESETS',
  'RANDOM_MAP_ID', 'createRun', 'stepRun', 'runToEnd', 'foundGlobal', 'DEFAULT_PARAMS', 'narrate',
  'highlightLines', 'randomStartFor', 'SIZE_2D', 'isValidTwoOpt', 'codeTrace', 'shortNarration', 'tourCrossings',
  'analyzeQuestion', 'twoOptEdges',
];

export function loadCore() {
  const dir = fileURLToPath(new URL('../src/js/', import.meta.url));
  const source = CORE_FILES.map((f) => readFileSync(dir + f, 'utf8')).join('\n');
  const context = vm.createContext({ Math, Object, Array, Float64Array, Map, String, Number, Error, Boolean });
  return vm.runInContext(`${source}\n;({ ${EXPORTS.join(', ')} })`, context);
}
