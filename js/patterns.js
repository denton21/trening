window.Trainer = window.Trainer || {};

// Координаты %: street 0–15%, 0 сверху 0–18%, сетка 3×3.
// Выплаты без возврата ставки: straight 35, split 17, street/trio 11, corner 8, sixline 5.
const G = {
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

Trainer.G = G;

Trainer.PAYOUT = {
  straight: 35,
  split: 17,
  street: 11,
  trio: 11,
  corner: 8,
  sixline: 5
};

const COLS = [G.c1, G.c2, G.c3];
const ROWS = [G.r1, G.r2, G.r3];
const VLINES = [G.vl1, G.vl2];
const HLINES = [G.hl1, G.hl2];

Trainer.BOARD = { COLS, ROWS, VLINES, HLINES };

/**
 * Слоты, которые выигрывают при выпавшем 0.
 * Street 1-2-3 не выигрывает. Trio 0-1-2 / 0-2-3 = ×11, first four = ×8.
 */
Trainer.winningSlotsForZero = function winningSlotsForZero() {
  return [
    { type: 'straight', x: G.c2, y: G.zero, key: 'straight-0' },
    { type: 'split', x: G.c1, y: G.zh, key: 'split-0-1' },
    { type: 'split', x: G.c2, y: G.zh, key: 'split-0-2' },
    { type: 'split', x: G.c3, y: G.zh, key: 'split-0-3' },
    { type: 'trio', x: G.vl1, y: G.zh, key: 'trio-0-1-2' },
    { type: 'trio', x: G.vl2, y: G.zh, key: 'trio-0-2-3' },
    { type: 'corner', x: G.st, y: G.zh, key: 'first4-0-1-2-3' }
  ];
};

/**
 * Слоты, которые выигрывают при выпавшем числе в ячейке 3×3 (col 0–2, row 0–2).
 * Не больше одного street и максимум двух sixline, соседних с этой улицей.
 */
Trainer.winningSlotsForCell = function winningSlotsForCell(ci, ri) {
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

  slots.push({ type: 'street', x: G.st, y: ROWS[ri], key: `street-${ri}` });

  if (ri > 0) {
    slots.push({ type: 'sixline', x: G.st, y: HLINES[ri - 1], key: `sixU-${ri}` });
  }
  if (ri < 2) {
    slots.push({ type: 'sixline', x: G.st, y: HLINES[ri], key: `sixD-${ri}` });
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
    : Trainer.winningSlotsForCell(ci, ri);

  const target = Math.min(
    available.length,
    minSlots + Math.floor(Math.random() * (Math.min(maxSlots, available.length) - minSlots + 1))
  );

  const chosen = [];
  const straight = available.find((s) => s.type === 'straight');
  const rest = available.filter((s) => s.type !== 'straight');

  // Fisher–Yates shuffle of rest
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

/**
 * Паттерн для picture bets: по одной фишке на слот, ответ = сумма выплат.
 */
Trainer.generatePicturePattern = function generatePicturePattern() {
  const pick = Trainer.pickWinningSlots({
    minSlots: 2,
    maxSlots: 8,
    zeroChance: 0.1,
    preferStraight: true
  });

  return {
    answer: pick.answer,
    chips: pick.slots.map((slot) => [slot.x, slot.y]),
    meta: {
      isZero: pick.isZero,
      col: pick.col,
      row: pick.row,
      types: pick.slots.map((s) => s.type)
    }
  };
};
