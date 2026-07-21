window.Trainer = window.Trainer || {};

// Координаты %: street 0–15%, 0 сверху 0–18%, сетка 3×3.
// Выплаты без возврата ставки: straight 35, split 17, street/trio 11, corner 8, sixline 5.

/** Геометрия с полосой zero сверху (18%). */
const G_ZERO = {
  st: 7.5,
  c1: 29.2,
  vl1: 43.3,
  c2: 57.5,
  vl2: 71.7,
  c3: 85.8,
  zero: 9,
  zh: 18,
  r1: 31.7,
  hl1: 45.3,
  r2: 59,
  hl2: 72.7,
  r3: 86.3
};

/** Геометрия без zero: сетка 3×3 на всю высоту. */
const G_FULL = {
  st: 7.5,
  c1: 29.2,
  vl1: 43.3,
  c2: 57.5,
  vl2: 71.7,
  c3: 85.8,
  r1: 16.7,
  hl1: 33.3,
  r2: 50,
  hl2: 66.7,
  r3: 83.3
};

// Совместимость: G = с zero (как раньше)
const G = G_ZERO;
Trainer.G = G;
Trainer.G_ZERO = G_ZERO;
Trainer.G_FULL = G_FULL;

Trainer.PAYOUT = {
  straight: 35,
  split: 17,
  street: 11,
  trio: 11,
  corner: 8,
  sixline: 5
};

function geoPack(geo) {
  return {
    geo,
    COLS: [geo.c1, geo.c2, geo.c3],
    ROWS: [geo.r1, geo.r2, geo.r3],
    VLINES: [geo.vl1, geo.vl2],
    HLINES: [geo.hl1, geo.hl2]
  };
}

const PACK_ZERO = geoPack(G_ZERO);
const PACK_FULL = geoPack(G_FULL);

Trainer.BOARD = {
  COLS: PACK_ZERO.COLS,
  ROWS: PACK_ZERO.ROWS,
  VLINES: PACK_ZERO.VLINES,
  HLINES: PACK_ZERO.HLINES
};

/**
 * Слоты, которые выигрывают при выпавшем 0.
 * Street 1-2-3 не выигрывает. Trio 0-1-2 / 0-2-3 = ×11, first four = ×8.
 */
Trainer.winningSlotsForZero = function winningSlotsForZero() {
  const g = G_ZERO;
  return [
    { type: 'straight', x: g.c2, y: g.zero, key: 'straight-0' },
    { type: 'split', x: g.c1, y: g.zh, key: 'split-0-1' },
    { type: 'split', x: g.c2, y: g.zh, key: 'split-0-2' },
    { type: 'split', x: g.c3, y: g.zh, key: 'split-0-3' },
    { type: 'trio', x: g.vl1, y: g.zh, key: 'trio-0-1-2' },
    { type: 'trio', x: g.vl2, y: g.zh, key: 'trio-0-2-3' },
    { type: 'corner', x: g.st, y: g.zh, key: 'first4-0-1-2-3' }
  ];
};

/**
 * Слоты zero-границы, выигрывающие при 1 / 2 / 3
 * (верхний ряд сетки 1–2–3, ri === 0).
 */
function zeroEdgeSlotsForCell(ci) {
  const g = G_ZERO;
  const COLS = PACK_ZERO.COLS;
  const slots = [];

  // split 0–N
  slots.push({
    type: 'split',
    x: COLS[ci],
    y: g.zh,
    key: `split-0-${ci + 1}`
  });

  // trio 0-1-2 covers 1 and 2
  if (ci === 0 || ci === 1) {
    slots.push({ type: 'trio', x: g.vl1, y: g.zh, key: 'trio-0-1-2' });
  }
  // trio 0-2-3 covers 2 and 3
  if (ci === 1 || ci === 2) {
    slots.push({ type: 'trio', x: g.vl2, y: g.zh, key: 'trio-0-2-3' });
  }

  // first four 0-1-2-3 covers all of 1,2,3
  slots.push({
    type: 'corner',
    x: g.st,
    y: g.zh,
    key: 'first4-0-1-2-3'
  });

  return slots;
}

/**
 * Слоты, которые выигрывают при выпавшем числе в ячейке 3×3 (col 0–2, row 0–2).
 * options.withZero — есть полоса 0 сверху (и координаты с учётом 18%).
 * options.includeZeroEdge — добавить сплиты/трио/first four с 0
 *   (только если верхний ряд = 1–2–3 и ri === 0).
 */
Trainer.winningSlotsForCell = function winningSlotsForCell(ci, ri, options = {}) {
  const withZero = options.withZero !== false;
  const includeZeroEdge = Boolean(options.includeZeroEdge);
  const pack = withZero ? PACK_ZERO : PACK_FULL;
  const { geo, COLS, ROWS, VLINES, HLINES } = pack;
  const slots = [];

  slots.push({
    type: 'straight',
    x: COLS[ci],
    y: ROWS[ri],
    key: `straight-${ci}-${ri}`
  });

  if (ci > 0) {
    slots.push({ type: 'split', x: VLINES[ci - 1], y: ROWS[ri], key: `hsL-${ci}-${ri}` });
  }
  if (ci < 2) {
    slots.push({ type: 'split', x: VLINES[ci], y: ROWS[ri], key: `hsR-${ci}-${ri}` });
  }
  if (ri > 0) {
    slots.push({ type: 'split', x: COLS[ci], y: HLINES[ri - 1], key: `vsU-${ci}-${ri}` });
  }
  if (ri < 2) {
    slots.push({ type: 'split', x: COLS[ci], y: HLINES[ri], key: `vsD-${ci}-${ri}` });
  }

  if (ci > 0 && ri > 0) {
    slots.push({ type: 'corner', x: VLINES[ci - 1], y: HLINES[ri - 1], key: `cUL-${ci}-${ri}` });
  }
  if (ci < 2 && ri > 0) {
    slots.push({ type: 'corner', x: VLINES[ci], y: HLINES[ri - 1], key: `cUR-${ci}-${ri}` });
  }
  if (ci > 0 && ri < 2) {
    slots.push({ type: 'corner', x: VLINES[ci - 1], y: HLINES[ri], key: `cDL-${ci}-${ri}` });
  }
  if (ci < 2 && ri < 2) {
    slots.push({ type: 'corner', x: VLINES[ci], y: HLINES[ri], key: `cDR-${ci}-${ri}` });
  }

  slots.push({ type: 'street', x: geo.st, y: ROWS[ri], key: `street-${ri}` });

  if (ri > 0) {
    slots.push({ type: 'sixline', x: geo.st, y: HLINES[ri - 1], key: `sixU-${ri}` });
  }
  if (ri < 2) {
    slots.push({ type: 'sixline', x: geo.st, y: HLINES[ri], key: `sixD-${ri}` });
  }

  // Сплиты / трио / first four между 0 и 1–2–3
  if (includeZeroEdge && withZero && ri === 0) {
    slots.push(...zeroEdgeSlotsForCell(ci));
  }

  return slots;
};

Trainer.payoutOf = function payoutOf(type) {
  return Trainer.PAYOUT[type] || 0;
};

/**
 * Случайный валидный набор слотов (одна выигрышная позиция: 0 или ячейка 3×3).
 * options: { minSlots, maxSlots, zeroChance, preferStraight }
 */
Trainer.pickWinningSlots = function pickWinningSlots(options = {}) {
  const minSlots = options.minSlots ?? 2;
  const maxSlots = options.maxSlots ?? 8;
  const zeroChance = options.zeroChance ?? 0.12;
  const preferStraight = options.preferStraight !== false;

  const isZero = Math.random() < zeroChance;
  const ci = Math.floor(Math.random() * 3);
  const ri = Math.floor(Math.random() * 3);
  const available = isZero
    ? Trainer.winningSlotsForZero()
    : Trainer.winningSlotsForCell(ci, ri, {
        withZero: true,
        includeZeroEdge: ri === 0
      });

  const target = Math.min(
    available.length,
    minSlots + Math.floor(Math.random() * (Math.min(maxSlots, available.length) - minSlots + 1))
  );

  const chosen = [];
  const straight = available.find((s) => s.type === 'straight');
  const rest = available.filter((s) => s.type !== 'straight');

  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  if (straight && preferStraight && Math.random() < 0.85) {
    chosen.push(straight);
  }

  for (const slot of rest) {
    if (chosen.length >= target) {
      break;
    }
    chosen.push(slot);
  }

  while (chosen.length < Math.min(minSlots, available.length)) {
    const next = available.find((s) => !chosen.some((c) => c.key === s.key));
    if (!next) {
      break;
    }
    chosen.push(next);
  }

  return {
    isZero,
    col: isZero ? null : ci,
    row: isZero ? null : ri,
    slots: chosen,
    answer: chosen.reduce((sum, slot) => sum + Trainer.payoutOf(slot.type), 0)
  };
};
