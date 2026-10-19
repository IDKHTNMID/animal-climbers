// ---------- "I am the dragon" end-of-game decision chart (spec v1.3, B) ----------
// x = temperature T, y = Δ. The curve Δ = −T·ln2 is where the rule's probability is exactly 0.5:
// above it the rule leans to accept, below it to reject.
const DC_W = 600;
const DC_H = 280;
const DC_PAD = Object.freeze({ left: 52, right: 20, top: 26, bottom: 40 });

function drawDecisionChart(canvas, history, maxT) {
  const w = canvas.clientWidth || DC_W;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(((w * DC_H) / DC_W) * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / DC_W, 0, 0, canvas.width / DC_W, 0, 0);
  ctx.clearRect(0, 0, DC_W, DC_H);
  const deltas = history.map((e) => e.delta);
  const yMax = Math.max(2, ...deltas) * 1.1;
  const yMin = Math.min(-2, ...deltas, -maxT * Math.LN2) * 1.1;
  const sx = (t) => DC_PAD.left + (t / maxT) * (DC_W - DC_PAD.left - DC_PAD.right);
  const sy = (d) => DC_H - DC_PAD.bottom - ((d - yMin) / (yMax - yMin)) * (DC_H - DC_PAD.top - DC_PAD.bottom);

  // Shaded regions: above the p = 0.5 curve leans accept, below leans reject.
  ctx.fillStyle = 'rgba(22,163,74,0.08)';
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(yMax));
  ctx.lineTo(sx(maxT), sy(yMax));
  ctx.lineTo(sx(maxT), sy(-maxT * Math.LN2));
  ctx.lineTo(sx(0), sy(0));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(220,38,38,0.08)';
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(0));
  ctx.lineTo(sx(maxT), sy(-maxT * Math.LN2));
  ctx.lineTo(sx(maxT), sy(yMin));
  ctx.lineTo(sx(0), sy(yMin));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(80,60,40,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(0));
  ctx.lineTo(sx(maxT), sy(0));
  ctx.stroke();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(0));
  ctx.lineTo(sx(maxT), sy(-maxT * Math.LN2));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#7a6a58';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  [0, maxT / 4, maxT / 2, (3 * maxT) / 4, maxT].forEach((t) => ctx.fillText(fmt1(t), sx(t), DC_H - 22));
  ctx.fillText('溫度 T（左邊冷、右邊熱）', (DC_PAD.left + DC_W - DC_PAD.right) / 2, DC_H - 6);
  ctx.textAlign = 'right';
  [yMin, yMin / 2, 0, yMax].forEach((d) => ctx.fillText(fmt1(d), DC_PAD.left - 6, sy(d) + 4));
  ctx.textAlign = 'left';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Δ（往上＝變好）', DC_PAD.left, 14);
  ctx.fillStyle = '#b8860b';
  ctx.textAlign = 'right';
  ctx.fillText('虛線：p = 0.5 分界（上方該接受、下方該拒絕）', DC_W - DC_PAD.right, 14);

  history.forEach((e) => {
    const x = sx(e.T);
    const y = sy(e.delta);
    if (!e.agree) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = e.accepted ? '#16a34a' : '#dc2626';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(e.accepted ? '●' : '✕', x, y + 4);
  });
}
