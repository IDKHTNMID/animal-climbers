// ---------- Guide modal (shared by every page and mode), problem intros, rule summary (spec v1.3 - v1.5) ----------
const GUIDE_SEEN_PREFIX = 'animal-climbers-guide-v2-';
const GUIDE_CONTROLS = '操作：「⏭ 下一步」走一步、「⏮ 上一步」倒回、「▶ 播放」連續執行。';

function terrainSlides(problem) {
  const is1d = problem.type === '1d';
  return [
    {
      title: is1d ? '① 1D 曲線：找最高點' : '① 2D 地形：找最高點（越白越高）',
      svg: is1d ? SVG_NEIGHBOR_1D : SVG_NEIGHBOR_2D,
      html: is1d ? '動物每一步只看得到<b>左右兩個鄰居</b>，要一步一步找到整條曲線最高的點。'
        : '動物每一步只看得到<b>周圍 8 個鄰居</b>（右邊放大鏡會列出高度），要一步一步找到整張地圖最高的格子。',
    },
    {
      title: '② 小心「小山頭」',
      svg: SVG_PEAKS_1D,
      html: '四周都比較低、卻不是最高的地方叫<b>局部最高點</b>；真正最高的是<b>全域最高點 ⭐</b>。',
    },
    { title: '③ 三隻動物怎麼找？', svg: demoTrioHtml(), html: GUIDE_CONTROLS, finishLabel: '開始' },
  ];
}

function tspSlides(problem) {
  return [
    {
      title: '① TSP（旅行推銷員問題）', svg: SVG_ROUTE,
      html: '每座城市去一次、最後回到 🏠，<b>總長度越短越好</b>。動物站的是<b>一整條路線</b>：路線越短＝山越高。',
    },
    {
      title: '② 鄰居：解開一個結', svg: SVG_TWO_OPT_ANIM,
      html: `剪掉 2 條線、把中間那段倒過來、再接回去，就得到一條「鄰居路線」。這張圖每一步有 <b>${neighbourCount(problem)} 個鄰居</b>。`,
    },
    {
      title: '③ 三隻動物怎麼找最短路線？', svg: demoTrioHtml(TSP_DEMO_SVGS, TSP_DEMO_CAPTIONS),
      html: GUIDE_CONTROLS, finishLabel: '開始',
    },
  ];
}

function problemSlides(problem) {
  return problem.type === 'tsp' ? tspSlides(problem) : terrainSlides(problem);
}

const problemGuideKey = (type) => `problem-${type}`;

let guideModal = null;

/** One shared, page-centred guide modal. open(slides, key) marks key as seen when closed. */
function getGuideModal() {
  if (guideModal) return guideModal;
  const card = h('div', { class: 'guide-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': '導覽' });
  const el = h('div', { class: 'guide-overlay', hidden: true }, card);
  document.body.append(el);
  let slides = [];
  let index = 0;
  let seenKey = null;
  let onClose = null;

  /** finished = the user reached the last page (not skipped). */
  function close(finished) {
    el.hidden = true;
    if (seenKey) storage.set(GUIDE_SEEN_PREFIX + seenKey, true);
    if (onClose) onClose(finished);
  }

  function render() {
    const slide = slides[index];
    const last = index === slides.length - 1;
    card.replaceChildren(
      h('div', { class: 'guide-head' }, h('strong', null, slide.title),
        h('button', { type: 'button', class: 'help-btn', onClick: () => close(false) }, '略過導覽')),
      ...(slide.svg ? [h('div', { html: slide.svg })] : []),
      h('div', { class: 'guide-text', html: slide.html }),
      h('div', { class: 'guide-foot' },
        h('span', { class: 'dots' }, slides.map((_, i) => (i === index ? '●' : '○')).join('')),
        h('button', { type: 'button', class: 'btn', disabled: index === 0, onClick: () => { index -= 1; render(); } }, '上一頁'),
        h('button', { type: 'button', class: 'btn btn-primary', onClick: () => { if (last) close(true); else { index += 1; render(); } } },
          last ? (slide.finishLabel || '開始') : '下一頁')));
  }

  guideModal = {
    open(nextSlides, key, after = null) {
      slides = nextSlides;
      seenKey = key;
      onClose = after;
      index = 0;
      render();
      el.hidden = false;
    },
    openIfFirstTime(nextSlides, key, after = null) {
      if (storage.get(GUIDE_SEEN_PREFIX + key, false)) return false;
      this.open(nextSlides, key, after);
      return true;
    },
    hide() { el.hidden = true; },
    get isOpen() { return !el.hidden; },
  };
  return guideModal;
}

const RULE_TEXT = Object.freeze({
  '1d': (problem, params) => ['📌 1D 規則：在整條曲線上找最高的那一點',
    '🐾 動物站在曲線上的一個位置 x', `🔀 鄰居＝左右各隔 s=${params.step1d} 格的 2 個位置`],
  '2d': (problem, params) => ['📌 2D 規則：在地形圖上找最高的那一格（越白越高）',
    '🐾 動物站在地圖上的一格', `🔀 鄰居＝周圍 8 個方向、各隔 s=${params.step2d} 格的位置`],
  tsp: (problem) => ['📌 TSP 規則：每座城市去一次、最後回到 🏠，總長度越短越好',
    '🐾 動物站的位置＝一整條路線（越短＝越高）', `🔀 鄰居＝挑 2 條線剪斷、倒過來接回的路線，這張圖有 ${neighbourCount(problem)} 種`],
});

/** Collapsible rule summary above the learn-page canvas (all problem types). */
function createRuleSummary(onReplay) {
  const head = h('summary', null);
  const content = h('div', { class: 'tsp-summary-body' });
  const el = h('details', { class: 'tsp-summary', open: true }, head, content);
  return {
    el,
    update(problem, params) {
      const [title, ...items] = RULE_TEXT[problem.type](problem, params);
      head.textContent = title;
      content.replaceChildren(...items.map((t) => h('span', null, t)),
        h('button', { type: 'button', class: 'help-btn', onClick: () => onReplay(problem) }, '(?) 重看導覽'));
    },
  };
}
