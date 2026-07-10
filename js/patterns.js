window.Trainer = window.Trainer || {};

// Координаты %: street 0–15%, 0 сверху 0–18%, сетка 3×3.
// Выплаты: straight 35, split 17, street 11, corner 8, line 5; 0 = 35.
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

Trainer.picturePatterns = [
  { answer: 13, chips: [[G.st, G.hl1], [G.vl1, G.hl1]] },
  { answer: 21, chips: [[G.st, G.hl1], [G.st, G.r2], [G.st, G.hl2]] },
  { answer: 28, chips: [[G.st, G.r2], [G.vl1, G.r2]] },
  {
    answer: 100,
    chips: [
      [G.vl1, G.hl1], [G.c2, G.hl1], [G.vl2, G.hl1],
      [G.vl1, G.r2], [G.vl2, G.r2],
      [G.vl1, G.hl2], [G.c2, G.hl2], [G.vl2, G.hl2]
    ]
  },
  { answer: 69, chips: [[G.c2, G.hl1], [G.c2, G.r2], [G.c2, G.hl2]] },
  { answer: 33, chips: [[G.st, G.r1], [G.st, G.r2], [G.st, G.r3]] },
  {
    answer: 135,
    chips: [
      [G.vl1, G.hl1], [G.c2, G.hl1], [G.vl2, G.hl1],
      [G.vl1, G.r2], [G.c2, G.r2], [G.vl2, G.r2],
      [G.vl1, G.hl2], [G.c2, G.hl2], [G.vl2, G.hl2]
    ]
  },
  {
    answer: 101,
    chips: [
      [G.vl1, G.hl1], [G.c2, G.hl1], [G.vl2, G.hl1],
      [G.c2, G.r2],
      [G.vl1, G.hl2], [G.c2, G.hl2], [G.vl2, G.hl2]
    ]
  },
  { answer: 103, chips: [[G.c2, G.hl1], [G.vl1, G.r2], [G.c2, G.r2], [G.vl2, G.r2], [G.c2, G.hl2]] },
  { answer: 40, chips: [[G.st, G.hl2], [G.c2, G.r2]] },
  { answer: 16, chips: [[G.st, G.r1], [G.st, G.hl1]] },
  { answer: 21, chips: [[G.st, G.r1], [G.st, G.hl1], [G.st, G.hl2]] },
  { answer: 68, chips: [[G.vl1, G.hl1], [G.c2, G.hl1], [G.vl2, G.hl1], [G.c2, G.r2]] },
  { answer: 42, chips: [[G.vl1, G.r2], [G.vl2, G.r2], [G.vl1, G.hl1]] },
  { answer: 52, chips: [[G.c2, G.hl1], [G.c2, G.r2]] },
  {
    answer: 116,
    chips: [[G.c2, G.zero], [G.c1, G.r1], [G.c3, G.r1], [G.st, G.r1]]
  },
  {
    answer: 165,
    chips: [
      [G.c2, G.zero],
      [G.c1, G.r1], [G.c2, G.r1], [G.c3, G.r1],
      [G.c2, G.zh],
      [G.vl1, G.zh]
    ]
  },
  { answer: 25, chips: [[G.c2, G.hl1], [G.vl1, G.hl1]] },
  {
    answer: 66,
    chips: [
      [G.vl1, G.hl1], [G.vl2, G.hl1],
      [G.vl1, G.r2], [G.vl2, G.r2],
      [G.vl1, G.hl2], [G.vl2, G.hl2]
    ]
  },
  { answer: 51, chips: [[G.vl1, G.hl1], [G.vl2, G.hl1], [G.c2, G.r2]] },
  {
    answer: 67,
    chips: [
      [G.vl1, G.hl1], [G.vl2, G.hl1],
      [G.c2, G.r2],
      [G.vl1, G.hl2], [G.vl2, G.hl2]
    ]
  },
  {
    answer: 102,
    chips: [
      [G.c1, G.hl1], [G.c2, G.hl1], [G.c3, G.hl1],
      [G.c1, G.hl2], [G.c2, G.hl2], [G.c3, G.hl2]
    ]
  },
  { answer: 69, chips: [[G.c3, G.hl1], [G.c3, G.r2], [G.c3, G.hl2]] },
  { answer: 51, chips: [[G.vl1, G.hl1], [G.c2, G.r2], [G.vl1, G.hl2]] },
  { answer: 50, chips: [[G.c2, G.hl1], [G.c2, G.hl2], [G.vl1, G.hl1], [G.vl1, G.hl2]] },
  { answer: 60, chips: [[G.c2, G.r2], [G.c2, G.hl1], [G.vl1, G.hl1]] },
  { answer: 43, chips: [[G.vl1, G.hl1], [G.c2, G.r2]] },
  { answer: 77, chips: [[G.c2, G.r2], [G.c2, G.hl1], [G.vl1, G.r2], [G.vl2, G.hl1]] },
  { answer: 86, chips: [[G.c2, G.hl1], [G.c2, G.r2], [G.vl2, G.r2], [G.c2, G.hl2]] },
  { answer: 22, chips: [[G.st, G.hl1], [G.c2, G.hl1]] }
];
