// ---------- Site tour: welcome, one slide per algorithm (animated), a page preview, then a hands-on walkthrough (spec v1.5, v1.6) ----------
const SITE_TOUR_KEY = 'site-tour';
const COACH_PAD = 8;
const COACH_ADVANCE_MS = 400;

const ALGO_INTRO = Object.freeze({
  hc: { emoji: '🐐', text: '山羊只往高處走，<b>遇到小山頭就停下來</b>。' },
  sa: { emoji: '🐲', text: '小龍一開始很「熱」，<b>敢往下走</b>去找別的山；慢慢變冷以後，就只往上爬。' },
  ts: { emoji: '🦊', text: '狐狸記得走過的路，<b>不走回頭路</b>；被逼著往前走，就能翻過山谷找到別的山。' },
});

const PAGE_PREVIEW = Object.freeze([
  { icon: '📖', name: '學習', text: '一步一步看牠們怎麼想' },
  { icon: '⚖️', name: '比較', text: '三隻一起比賽' },
  { icon: '🏆', name: '挑戰', text: '換你動手玩' },
]);

const pagePreviewHtml = () => `<div class="page-preview">${PAGE_PREVIEW.map((p) => `<div class="page-preview-item"><span class="page-preview-icon">${p.icon}</span><b>${p.name}</b><span>${p.text}</span></div>`).join('')}</div>`;

const welcomeHtml = () => `<div class="welcome-trio">${ALGO_KEYS.map((k) => `<figure><img src="${ASSETS[ALGOS[k].icon]}" alt="" width="88" height="88"><figcaption><b>${ALGOS[k].animal}</b>${ALGOS[k].name}</figcaption></figure>`).join('')}</div>`;

const SITE_INTRO_SLIDES = [
  { title: '👋 歡迎來到動物登山隊！', svg: welcomeHtml(), html: '三隻動物各代表一種「只看身邊、一步一步找答案」的演算法。接下來一隻一隻認識牠們。' },
  ...ALGO_KEYS.map((key) => ({ title: `${ALGO_INTRO[key].emoji} ${ALGOS[key].animal}：${ALGOS[key].name}`, svg: DEMO_SVGS[key], html: ALGO_INTRO[key].text })),
  { title: '🗺️ 網站有三個頁面', svg: pagePreviewHtml(), html: '接下來帶你實際操作一遍。', finishLabel: '帶我操作一遍' },
];

const activePage = () => [...document.querySelectorAll('#app > div')].find((d) => !d.hidden);
const learnButton = (text) => () => [...activePage().querySelectorAll('.control-bar .btn')].find((b) => b.innerText.includes(text));
const inLearn = (sel) => () => activePage().querySelector(sel);

const COACH_STEPS = Object.freeze([
  { find: inLearn('.col-left'), text: '① 在這裡選問題（1D／2D／TSP）和動物（演算法）。' },
  { find: inLearn('.viz-row'), text: '② 動物在地圖上探索，頭上的泡泡說明牠在想什麼。' },
  { find: learnButton('下一步'), text: '③ 按「⏭ 下一步」走一步試試看。', waitClick: true },
  { find: inLearn('.step-card'), text: '④ 這裡解釋剛剛那一步。「⏮ 上一步」可以倒回、「▶ 播放」會連續執行。' },
  { find: () => document.querySelector('.tabs'), text: '⑤ 「比較」讓三隻一起跑；「挑戰」用遊戲檢驗你學到的。' },
  { find: () => document.querySelector('.header-tools'), text: '⑥ 隨時可以重看導覽，或重置進度重新開始。' },
]);

/** Spotlight + bubble that walks through COACH_STEPS; waits for a click on steps marked waitClick. */
function runCoachMarks(onDone) {
  const spot = h('div', { class: 'coach-spot' });
  const text = h('p', { class: 'coach-text' });
  const counter = h('span', { class: 'coach-count' });
  const prevBtn = h('button', { type: 'button', class: 'btn btn-small' }, '上一步');
  const nextBtn = h('button', { type: 'button', class: 'btn btn-small btn-primary' }, '下一步');
  const skipBtn = h('button', { type: 'button', class: 'help-btn' }, '結束導覽');
  const bubble = h('div', { class: 'coach-bubble', role: 'dialog', 'aria-live': 'polite' },
    text, h('div', { class: 'coach-foot' }, counter, skipBtn, prevBtn, nextBtn));
  document.body.append(spot, bubble);
  let index = 0;
  let target = null;
  let raf = 0;
  let detach = null;

  function place() {
    if (!target || !target.isConnected) return;
    const r = target.getBoundingClientRect();
    Object.assign(spot.style, {
      left: `${r.left - COACH_PAD}px`, top: `${r.top - COACH_PAD}px`, width: `${r.width + COACH_PAD * 2}px`, height: `${r.height + COACH_PAD * 2}px`,
    });
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const below = r.bottom + COACH_PAD + 12 + bh < window.innerHeight;
    const top = below ? r.bottom + COACH_PAD + 12 : Math.max(8, r.top - COACH_PAD - 12 - bh);
    const left = clamp(r.left + r.width / 2 - bw / 2, 8, window.innerWidth - bw - 8);
    Object.assign(bubble.style, { left: `${left}px`, top: `${top}px` });
    raf = requestAnimationFrame(place);
  }

  function finish() {
    cancelAnimationFrame(raf);
    if (detach) detach();
    spot.remove();
    bubble.remove();
    onDone();
  }

  function show(k) {
    if (detach) detach();
    detach = null;
    index = k;
    const step = COACH_STEPS[index];
    // The first steps point at the learn page, so make sure it is showing.
    if (index <= 3) location.hash = 'learn';
    target = step.find();
    if (!target) {
      if (index < COACH_STEPS.length - 1) show(index + 1);
      else finish();
      return;
    }
    target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    text.textContent = step.text;
    counter.textContent = `${index + 1} / ${COACH_STEPS.length}`;
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === COACH_STEPS.length - 1 ? '完成' : step.waitClick ? '跳過這步' : '下一步';
    if (step.waitClick) {
      const onClick = () => setTimeout(() => show(index + 1), COACH_ADVANCE_MS);
      target.addEventListener('click', onClick, { once: true });
      detach = () => target.removeEventListener('click', onClick);
    }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(place);
  }

  prevBtn.addEventListener('click', () => show(Math.max(0, index - 1)));
  nextBtn.addEventListener('click', () => (index === COACH_STEPS.length - 1 ? finish() : show(index + 1)));
  skipBtn.addEventListener('click', finish);
  show(0);
}

/** Intro slides, then (if the user did not skip) the hands-on walkthrough. onDone runs at the very end. */
function startSiteTour(onDone = () => {}) {
  location.hash = 'learn';
  getGuideModal().open(SITE_INTRO_SLIDES, SITE_TOUR_KEY, (finished) => {
    if (finished) runCoachMarks(onDone);
    else onDone();
  });
}

const siteTourPending = () => !storage.get(GUIDE_SEEN_PREFIX + SITE_TOUR_KEY, false);

/** Clears every saved key of this site (guides seen, stars, best scores) after confirmation. */
function resetProgress() {
  const ok = window.confirm('要重置網站進度嗎？\n\n會清除：所有導覽的「已看過」紀錄、調參過關的星星、預測和我當演算法的最佳紀錄。\n清除後網頁會重新載入，並從網站導覽重新開始。');
  if (!ok) return;
  try {
    Object.keys(window.localStorage).filter((k) => k.startsWith('animal-climbers')).forEach((k) => window.localStorage.removeItem(k));
  } catch (err) {
    window.alert('這個瀏覽器不允許存取本機儲存空間，所以沒有可以清除的進度。');
    return;
  }
  location.hash = 'learn';
  location.reload();
}
