// ---------- Progress chart (spec 4.8) ----------
const CHART_W = 600;
const CHART_H = 220;
const CHART_PAD = Object.freeze({ left: 46, right: 14, top: 40, bottom: 30 });

class ChartView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.runs = [];
    this.options = {};
    this.hoverX = null;
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.hoverX = ((e.clientX - rect.left) / rect.width) * CHART_W;
      this.draw();
    });
    canvas.addEventListener('mouseleave', () => {
      this.hoverX = null;
      this.draw();
    });
    window.addEventListener('resize', () => this.draw());
  }

  /** options: { styles: [{ color, name }] per run, target: { value, label }, hideCurrent } */
  setRuns(runs, options = {}) {
    this.runs = runs;
    this.options = options;
    this.draw();
  }

  series(run, i) {
    const first = run.records.length ? run.records[0].from.display : run.state.current.display;
    const style = (this.options.styles || [])[i];
    return {
      color: style ? style.color : ALGOS[run.algo].color,
      name: style ? style.name : ALGOS[run.algo].animal,
      stopped: Boolean(run.state.stopped),
      current: [first, ...run.records.map((r) => r.to.display)],
      best: [first, ...run.records.map((r) => r.best.display)],
    };
  }

  draw() {
    const w = this.canvas.clientWidth;
    if (!w) return;
    if (!this.runs.length) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(((w * CHART_H) / CHART_W) * dpr);
    const ctx = this.ctx;
    ctx.setTransform(this.canvas.width / CHART_W, 0, 0, this.canvas.width / CHART_W, 0, 0);
    ctx.clearRect(0, 0, CHART_W, CHART_H);
    const lowerIsBetter = this.runs[0].problem.type === 'tsp';
    const data = this.runs.map((r, i) => this.series(r, i));
    const { target, hideCurrent } = this.options;
    const maxStep = Math.max(10, ...data.map((s) => s.current.length - 1));
    const all = [...data.flatMap((s) => s.current), ...(target ? [target.value] : [])];
    const yMin = lowerIsBetter ? Math.min(...all) * 0.95 : 0;
    const yMax = lowerIsBetter ? Math.max(...all) * 1.02 : HEIGHT_MAX;
    const sx = (i) => CHART_PAD.left + (i / maxStep) * (CHART_W - CHART_PAD.left - CHART_PAD.right);
    const sy = (v) => CHART_H - CHART_PAD.bottom - ((v - yMin) / (yMax - yMin || 1)) * (CHART_H - CHART_PAD.top - CHART_PAD.bottom);
    this.drawAxes(ctx, { maxStep, yMin, yMax, sx, sy, lowerIsBetter });
    if (target) this.drawTarget(ctx, target, sx, sy, maxStep);
    data.forEach((s) => {
      if (!hideCurrent) this.line(ctx, s.current, sx, sy, s.color, 1.2, [4, 3], 0.55);
      this.line(ctx, s.best, sx, sy, s.color, 2.5, null, 1);
      const last = s.best.length - 1;
      if (s.stopped && last < maxStep) {
        // A stopped run keeps its best value: continue it as a faint solid line ending in 💤.
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx(last), sy(s.best[last]));
        ctx.lineTo(sx(maxStep), sy(s.best[last]));
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💤', sx(last), sy(s.best[last]) - 6);
      }
    });
    this.drawLegend(ctx, data);
    this.drawHover(ctx, data, { maxStep, sx });
  }

  drawAxes(ctx, { maxStep, yMin, yMax, sx, sy, lowerIsBetter }) {
    ctx.strokeStyle = 'rgba(80,60,40,0.15)';
    ctx.fillStyle = '#7a6a58';
    ctx.font = '11px system-ui, sans-serif';
    ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = yMin + ((yMax - yMin) * k) / 4;
      ctx.beginPath();
      ctx.moveTo(CHART_PAD.left, sy(v));
      ctx.lineTo(CHART_W - CHART_PAD.right, sy(v));
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(v)), CHART_PAD.left - 6, sy(v) + 4);
    }
    ctx.textAlign = 'center';
    for (let k = 0; k <= 5; k++) {
      const i = Math.round((maxStep * k) / 5);
      ctx.fillText(String(i), sx(i), CHART_H - 10);
    }
    ctx.textAlign = 'left';
    ctx.fillText(lowerIsBetter ? '路線長度（越低越好）' : '高度（越高越好）', CHART_PAD.left, 13);
    ctx.textAlign = 'right';
    ctx.fillText('步數 →　實線＝歷史最佳　虛線＝目前值　淡線＋💤＝已停止', CHART_W - CHART_PAD.right, 13);
  }

  drawLegend(ctx, data) {
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    let x = CHART_PAD.left;
    data.forEach((s) => {
      ctx.fillStyle = s.color;
      ctx.fillRect(x, 26, 16, 4);
      ctx.fillStyle = '#3d2f22';
      ctx.fillText(s.name, x + 20, 31);
      x += ctx.measureText(s.name).width + 36;
    });
  }

  drawTarget(ctx, target, sx, sy, maxStep) {
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(target.value));
    ctx.lineTo(sx(maxStep), sy(target.value));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b8860b';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(target.label, sx(maxStep), sy(target.value) - 4);
  }

  line(ctx, values, sx, sy, color, width, dash, alpha) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    values.forEach((v, i) => (i ? ctx.lineTo(sx(i), sy(v)) : ctx.moveTo(sx(i), sy(v))));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  drawHover(ctx, data, { maxStep, sx }) {
    if (this.hoverX === null || this.hoverX < CHART_PAD.left) return;
    const step = clamp(Math.round(((this.hoverX - CHART_PAD.left) / (CHART_W - CHART_PAD.left - CHART_PAD.right)) * maxStep), 0, maxStep);
    ctx.strokeStyle = 'rgba(61,47,34,0.4)';
    ctx.beginPath();
    ctx.moveTo(sx(step), CHART_PAD.top);
    ctx.lineTo(sx(step), CHART_H - CHART_PAD.bottom);
    ctx.stroke();
    const rows = data.filter((s) => step < s.best.length)
      .map((s) => ({ color: s.color, text: `${s.name} 目前 ${fmt1(s.current[step])}／最佳 ${fmt1(s.best[step])}` }));
    const lines = [{ color: '#fff', text: `第 ${step} 步` }, ...rows];
    ctx.font = '12px system-ui, sans-serif';
    const w = Math.max(...lines.map((l) => ctx.measureText(l.text).width)) + 16;
    const bx = sx(step) + 10 + w > CHART_W ? sx(step) - w - 10 : sx(step) + 10;
    ctx.fillStyle = 'rgba(61,47,34,0.9)';
    ctx.fillRect(bx, CHART_PAD.top, w, lines.length * 17 + 6);
    lines.forEach((l, i) => {
      ctx.fillStyle = i === 0 ? '#fff' : l.color;
      ctx.textAlign = 'left';
      ctx.fillText(l.text, bx + 8, CHART_PAD.top + 16 + i * 17);
    });
  }
}
