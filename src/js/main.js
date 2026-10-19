// ---------- App shell: tabs, hash routing, keyboard shortcuts (spec 3, F-01, F-54) ----------
const TABS = Object.freeze([
  { id: 'learn', label: '學習', short: '📖 學習', create: createLearnPage },
  { id: 'compare', label: '比較', short: '⚖️ 比較', create: createComparePage },
  { id: 'challenge', label: '挑戰', short: '🏆 挑戰', create: createChallengePage },
]);
const KEY_ACTIONS = Object.freeze({ ' ': 'toggle', ArrowRight: 'step', ArrowLeft: 'back', r: 'reset', R: 'reset' });

function startApp() {
  const main = document.getElementById('app');
  const nav = document.getElementById('tabs');
  const pages = {};
  let active = null;
  document.getElementById('brand-icons').replaceChildren(...ALGO_KEYS.map((k) => agentImg(k, 40)));

  const buttons = TABS.map((tab) => h('a', {
    href: `#${tab.id}`, class: 'tab', role: 'tab', 'data-tab': tab.id,
  }, h('span', { class: 'tab-long' }, tab.label), h('span', { class: 'tab-short' }, tab.short)));
  nav.replaceChildren(...buttons);

  function show(id) {
    const tab = TABS.find((t) => t.id === id) || TABS[0];
    if (active && active.id === tab.id) return;
    if (active) {
      pages[active.id].deactivate();
      pages[active.id].el.hidden = true;
    }
    if (!pages[tab.id]) {
      pages[tab.id] = tab.create();
      main.append(pages[tab.id].el);
    }
    pages[tab.id].el.hidden = false;
    if (pages[tab.id].activate) pages[tab.id].activate();
    active = tab;
    buttons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab.id)));
  }

  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  document.addEventListener('keydown', (e) => {
    const action = KEY_ACTIONS[e.key];
    if (!action || !active || isEditableTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.guide-overlay:not([hidden])') || document.querySelector('.coach-bubble')) return;
    if (e.target instanceof HTMLButtonElement && e.key === ' ') return;
    e.preventDefault();
    pages[active.id].onKey(action);
  });
  document.getElementById('tour-btn').addEventListener('click', () => startSiteTour(() => pages.learn && pages.learn.openGuideIfFirstTime()));
  document.getElementById('reset-btn').addEventListener('click', resetProgress);
  show(location.hash.slice(1) || 'learn');
  if (siteTourPending()) startSiteTour(() => pages.learn && pages.learn.openGuideIfFirstTime());
}

document.addEventListener('DOMContentLoaded', startApp);
