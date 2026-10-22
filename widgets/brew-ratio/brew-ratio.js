/**
 * Brew ratio calculator widget. Authors paste one link; the query string sets it up:
 *   /widgets/brew-ratio/brew-ratio.html?method=pour-over&dose=20
 *   /widgets/brew-ratio/brew-ratio.html?method=espresso&mode=water&water=40
 * Parameters (all optional): method (espresso, pour-over, french-press, cold-brew),
 * mode (coffee or water: which amount you start from), dose (g coffee), water (g), ratio (1:N).
 */

export const METHODS = {
  espresso: {
    label: 'Espresso', ratio: 2, dose: 18, min: 1.5, max: 3, step: 0.1, cup: 36, note: 'Pull in 25 to 30 seconds.',
  },
  'pour-over': {
    label: 'Pour-over', ratio: 16, dose: 20, min: 14, max: 18, step: 0.5, cup: 250, note: 'Bloom with twice the coffee weight in water for 30 seconds.',
  },
  'french-press': {
    label: 'French press', ratio: 15, dose: 30, min: 12, max: 17, step: 0.5, cup: 250, note: 'Steep 4 minutes, then press slowly.',
  },
  'cold-brew': {
    label: 'Cold brew', ratio: 8, dose: 100, min: 4, max: 10, step: 0.5, cup: 250, note: 'Steep 12 to 18 hours in the fridge; dilute to taste.',
  },
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const FONTS = 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;700&family=Schibsted+Grotesk:wght@700;800&display=swap';
// Largest sensible amounts, so the field cannot run away (grams)
export const MAX_AMOUNT = { coffee: 500, water: 5000 };
const snap = (r, step) => Math.round(Math.round(r / step) * step * 10) / 10;
const grams = (n) => `${n.toLocaleString('en-US')} g`;
const num = (v) => (v === undefined || v === '' ? NaN : Number(v));

/**
 * The other amount for a ratio of 1:N. Starting from coffee gives the water, and starting from
 * water gives the coffee. Coffee to 0.1 g, water to whole grams.
 */
export function brewPlan({ mode, amount, ratio }) {
  const a = Math.max(0, Number(amount) || 0);
  const r = Math.max(0.1, Number(ratio) || 1);
  const coffee = mode === 'water' ? Math.round((a / r) * 10) / 10 : Math.round(a * 10) / 10;
  const water = mode === 'water' ? Math.round(a) : Math.round(a * r);
  return { coffee, water };
}

/** Starting state from the widget's data- attributes, with sensible fallbacks. */
export function initialState(dataset) {
  const method = Object.hasOwn(METHODS, dataset.method ?? '') ? dataset.method : 'pour-over';
  const m = METHODS[method];
  const mode = dataset.mode === 'water' ? 'water' : 'coffee';
  // The slider moves in steps, so the starting ratio snaps to one
  const ratio = snap(clamp(Number.isFinite(num(dataset.ratio)) ? num(dataset.ratio) : m.ratio, m.min, m.max), m.step);
  const fallback = mode === 'water' ? m.dose * m.ratio : m.dose;
  const given = num(mode === 'water' ? dataset.water : dataset.dose);
  return {
    method, mode, ratio, amount: Number.isFinite(given) && given > 0 ? Math.min(given, MAX_AMOUNT[mode]) : fallback,
  };
}

const fmtRatio = (r) => `1:${Number.isInteger(r) ? r : r.toFixed(1)}`;

export default function decorate(widget) {
  // Fonts load alongside, never holding the widget back
  if (!document.querySelector(`link[href="${FONTS}"]`)) {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONTS });
    document.head.append(link);
  }
  let state = initialState(widget.dataset);
  let announceTimer;
  const q = (sel) => widget.querySelector(sel);
  const amount = q('[data-amount]');
  const ratio = q('[data-ratio]');

  q('[data-methods]').replaceChildren(...Object.entries(METHODS).map(([id, m]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'brew__seg-btn';
    b.dataset.method = id;
    b.textContent = m.label;
    return b;
  }));

  function render() {
    const m = METHODS[state.method];
    const plan = brewPlan(state);
    widget.querySelectorAll('[data-method]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.method === state.method)));
    widget.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
    Object.assign(ratio, {
      min: m.min, max: m.max, step: m.step, value: state.ratio,
    });
    ratio.setAttribute('aria-valuetext', fmtRatio(state.ratio));
    q('[data-ratio-out]').textContent = fmtRatio(state.ratio);
    q('[data-amount-label]').textContent = state.mode === 'water' ? 'Water' : 'Coffee';
    amount.step = state.mode === 'water' ? '10' : '0.5';
    amount.min = '0';
    amount.max = String(MAX_AMOUNT[state.mode]);
    if (document.activeElement !== amount) amount.value = state.amount;
    const cups = Math.max(1, Math.round(plan.water / m.cup));
    q('[data-result-label]').textContent = state.mode === 'water' ? 'Coffee' : 'Water';
    q('[data-result-value]').textContent = grams(state.mode === 'water' ? plan.coffee : plan.water);
    q('[data-result-note]').textContent = `${grams(plan.coffee)} coffee to ${grams(plan.water)} water, about ${cups} ${cups === 1 ? 'cup' : 'cups'}. ${m.note}`;
    // Screen readers hear the answer once typing pauses, not the whole card on every keystroke
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      q('[data-announce]').textContent = state.mode === 'water' ? `${grams(plan.coffee)} coffee` : `${grams(plan.water)} water`;
    }, 400);
  }

  widget.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.method) {
      const m = METHODS[btn.dataset.method];
      state = {
        ...state, method: btn.dataset.method, ratio: m.ratio, amount: state.mode === 'water' ? m.dose * m.ratio : m.dose,
      };
    } else if (btn.dataset.mode && btn.dataset.mode !== state.mode) {
      // Keep the same brew: the amount that was the result becomes the starting amount
      const plan = brewPlan(state);
      state = { ...state, mode: btn.dataset.mode, amount: btn.dataset.mode === 'water' ? plan.water : plan.coffee };
    }
    render();
  });
  amount.addEventListener('input', () => {
    state = { ...state, amount: clamp(Number(amount.value) || 0, 0, MAX_AMOUNT[state.mode]) };
    render();
  });
  // Leaving the field shows the amount actually used (empty, negative or too large is corrected)
  amount.addEventListener('blur', () => { amount.value = state.amount; });
  ratio.addEventListener('input', () => {
    state = { ...state, ratio: Number(ratio.value) };
    render();
  });
  render();
}
