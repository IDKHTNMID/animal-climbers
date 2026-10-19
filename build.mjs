// Bundles src/ into a single self-contained index.html (assignment requires one file).
// Usage: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const JS_ORDER = [
  'assets.js', 'rng.js', 'problems.js', 'algorithms.js', 'narration.js',
  'dom.js', 'map-geometry.js', 'map-view.js', 'map-view-tsp.js', 'chart-view.js',
  'components.js', 'code-trace.js', 'narration-ui.js', 'step-detail.js', 'guide-svg.js', 'guide.js', 'mode-guides.js',
  'neighbour-explorer.js', 'tsp-trio.js',
  'page-learn.js', 'page-compare.js',
  'terrain-intel.js', 'challenge-predict.js', 'play-explore.js', 'dragon-chart.js', 'play-dragon.js', 'play-tsp.js', 'challenge-play.js', 'challenge-tune.js', 'page-challenge.js',
  'site-tour.js', 'main.js',
];

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const js = JS_ORDER.map((f) => `// ===== ${f} =====\n${read(`./src/js/${f}`)}`).join('\n');
const html = read('./src/template.html')
  .replace('/*__CSS__*/', () => read('./src/styles.css'))
  .replace('/*__JS__*/', () => `(() => {\n'use strict';\n${js}\n})();`);

writeFileSync(new URL('./index.html', import.meta.url), html, 'utf8');
console.log(`index.html written: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
