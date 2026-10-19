// ---------- TSP small multiples: one square map per animal (spec v1.2, item 4) ----------
function createTspTrio() {
  const grid = h('div', { class: 'trio' });
  let slots = new Map();
  let order = '';
  let problem = null;
  let showAnswer = false;

  function makeSlot(algo) {
    const canvas = h('canvas', { class: 'square-canvas', 'aria-label': `${ALGOS[algo].animal}的路線` });
    const view = new MapView(canvas, { square: true, showCandidates: true });
    view.setProblem(problem);
    view.showAnswer = showAnswer;
    const label = h('span', { class: 'trio-value' });
    const el = h('div', { class: 'trio-slot', style: `--agent:${ALGOS[algo].color}` },
      h('div', { class: 'trio-head' }, agentImg(algo, 26), h('strong', null, ALGOS[algo].animal), label), canvas);
    return { view, label, el };
  }

  function rebuild(algos) {
    slots.forEach((s) => s.view.destroy());
    slots = new Map(algos.map((a) => [a, makeSlot(a)]));
    grid.replaceChildren(...[...slots.values()].map((s) => s.el));
    order = algos.join(',');
  }

  return {
    el: grid,
    setProblem(next) {
      problem = next;
      rebuild([]);
    },
    setShowAnswer(value) {
      showAnswer = value;
      slots.forEach((s) => { s.view.showAnswer = value; });
    },
    update(runs) {
      const algos = runs.map((r) => r.algo);
      if (algos.join(',') !== order) rebuild(algos);
      runs.forEach((r) => {
        const slot = slots.get(r.algo);
        slot.view.setAgents([{ key: r.algo, run: r }]);
        slot.label.textContent = `目前 ${fmt1(r.state.current.display)}｜最佳 ${fmt1(r.state.best.display)}${r.state.stopped ? ' 💤' : ''}`;
      });
    },
  };
}
