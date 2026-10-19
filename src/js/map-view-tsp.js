// ---------- Map canvas: TSP drawing (spec v1.2 items 3, 4, 9; beginner details in spec v1.3) ----------
// Removed edges are red dashed with a scissors mark, added edges are green. A single route also shows
// the home city 🏠, direction arrows and the length of every edge.
const EDGE_LABEL_MAX_CITIES = 12;
const ARROW_AT = 0.36;
const TABU_EDGE_COLOR = '#f97316';
const LABEL_SLOTS = Object.freeze([0.5, 0.64, 0.36, 0.74, 0.26]);

Object.assign(MapView.prototype, {
  drawTsp(ctx) {
    const { left, top, size } = this.sq;
    ctx.fillStyle = '#F7F2E6';
    ctx.fillRect(left, top, size, size);
    ctx.strokeStyle = '#8a7660';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, size, size);
    const single = this.opts.showCandidates && this.agents.length === 1;
    const singleRun = single ? this.agents[0].run : null;
    if (single) this.drawTour(ctx, singleRun.state.best.pos, GOLD, 7, 0.4);
    if (this.showAnswer) this.drawTour(ctx, this.problem.ref.tour, GOLD, 2.5, 1, [7, 5]);
    const widths = [5.5, 3.5, 2];
    // A single route is drawn in neutral brown so the red / green edge change stands out.
    this.agents.forEach(({ run }, i) => this.drawTour(ctx, run.state.current.pos, single ? ROUTE_COLOR : ALGOS[run.algo].color,
      this.agents.length > 1 ? widths[i % widths.length] : 3, 0.8));
    if (this.userTour) this.drawTour(ctx, this.userTour, '#3d2f22', 3, 0.85);
    const detailTour = this.userTour || (singleRun && singleRun.state.current.pos);
    if (singleRun && singleRun.algo === 'ts') this.drawTabuEdges(ctx, singleRun.state.tabu);
    this.drawSelectedEdges(ctx);
    const change = this.explain ? null : this.edgeChange || this.recordEdgeChange();
    if (change) this.drawEdgeChange(ctx, change);
    if (this.explain) this.drawExplain(ctx, this.explain);
    // Labels go on top of the coloured edges so the numbers stay readable.
    // While the neighbour generator is open it draws its own arrows (the flipped piece points the other way).
    if (detailTour && !this.opts.compact) this.drawRouteDetails(ctx, detailTour, !this.explain);
    this.drawCrossings(ctx);
    this.drawCities(ctx, detailTour ? detailTour[0] : null);
    if (!this.opts.compact && !this.opts.square) this.drawBadges(ctx);
    if (single && this.opts.bubbles && !this.opts.square) this.drawBadgeNote(ctx, singleRun);
  },

  /** The edge change of the latest step for single-agent views (learn page, tune big view). */
  recordEdgeChange() {
    const rec = this.primaryRecord();
    if (!rec || rec.chosen === null) return null;
    const status = rec.event === 'stop' ? 'rejected' : rec.accepted ? 'accepted' : 'rejected';
    return { ...twoOptEdges(rec.chosen), status };
  },

  drawTour(ctx, tour, color, width, alpha, dash) {
    const pts = tour.map((k) => this.cityPx(this.problem.cities[k]));
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  },

  /** Direction arrows and per-edge length labels, so "total length = sum of edges" is visible. */
  drawArrowHead(ctx, u, v, color, size) {
    const a = this.cityPx(this.problem.cities[u]);
    const b = this.cityPx(this.problem.cities[v]);
    ctx.save();
    ctx.translate(a.x + (b.x - a.x) * ARROW_AT, a.y + (b.y - a.y) * ARROW_AT);
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.75);
    ctx.lineTo(-size * 0.7, size * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawRouteDetails(ctx, tour, withArrows = true) {
    const showLabels = tour.length <= EDGE_LABEL_MAX_CITIES;
    const placed = [];
    tour.forEach((u, k) => {
      const v = tour[(k + 1) % tour.length];
      const a = this.cityPx(this.problem.cities[u]);
      const b = this.cityPx(this.problem.cities[v]);
      if (withArrows) this.drawArrowHead(ctx, u, v, '#5b4a38', 6);
      if (!showLabels) return;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = fmt1(this.problem.dist[u][v]);
      const w = ctx.measureText(label).width + 6;
      const overlaps = (x, y) => placed.some((r) => Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - y) < 14);
      const t = LABEL_SLOTS.find((s) => !overlaps(a.x + (b.x - a.x) * s, a.y + (b.y - a.y) * s)) ?? 0.5;
      const mx = a.x + (b.x - a.x) * t;
      const my = a.y + (b.y - a.y) * t;
      placed.push({ x: mx, y: my, w });
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath();
      ctx.roundRect(mx - w / 2, my - 7, w, 13, 4);
      ctx.fill();
      ctx.fillStyle = '#5b4a38';
      ctx.fillText(label, mx, my + 3);
    });
  },

  drawSegment(ctx, u, v, color, width, dash) {
    const a = this.cityPx(this.problem.cities[u]);
    const b = this.cityPx(this.problem.cities[v]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  },

  /** Tabu search memory: edges cut recently may not be reconnected, drawn as thin orange dashes. */
  drawTabuEdges(ctx, tabu) {
    tabu.forEach((entry) => entry.keys.forEach((key) => {
      const [u, v] = key.split('-').map(Number);
      this.drawSegment(ctx, u, v, TABU_EDGE_COLOR, 2, [3, 4]);
    }));
  },

  /** change: { removed: [[u, v], ...], added: [[u, v], ...], status: 'accepted' | 'rejected' | 'preview' } */
  drawEdgeChange(ctx, change) {
    const rejected = change.status === 'rejected';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    change.removed.forEach(([u, v]) => {
      const mid = this.drawSegment(ctx, u, v, REMOVED_COLOR, 3, [6, 5]);
      if (!this.opts.compact) {
        ctx.fillStyle = REMOVED_COLOR;
        ctx.fillText('✂', mid.x, mid.y + 5);
      }
    });
    ctx.globalAlpha = rejected ? 0.55 : 1;
    change.added.forEach(([u, v]) => {
      const mid = this.drawSegment(ctx, u, v, ADDED_COLOR, 4, rejected ? [4, 4] : null);
      if (rejected && !this.opts.compact) {
        ctx.fillStyle = REMOVED_COLOR;
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText('✗', mid.x, mid.y + 5);
      }
    });
    ctx.globalAlpha = 1;
  },

  /**
   * Neighbour generator stages: ① chosen edges in orange, ② cut (red) and the piece to flip in blue,
   * ③ the blue piece reversed (its arrows and the visiting-order badges flip), ④ the new edges in green.
   */
  drawExplain(ctx, { tour, move, stage }) {
    const { a, b, c, d, i, j } = move;
    const n = tour.length;
    const piece = tour.slice(i, j + 1);
    const order = stage >= 3 ? reverseSegment(tour, i, j) : tour;
    if (stage >= 2) {
      const pts = (stage >= 3 ? [...piece].reverse() : piece).map((k) => this.cityPx(this.problem.cities[k]));
      ctx.strokeStyle = 'rgba(59,130,246,0.45)';
      ctx.lineWidth = 12;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
    }
    if (stage === 1) [[a, b], [c, d]].forEach(([u, v]) => this.drawSegment(ctx, u, v, '#FF9F43', 8));
    else this.drawEdgeChange(ctx, { removed: [[a, b], [c, d]], added: stage === 4 ? [[a, c], [b, d]] : [], status: 'preview' });
    const cut = new Set([edgeKey(a, b), edgeKey(c, d)]);
    const added = new Set([edgeKey(a, c), edgeKey(b, d)]);
    order.forEach((u, k) => {
      const v = order[(k + 1) % n];
      const key = edgeKey(u, v);
      if (stage >= 2 && cut.has(key)) return;
      if (stage < 4 && added.has(key)) return;
      const inPiece = stage >= 2 && piece.includes(u) && piece.includes(v);
      this.drawArrowHead(ctx, u, v, inPiece ? '#1d4ed8' : '#5b4a38', inPiece ? 10 : 6);
    });
    this.drawOrderBadges(ctx, order, stage >= 3 ? piece : []);
    if (stage === 3) {
      const mid = this.cityPx(this.problem.cities[piece[Math.floor(piece.length / 2)]]);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#1d4ed8';
      ctx.textAlign = 'center';
      ctx.fillText('🔄 倒過來', mid.x, mid.y - 18);
    }
  },

  /** Visiting order (🏠 = 1) next to every city; badges of the flipped piece are blue. */
  drawOrderBadges(ctx, order, highlight) {
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    order.forEach((city, k) => {
      const q = this.cityPx(this.problem.cities[city]);
      const blue = highlight.includes(city);
      ctx.fillStyle = blue ? '#1d4ed8' : '#3d2f22';
      ctx.beginPath();
      ctx.arc(q.x + 12, q.y + 11, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(k + 1), q.x + 12, q.y + 14.5);
    });
  },

  drawSelectedEdges(ctx) {
    const tour = this.userTour;
    if (!tour) return;
    this.selectedEdges.forEach((k) => {
      const [u, v] = tourEdge(tour, k);
      this.drawSegment(ctx, u, v, '#FF9F43', 7);
    });
  },

  drawCrossings(ctx) {
    if (!this.crossings) return;
    ctx.strokeStyle = 'rgba(220,38,38,0.75)';
    ctx.lineWidth = 1.5;
    this.crossings.forEach((pt) => {
      const q = this.cityPx(pt);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    });
  },

  drawCities(ctx, home) {
    ctx.textAlign = 'center';
    this.problem.cities.forEach((c, k) => {
      const q = this.cityPx(c);
      const isHome = k === home;
      ctx.beginPath();
      ctx.arc(q.x, q.y, isHome ? 9 : 7, 0, Math.PI * 2);
      ctx.fillStyle = isHome ? '#FFE3B3' : '#fff';
      ctx.fill();
      ctx.strokeStyle = '#3d2f22';
      ctx.lineWidth = isHome ? 2.5 : 1.5;
      ctx.stroke();
      ctx.fillStyle = '#3d2f22';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText(String(k), q.x, q.y + 3);
      if (isHome && !this.opts.compact) {
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText('🏠', q.x, q.y - 12);
      }
    });
  },

  drawBadges(ctx) {
    ctx.textAlign = 'left';
    this.agents.forEach(({ run }, i) => {
      const y = 14 + i * 60;
      const img = agentImage(ALGOS[run.algo].icon);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, 8, y, 36, 36);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = ALGOS[run.algo].color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(46, y + 6, 58, 24, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3d2f22';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(fmt1(run.state.current.display), 52, y + 22);
      if (run.state.stopped) ctx.fillText('💤', 8, y + 46);
    });
  },

  /** Short step note in the left margin (not over the map), wrapped to the margin width. */
  drawBadgeNote(ctx, run) {
    const rec = lastRecord(run);
    if (!rec) return;
    const maxW = 92;
    ctx.font = 'bold 12px system-ui, sans-serif';
    const lines = [];
    let line = '';
    [...shortNarration(run, rec)].forEach((ch) => {
      if (ctx.measureText(line + ch).width > maxW) {
        lines.push(line);
        line = ch;
      } else line += ch;
    });
    if (line) lines.push(line);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = ALGOS[run.algo].color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(6, 66, maxW + 10, lines.length * 16 + 10, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3d2f22';
    ctx.textAlign = 'left';
    lines.forEach((l, i) => ctx.fillText(l, 11, 66 + 18 + i * 16));
  },
});
