// ---------- Map canvas (spec 4.2): core, agents, bubbles, 1D and 2D drawing ----------
const HOP_PX = 6;
const EFFECT_MS = 600;
const SHAKE_MS = 420;
const CITY_HIT_PX = 14;
const EDGE_HIT_PX = 9;

class MapView {
  /**
   * opts: { compact, showCandidates, bubbles, square, onClick(info), onEdgeClick({ edge }) }
   * square: a 1:1 canvas used for TSP small multiples and thumbnails.
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = { compact: false, showCandidates: false, bubbles: false, square: false, onClick: null, onEdgeClick: null, ...opts };
    this.W = this.opts.square ? 400 : VIEW_W;
    this.H = VIEW_H;
    this.sq = this.opts.square ? SQUARE_ONLY : SQUARE;
    this.problem = null;
    this.agents = [];
    this.anim = new Map();
    this.showAnswer = false;
    this.fog = null;
    this.userPath = null;
    this.userTour = null;
    this.edgeChange = null;
    this.selectedEdges = [];
    this.crossings = null;
    this.explain = null;
    this.hover = null;
    this.tweenMs = 200;
    canvas.addEventListener('click', (e) => this.handleClick(e));
    canvas.addEventListener('mousemove', (e) => { this.hover = this.toLogical(e); });
    canvas.addEventListener('mouseleave', () => { this.hover = null; });
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  get cell() {
    return this.sq.size / SIZE_2D;
  }

  setProblem(problem) {
    this.problem = problem;
    this.terrain = problem.type === '2d' ? terrainImage(problem) : null;
    this.agents = [];
    this.anim.clear();
    this.fog = null;
    this.fogCanvas = null;
    this.userPath = null;
    this.userTour = null;
    this.edgeChange = null;
    this.selectedEdges = [];
    this.crossings = null;
    this.explain = null;
  }

  /** fog: null or { revealed: Set<key>, targets: [pos] }. */
  setFog(fog) {
    this.fog = fog;
    this.fogCanvas = fog && this.problem.type === '2d' ? fogImage(fog.revealed) : null;
  }

  setSpeed(stepsPerSecond) {
    this.tweenMs = Math.min(250, (1000 / stepsPerSecond) * 0.8);
  }

  /** agents: [{ key, run }]. Detects new records to trigger hop / shake / sparkle effects. */
  setAgents(agents) {
    const now = performance.now();
    const keys = new Set(agents.map((a) => a.key));
    [...this.anim.keys()].filter((k) => !keys.has(k)).forEach((k) => this.anim.delete(k));
    agents.forEach((a) => {
      const prev = this.anim.get(a.key);
      const count = a.run.records.length;
      if (!prev || count < prev.count || prev.run.problem !== a.run.problem) {
        this.anim.set(a.key, { run: a.run, count, from: null, t0: 0, effect: null });
        return;
      }
      if (count === prev.count) {
        this.anim.set(a.key, { ...prev, run: a.run });
        return;
      }
      const rec = lastRecord(a.run);
      const moved = rec.to !== rec.from;
      const effect = rec.event === 'reject' ? { text: '✗', shake: true, t0: now }
        : rec.isNewBest ? { text: '✨', shake: false, t0: now } : prev.effect;
      this.anim.set(a.key, {
        run: a.run, count, effect,
        from: moved ? this.currentPx(prev, now) : prev.from, t0: moved ? now : prev.t0,
      });
    });
    this.agents = agents;
  }

  toLogical(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * this.W, y: ((e.clientY - rect.top) / rect.height) * this.H };
  }

  cityPx(c) {
    return { x: this.sq.left + (c.x / 100) * this.sq.size, y: this.sq.top + (c.y / 100) * this.sq.size };
  }

  /** Translates a click into { pos } (1D/2D), { city } or { edge } (TSP). */
  handleClick(e) {
    if (!this.problem) return;
    const p = this.toLogical(e);
    const type = this.problem.type;
    if (type === 'tsp') {
      this.handleTspClick(p);
      return;
    }
    if (!this.opts.onClick) return;
    if (type === '1d') {
      if (p.x < PLOT_1D.left - 6 || p.x > PLOT_1D.right + 6) return;
      const x = Math.round(((p.x - PLOT_1D.left) / (PLOT_1D.right - PLOT_1D.left)) * (SIZE_1D - 1));
      this.opts.onClick({ pos: clamp(x, 0, SIZE_1D - 1) });
      return;
    }
    const cx = Math.floor((p.x - this.sq.left) / this.cell);
    const cy = Math.floor((p.y - this.sq.top) / this.cell);
    if (cx >= 0 && cy >= 0 && cx < SIZE_2D && cy < SIZE_2D) this.opts.onClick({ pos: point2d(cx, cy) });
  }

  handleTspClick(p) {
    const tour = this.userTour || (this.agents[0] && this.agents[0].run.state.current.pos);
    if (this.opts.onEdgeClick && tour) {
      let best = { k: -1, d: Infinity };
      for (let k = 0; k < tour.length; k++) {
        const [u, v] = tourEdge(tour, k);
        const d = pointSegmentDistance(p, this.cityPx(this.problem.cities[u]), this.cityPx(this.problem.cities[v]));
        if (d < best.d) best = { k, d };
      }
      if (best.d <= EDGE_HIT_PX) this.opts.onEdgeClick({ edge: best.k });
      return;
    }
    if (!this.opts.onClick) return;
    const hit = this.problem.cities.findIndex((c) => {
      const q = this.cityPx(c);
      return Math.hypot(q.x - p.x, q.y - p.y) <= CITY_HIT_PX;
    });
    if (hit >= 0) this.opts.onClick({ city: hit });
  }

  posPx(pos) {
    if (this.problem.type === '1d') return { x: x1d(pos), y: y1d(this.problem.values[pos]) };
    return { x: this.sq.left + (pos.x + 0.5) * this.cell, y: this.sq.top + (pos.y + 0.5) * this.cell };
  }

  currentPx(entry, now) {
    const target = this.posPx(entry.run.state.current.pos);
    if (!entry.from) return target;
    const t = clamp((now - entry.t0) / this.tweenMs, 0, 1);
    return { x: entry.from.x + (target.x - entry.from.x) * t, y: entry.from.y + (target.y - entry.from.y) * t };
  }

  resize() {
    const w = this.canvas.clientWidth;
    if (!w) return false;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(w * dpr);
    const height = Math.round(((w * this.H) / this.W) * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const k = width / this.W;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    return true;
  }

  /** Stops the animation loop; used for throw-away thumbnails. */
  destroy() {
    this.destroyed = true;
  }

  frame(now) {
    if (this.destroyed) return;
    requestAnimationFrame(this.frame);
    if (!this.problem || !this.canvas.isConnected || this.canvas.offsetParent === null || !this.resize()) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    const type = this.problem.type;
    if (type === '1d') this.draw1d(ctx);
    else if (type === '2d') this.draw2d(ctx);
    else this.drawTsp(ctx);
    if (type !== 'tsp') this.drawAgents(ctx, now);
    if (type !== 'tsp' && !this.fog && this.hover && !this.opts.compact) this.drawHover(ctx);
  }

  primaryRecord() {
    if (!this.opts.showCandidates || this.agents.length !== 1) return null;
    return lastRecord(this.agents[0].run);
  }

  // ----- 1D -----
  draw1d(ctx) {
    ctx.fillStyle = '#EAF4FB';
    ctx.fillRect(PLOT_1D.left, PLOT_1D.top, PLOT_1D.right - PLOT_1D.left, PLOT_1D.bottom - PLOT_1D.top);
    if (!this.opts.compact) this.draw1dAxes(ctx);
    if (this.fog) this.draw1dFog(ctx);
    else {
      ctx.beginPath();
      ctx.moveTo(x1d(0), PLOT_1D.bottom);
      this.problem.values.forEach((v, x) => ctx.lineTo(x1d(x), y1d(v)));
      ctx.lineTo(x1d(SIZE_1D - 1), PLOT_1D.bottom);
      ctx.closePath();
      ctx.fillStyle = '#9ED88E';
      ctx.fill();
      ctx.strokeStyle = '#4E9F3D';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    this.drawOverlays(ctx);
  }

  draw1dAxes(ctx) {
    ctx.strokeStyle = 'rgba(80,100,120,0.15)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#7a6a58';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    [0, 25, 50, 75, 100].forEach((v) => {
      ctx.beginPath();
      ctx.moveTo(PLOT_1D.left, y1d(v));
      ctx.lineTo(PLOT_1D.right, y1d(v));
      ctx.stroke();
      ctx.fillText(String(v), PLOT_1D.left - 6, y1d(v) + 4);
    });
    ctx.textAlign = 'center';
    [0, 50, 100, 150, 199].forEach((x) => ctx.fillText(String(x), x1d(x), PLOT_1D.bottom + 16));
  }

  draw1dFog(ctx) {
    ctx.fillStyle = FOG_COLOR;
    ctx.fillRect(PLOT_1D.left, PLOT_1D.top, PLOT_1D.right - PLOT_1D.left, PLOT_1D.bottom - PLOT_1D.top);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '28px system-ui, sans-serif';
    for (let k = 0; k < 8; k++) ctx.fillText('☁', 90 + k * 65, 70 + (k % 3) * 90);
    ctx.textAlign = 'center';
    this.fog.revealed.forEach((key) => {
      const x = Number(key);
      const v = this.problem.values[x];
      ctx.fillStyle = '#9ED88E';
      ctx.fillRect(x1d(x) - 4, y1d(v), 8, PLOT_1D.bottom - y1d(v));
      ctx.fillStyle = '#2f6b25';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(fmt1(v), x1d(x), y1d(v) - 6);
    });
    (this.fog.targets || []).forEach((x) => this.dashedBox(ctx, x1d(x) - 7, y1d(this.problem.values[x]) - 7, 14, 14, '#FF9F43'));
  }

  // ----- 2D -----
  draw2d(ctx) {
    const { left, top, size } = this.sq;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, left, top, size, size);
    if (this.fogCanvas) ctx.drawImage(this.fogCanvas, left, top, size, size);
    ctx.strokeStyle = '#8a7660';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, size, size);
    if (!this.opts.compact && !this.opts.square) this.drawLegend(ctx);
    this.drawOverlays(ctx);
  }

  drawLegend(ctx) {
    const x = 520;
    const top = 40;
    const bottom = 340;
    for (let y = top; y <= bottom; y++) {
      ctx.fillStyle = terrainCss(((bottom - y) / (bottom - top)) * HEIGHT_MAX);
      ctx.fillRect(x, y, 16, 1);
    }
    ctx.strokeStyle = '#8a7660';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, top, 16, bottom - top);
    ctx.fillStyle = '#7a6a58';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('100', x + 22, top + 4);
    ctx.fillText('50', x + 22, (top + bottom) / 2 + 4);
    ctx.fillText('0', x + 22, bottom + 4);
    ctx.fillText('高度', x - 2, top - 12);
  }

  drawOverlays(ctx) {
    this.drawTabu(ctx);
    this.drawCandidates(ctx);
    this.drawTrails(ctx);
    this.drawUserPath(ctx);
    this.drawAnswer(ctx);
  }

  drawTabu(ctx) {
    const rec = this.primaryRecord();
    const agent = this.agents[0];
    if (!rec || agent.run.algo !== 'ts') return;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    agent.run.state.tabu.forEach((entry) => {
      const parts = entry.keys[0].split(',').map(Number);
      const pos = this.problem.type === '2d' ? point2d(parts[0], parts[1]) : parts[0];
      const q = this.posPx(pos);
      const size = this.problem.type === '2d' ? this.cell + 2 : 12;
      ctx.fillStyle = TABU_COLOR;
      ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size);
      ctx.fillStyle = '#7a3d00';
      ctx.fillText('✕', q.x, q.y + 4);
    });
  }

  drawCandidates(ctx) {
    const rec = this.primaryRecord();
    if (!rec) return;
    const from = this.posPx(rec.from.pos);
    rec.candidates.forEach((c) => {
      const q = this.posPx(c.move);
      ctx.strokeStyle = c.tabu ? '#FF8C28' : c.better ? ADDED_COLOR : REMOVED_COLOR;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 2;
      if (this.problem.type === '2d') ctx.strokeRect(q.x - this.cell / 2, q.y - this.cell / 2, this.cell, this.cell);
      else {
        ctx.beginPath();
        ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (rec.chosen === null) return;
    const to = this.posPx(rec.chosen);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#3d2f22';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawTrails(ctx) {
    this.agents.forEach(({ run }) => {
      const color = ALGOS[run.algo].color;
      const points = [run.records.length ? run.records[0].from.pos : run.state.current.pos,
        ...run.records.filter((r) => r.to !== r.from).map((r) => r.to.pos)].map((pos) => this.posPx(pos));
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      points.forEach((q) => {
        ctx.beginPath();
        ctx.arc(q.x, q.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    });
  }

  drawUserPath(ctx) {
    if (!this.userPath) return;
    const points = this.userPath.map((pos) => this.posPx(pos));
    ctx.strokeStyle = '#3d2f22';
    ctx.fillStyle = '#3d2f22';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
    points.forEach((q) => {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    const last = points[points.length - 1];
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🙋', last.x, last.y - 8);
  }

  drawAnswer(ctx) {
    if (!this.showAnswer) return;
    const q = this.posPx(this.problem.global.state);
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⭐', q.x, q.y + 8);
  }

  dashedBox(ctx, x, y, w, hgt, color) {
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, hgt);
    ctx.setLineDash([]);
  }

  drawAgents(ctx, now) {
    const size = this.problem.type === '1d' ? 40 : 30;
    const seen = new Map();
    this.agents.forEach(({ key, run }) => {
      const entry = this.anim.get(key);
      if (!entry) return;
      const k = posKey(this.problem.type, run.state.current.pos);
      const overlap = seen.get(k) || 0;
      seen.set(k, overlap + 1);
      const base = this.currentPx(entry, now);
      const hopT = entry.from ? clamp((now - entry.t0) / this.tweenMs, 0, 1) : 1;
      const reduced = prefersReducedMotion();
      const hop = reduced || hopT >= 1 ? 0 : -HOP_PX * Math.sin(Math.PI * hopT);
      const shakeT = entry.effect && entry.effect.shake ? (now - entry.effect.t0) / SHAKE_MS : 1;
      const shake = !reduced && shakeT < 1 ? Math.sin(shakeT * Math.PI * 4) * 4 : 0;
      const x = base.x + overlap * 6 + shake;
      const anchorY = this.problem.type === '1d' ? base.y - size + 4 : base.y - size / 2;
      const y = anchorY + overlap * 6 + hop;
      const img = agentImage(ALGOS[run.algo].icon);
      if (img.complete) ctx.drawImage(img, x - size / 2, y, size, size);
      this.drawEffect(ctx, entry, run, x, y, now);
      if (this.opts.bubbles && run.records.length) this.drawSpeech(ctx, shortNarration(run, lastRecord(run)), x, y - 6, ALGOS[run.algo].color);
    });
  }

  drawEffect(ctx, entry, run, x, y, now) {
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (run.state.stopped) {
      ctx.fillText('💤', x + 18, y + 6);
      return;
    }
    if (!entry.effect) return;
    const age = now - entry.effect.t0;
    if (age > EFFECT_MS) return;
    ctx.globalAlpha = 1 - age / EFFECT_MS;
    ctx.fillStyle = entry.effect.text === '✗' ? REMOVED_COLOR : '#b8860b';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(entry.effect.text, x - 18, y + 4 - age / 40);
    ctx.globalAlpha = 1;
  }

  /** Rounded speech bubble whose tail points down at (x, y). */
  drawSpeech(ctx, text, x, y, color) {
    if (!text) return;
    ctx.font = 'bold 13px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 16;
    const h = 24;
    const bx = clamp(x - w / 2, 2, this.W - w - 2);
    const by = Math.max(2, y - h - 8);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(clamp(x, bx + 10, bx + w - 10) - 5, by + h);
    ctx.lineTo(clamp(x, bx + 10, bx + w - 10), by + h + 7);
    ctx.lineTo(clamp(x, bx + 10, bx + w - 10) + 5, by + h);
    ctx.fill();
    ctx.fillStyle = '#3d2f22';
    ctx.textAlign = 'center';
    ctx.fillText(text, bx + w / 2, by + 16);
  }

  drawHover(ctx) {
    const { x, y } = this.hover;
    let label = null;
    if (this.problem.type === '1d' && x >= PLOT_1D.left && x <= PLOT_1D.right) {
      const px = Math.round(((x - PLOT_1D.left) / (PLOT_1D.right - PLOT_1D.left)) * (SIZE_1D - 1));
      label = `x=${px}  高度 ${fmt1(this.problem.values[px])}`;
    } else if (this.problem.type === '2d') {
      const cx = Math.floor((x - this.sq.left) / this.cell);
      const cy = Math.floor((y - this.sq.top) / this.cell);
      if (cx >= 0 && cy >= 0 && cx < SIZE_2D && cy < SIZE_2D) {
        label = `(${cx},${cy})  高度 ${fmt1(this.problem.values[cy * SIZE_2D + cx])}`;
      }
    }
    if (!label) return;
    ctx.font = '12px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 12;
    const bx = clamp(x + 12, 0, this.W - w);
    const by = clamp(y - 28, 0, this.H - 22);
    ctx.fillStyle = 'rgba(61,47,34,0.88)';
    ctx.fillRect(bx, by, w, 20);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(label, bx + 6, by + 14);
  }
}
