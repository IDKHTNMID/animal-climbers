// ---------- DOM helpers ----------
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const IMAGE_CACHE = new Map();
function agentImage(icon) {
  if (!IMAGE_CACHE.has(icon)) {
    const img = new Image();
    img.src = ASSETS[icon];
    IMAGE_CACHE.set(icon, img);
  }
  return IMAGE_CACHE.get(icon);
}

function agentImg(algo, size) {
  const meta = ALGOS[algo];
  return h('img', { src: ASSETS[meta.icon], alt: meta.animal, width: size, height: size, class: 'agent-img' });
}

/** localStorage wrapper: storage may be blocked, so failures fall back silently to defaults (spec F-95). */
const storage = Object.freeze({
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  },
});

function isEditableTarget(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Temporary message shown above a canvas (e.g. "只能走到相鄰的格子"). */
function createHint() {
  const el = h('div', { class: 'hint', role: 'status', 'aria-live': 'polite' });
  let timer = null;
  return {
    el,
    show(text, ms = 2200) {
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('show'), ms);
    },
  };
}

function segmented(options, selected, onSelect) {
  const buttons = options.map((opt) => h('button', {
    type: 'button', class: 'seg-btn', 'data-id': opt.id, 'aria-pressed': String(opt.id === selected),
    onClick: () => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === opt.id)));
      onSelect(opt.id);
    },
  }, opt.name));
  const el = h('div', { class: 'segmented', role: 'group' }, buttons);
  return {
    el,
    set(id) { buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id))); },
  };
}
