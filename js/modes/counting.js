window.Trainer = window.Trainer || {};

(function () {
  const {
    $,
    $$,
    setPressed,
    bumpStat,
    flashAnswer,
    flashTask,
    showMessage,
    winningSlotsForZero,
    winningSlotsForCell,
    payoutOf,
    getSettings,
    saveSettings,
    pushSessionAttempt,
    showSessionSummary
  } = Trainer;

  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

  const ALL_DENOMS = [1, 2, 5];

  const SLOT_PRESETS = [
    { id: 'few', label: '2–4', minSlots: 2, maxSlots: 4 },
    { id: 'mid', label: '3–6', minSlots: 3, maxSlots: 6 },
    { id: 'many', label: '4–8', minSlots: 4, maxSlots: 8 },
    { id: 'max', label: '6–11', minSlots: 6, maxSlots: 11 }
  ];

  const CHIP_PRESETS = [
    { id: '3', label: 'до 3', maxChips: 3 },
    { id: '5', label: 'до 5', maxChips: 5 },
    { id: '7', label: 'до 7', maxChips: 7 },
    { id: '10', label: 'до 10', maxChips: 10 },
    { id: '20', label: 'до 20', maxChips: 20 },
    { id: '30', label: 'до 30', maxChips: 30 }
  ];

  const DUAL_MODES = {
    off: { dualChance: 0, maxDual: 0, label: 'Выкл' },
    rare: { dualChance: 0.2, maxDual: 2, label: 'Редко' },
    often: { dualChance: 0.55, maxDual: 5, label: 'Часто' }
  };

  const DEFAULT_CFG = {
    denoms: [1],
    slotsId: 'few',
    chipsId: '3',
    dualMode: 'off'
  };

  const state = {
    denoms: DEFAULT_CFG.denoms.slice(),
    slotsId: DEFAULT_CFG.slotsId,
    chipsId: DEFAULT_CFG.chipsId,
    dualMode: DEFAULT_CFG.dualMode,
    answer: 0,
    running: false,
    nextTimer: null,
    questionStartedAt: null,
    correct: 0,
    wrong: 0,
    lastMs: null,
    awaitingRetry: false,
    sessionLog: [],
    currentLabel: '—'
  };

  const els = {
    denomButtons: $$('#countingDenomChoices button'),
    slotsButtons: $$('#countingSlotsChoices button'),
    chipsButtons: $$('#countingChipsChoices button'),
    dualButtons: $$('#countingDualChoices button'),
    legend: $('#countingLegend'),
    startBtn: $('#countingStartBtn'),
    resetBtn: $('#countingResetBtn'),
    answerForm: $('#countingAnswerForm'),
    answer: $('#countingAnswer'),
    answerBtn: $('#countingAnswerBtn'),
    message: $('#countingMessage'),
    task: $('#countingTask'),
    board: $('#countingBoard'),
    grid: $('#countingGrid'),
    chips: $('#countingChips'),
    winLabel: $('#countingWinLabel'),
    zero: $('#countingZero'),
    retryActions: $('#countingRetryActions'),
    retryBtn: $('#countingRetryBtn'),
    skipBtn: $('#countingSkipBtn'),
    correctCount: $('#countingCorrectCount'),
    wrongCount: $('#countingWrongCount'),
    lastTime: $('#countingLastTime')
  };

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function formatSeconds(ms) {
    return `${(ms / 1000).toFixed(1)} с`;
  }

  function slotsCfg() {
    return SLOT_PRESETS.find((p) => p.id === state.slotsId) || SLOT_PRESETS[0];
  }

  function chipsCfg() {
    return CHIP_PRESETS.find((p) => p.id === state.chipsId) || CHIP_PRESETS[0];
  }

  function dualCfg() {
    return DUAL_MODES[state.dualMode] || DUAL_MODES.off;
  }

  function activeDenoms() {
    const list = state.denoms.filter((v) => ALL_DENOMS.includes(v));
    return list.length ? list.slice().sort((a, b) => a - b) : [1];
  }

  function pickDenom(pool, exclude) {
    const options = exclude == null ? pool : pool.filter((v) => v !== exclude);
    if (!options.length) {
      return pool[randInt(0, pool.length - 1)];
    }
    return options[randInt(0, options.length - 1)];
  }

  function updateStats() {
    els.correctCount.textContent = state.correct;
    els.wrongCount.textContent = state.wrong;
    els.lastTime.textContent = state.lastMs == null ? '—' : formatSeconds(state.lastMs);
  }

  function stopTimer() {
    if (state.nextTimer) {
      window.clearTimeout(state.nextTimer);
      state.nextTimer = null;
    }
  }

  function setRetryVisible(visible) {
    els.retryActions.classList.toggle('hidden', !visible);
  }

  function cellColorClass(number) {
    if (number === 0) {
      return '';
    }
    return RED.has(number) ? 'is-red' : 'is-black';
  }

  function buildNumberGrid(winNumber) {
    if (winNumber === 0) {
      return {
        numbers: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9]
        ],
        winCol: null,
        winRow: null,
        isZero: true,
        showZero: true,
        firstStreet: 0
      };
    }

    const streetIndex = Math.floor((winNumber - 1) / 3);
    let firstStreet = streetIndex - 1;
    if (firstStreet < 0) {
      firstStreet = 0;
    }
    if (firstStreet > 9) {
      firstStreet = 9;
    }

    const numbers = [0, 1, 2].map((rowOffset) => {
      const base = (firstStreet + rowOffset) * 3 + 1;
      return [base, base + 1, base + 2];
    });

    let winRow = 0;
    let winCol = 0;
    numbers.forEach((row, ri) => {
      row.forEach((n, ci) => {
        if (n === winNumber) {
          winRow = ri;
          winCol = ci;
        }
      });
    });

    const showZero = firstStreet === 0;

    return {
      numbers,
      winCol,
      winRow,
      isZero: false,
      showZero,
      firstStreet
    };
  }

  /** Стек на слоте; offsetIndex 0/1 — сдвиг, если два номинала рядом. */
  function makeStackPair(slot, value, count, offsetIndex) {
    const dx = offsetIndex === 0 ? -2.2 : offsetIndex === 1 ? 2.2 : 0;
    const dy = offsetIndex === 0 ? -1.6 : offsetIndex === 1 ? 1.6 : 0;
    return {
      type: slot.type,
      key: slot.key,
      x: slot.x + dx,
      y: slot.y + dy,
      count,
      value
    };
  }

  function pickLayout() {
    const slots = slotsCfg();
    const maxChips = chipsCfg().maxChips;
    const dual = dualCfg();
    const denoms = activeDenoms();
    const multiDenom = denoms.length > 1;

    const winNumber = Math.random() < 0.08 ? 0 : randInt(1, 36);
    const grid = buildNumberGrid(winNumber);
    const includeZeroEdge = grid.showZero && !grid.isZero && grid.winRow === 0;
    const available = grid.isZero
      ? winningSlotsForZero()
      : winningSlotsForCell(grid.winCol, grid.winRow, {
          withZero: grid.showZero,
          includeZeroEdge
        });

    const slotCount = Math.min(
      available.length,
      randInt(slots.minSlots, Math.min(slots.maxSlots, available.length))
    );

    const straight = available.find((s) => s.type === 'straight');
    const rest = shuffle(available.filter((s) => s.type !== 'straight'));
    const chosen = [];
    if (straight && Math.random() < 0.85) {
      chosen.push(straight);
    }
    for (const slot of rest) {
      if (chosen.length >= slotCount) {
        break;
      }
      chosen.push(slot);
    }
    while (chosen.length < Math.min(slots.minSlots, available.length)) {
      const next = available.find((s) => !chosen.some((c) => c.key === s.key));
      if (!next) {
        break;
      }
      chosen.push(next);
    }

    const usedValues = new Set();
    let dualLeft = multiDenom ? dual.maxDual : 0;
    const chips = [];

    chosen.forEach((slot, index) => {
      let value;
      if (!multiDenom) {
        value = denoms[0];
      } else if (index === 0) {
        value = pickDenom(denoms);
      } else if (index === 1 && usedValues.size < 2) {
        value = pickDenom(denoms, [...usedValues][0]);
      } else {
        value = pickDenom(denoms);
      }
      usedValues.add(value);
      const count = randInt(1, maxChips);

      const willDual = dualLeft > 0 && multiDenom && Math.random() < dual.dualChance;

      if (willDual) {
        chips.push(makeStackPair(slot, value, count, 0));
        const other = pickDenom(denoms, value);
        const otherCount = randInt(1, Math.max(1, Math.ceil(maxChips * 0.7)));
        chips.push(makeStackPair(slot, other, otherCount, 1));
        usedValues.add(other);
        dualLeft -= 1;
      } else {
        chips.push({
          type: slot.type,
          key: slot.key,
          x: slot.x,
          y: slot.y,
          count,
          value
        });
      }
    });

    // Гарантия микса номиналов на поле
    if (multiDenom && usedValues.size < 2 && chips.length >= 2) {
      const first = chips[0].value;
      const other = pickDenom(denoms, first);
      chips[1].value = other;
    }

    const answer = chips.reduce(
      (sum, chip) => sum + chip.count * chip.value * payoutOf(chip.type),
      0
    );

    return { winNumber, grid, chips, answer, denoms };
  }

  function pulseBoard() {
    if (!els.board) {
      return;
    }
    els.board.classList.remove('is-enter');
    void els.board.offsetWidth;
    els.board.classList.add('is-enter');
  }

  function renderGrid(grid, winNumber) {
    els.board.classList.toggle('no-zero', !grid.showZero);
    els.grid.innerHTML = '';
    grid.numbers.forEach((row) => {
      row.forEach((number) => {
        const cell = document.createElement('div');
        cell.className = `counting-cell ${cellColorClass(number)}`.trim();
        if (number === winNumber) {
          cell.classList.add('is-win');
        }
        cell.textContent = String(number);
        els.grid.appendChild(cell);
      });
    });
    els.zero.classList.toggle('is-win', winNumber === 0);
    els.zero.setAttribute('aria-hidden', grid.showZero ? 'false' : 'true');
    pulseBoard();
  }

  function renderChips(chips) {
    els.chips.innerHTML = '';
    const multi = activeDenoms().length > 1 || chips.some((c) => c.value !== 1);

    chips.forEach((chip, index) => {
      const el = document.createElement('span');
      const layers = Math.min(chip.count, 5);
      const value = chip.value || 1;

      if (multi || value !== 1) {
        el.className = `chip chip-3d has-count chip-v${value}`;
        el.style.left = `${chip.x}%`;
        el.style.top = `${chip.y}%`;
        el.style.setProperty('--i', String(index));
        el.style.setProperty('--layers', String(layers));
        el.title = `${chip.count} × ${value} · ${chip.type} ×${payoutOf(chip.type)}`;
        el.setAttribute('aria-label', `${chip.count} фишек по ${value}, ${chip.type}`);

        const stack = document.createElement('span');
        stack.className = 'chip-3d-stack';
        stack.setAttribute('aria-hidden', 'true');
        for (let L = layers; L >= 1; L -= 1) {
          const disc = document.createElement('span');
          disc.className = 'chip-3d-disc';
          disc.style.setProperty('--l', String(L));
          stack.appendChild(disc);
        }
        el.appendChild(stack);

        const face = document.createElement('span');
        face.className = 'chip-3d-face';
        face.textContent = String(chip.count);
        el.appendChild(face);

        const badge = document.createElement('span');
        badge.className = 'chip-3d-badge';
        badge.textContent = String(value);
        el.appendChild(badge);
      } else {
        // Классика: один номинал ×1 — простая фишка как раньше
        el.className = 'chip has-count';
        el.style.left = `${chip.x}%`;
        el.style.top = `${chip.y}%`;
        el.style.setProperty('--i', String(index));
        el.textContent = String(chip.count);
        el.title = `${chip.count} фиш.`;
      }

      els.chips.appendChild(el);
    });
  }

  function renderLegend() {
    if (!els.legend) {
      return;
    }
    const denoms = activeDenoms();
    const multi = denoms.length > 1 || denoms[0] !== 1;
    els.legend.classList.toggle('hidden', !multi);
    els.legend.innerHTML = denoms
      .map((v) => `<span class="mixed-legend-item chip-v${v}"><i></i>×${v}</span>`)
      .join('');
  }

  function syncUi() {
    const denoms = activeDenoms();

    els.denomButtons.forEach((btn) => {
      const v = Number(btn.dataset.denom);
      setPressed(btn, denoms.includes(v));
    });

    els.slotsButtons.forEach((btn) => {
      setPressed(btn, btn.dataset.slots === state.slotsId);
    });

    els.chipsButtons.forEach((btn) => {
      setPressed(btn, btn.dataset.chips === state.chipsId);
    });

    els.dualButtons.forEach((btn) => {
      setPressed(btn, btn.dataset.dual === state.dualMode);
    });

    // Микс на слоте бесполезен при одном номинале
    const dualDisabled = denoms.length < 2;
    els.dualButtons.forEach((btn) => {
      btn.disabled = dualDisabled;
      btn.classList.toggle('is-disabled', dualDisabled);
    });

    renderLegend();
  }

  function persistSettings() {
    if (!saveSettings) {
      return;
    }
    saveSettings({
      counting: {
        denoms: activeDenoms(),
        slotsId: state.slotsId,
        chipsId: state.chipsId,
        dualMode: state.dualMode
      }
    });
  }

  function toggleDenom(value) {
    const v = Number(value);
    if (!ALL_DENOMS.includes(v)) {
      return;
    }
    const set = new Set(activeDenoms());
    if (set.has(v)) {
      if (set.size <= 1) {
        // нельзя снять последний номинал
        return;
      }
      set.delete(v);
    } else {
      set.add(v);
    }
    state.denoms = [...set].sort((a, b) => a - b);
    if (state.denoms.length < 2 && state.dualMode !== 'off') {
      state.dualMode = 'off';
    }
    syncUi();
    persistSettings();
  }

  function setSlotsId(id) {
    if (!SLOT_PRESETS.some((p) => p.id === id)) {
      return;
    }
    state.slotsId = id;
    syncUi();
    persistSettings();
  }

  function setChipsId(id) {
    if (!CHIP_PRESETS.some((p) => p.id === id)) {
      return;
    }
    state.chipsId = id;
    syncUi();
    persistSettings();
  }

  function setDualMode(mode) {
    if (!DUAL_MODES[mode]) {
      return;
    }
    if (activeDenoms().length < 2 && mode !== 'off') {
      return;
    }
    state.dualMode = mode;
    syncUi();
    persistSettings();
  }

  function renderLayout(layout) {
    state.answer = layout.answer;
    state.questionStartedAt = Date.now();
    state.awaitingRetry = false;
    const values = [...new Set(layout.chips.map((c) => c.value || 1))].sort((a, b) => a - b);
    state.currentLabel = `счёт · ${layout.winNumber} · ${layout.chips.length} стек. · ${values.join('/')}`;
    setRetryVisible(false);

    els.winLabel.textContent = `Выпало: ${layout.winNumber}`;
    renderGrid(layout.grid, layout.winNumber);
    renderChips(layout.chips);
  }

  function presentSummary(correct, wrong, log) {
    const entries = log || state.sessionLog;
    if (!entries.length || !showSessionSummary) {
      return;
    }
    showSessionSummary({
      title: 'Итог: счёт',
      correct: correct != null ? correct : state.correct,
      wrong: wrong != null ? wrong : state.wrong,
      log: entries.slice()
    });
    state.sessionLog = [];
  }

  function showIdleBoard() {
    state.answer = null;
    state.questionStartedAt = null;
    state.awaitingRetry = false;
    setRetryVisible(false);
    els.winLabel.textContent = 'Выпало: —';
    els.grid.innerHTML = '';
    els.chips.innerHTML = '';
    els.board.classList.remove('no-zero');
    els.zero.classList.remove('is-win');
    els.zero.setAttribute('aria-hidden', 'true');
  }

  function enableAnswer(focus = true) {
    els.answer.disabled = false;
    els.answerBtn.disabled = false;
    if (focus) {
      els.answer.focus();
    }
  }

  function disableAnswer() {
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
  }

  function promptMessage() {
    const multi = activeDenoms().length > 1 || activeDenoms()[0] !== 1;
    return multi
      ? 'Сложите: кол-во × номинал × выплата'
      : 'Сложите выплаты по фишкам';
  }

  function nextQuestion() {
    stopTimer();
    const layout = pickLayout();
    renderLayout(layout);
    els.answer.value = '';
    enableAnswer(true);
    showMessage(els.message, promptMessage(), '');
  }

  function start() {
    stopTimer();
    state.running = true;
    state.correct = 0;
    state.wrong = 0;
    state.lastMs = null;
    state.sessionLog = [];
    updateStats();
    nextQuestion();
  }

  function reset() {
    const prevCorrect = state.correct;
    const prevWrong = state.wrong;
    const prevLog = state.sessionLog.slice();
    stopTimer();
    state.running = false;
    state.awaitingRetry = false;
    state.correct = 0;
    state.wrong = 0;
    state.lastMs = null;
    showIdleBoard();
    els.answer.value = '';
    disableAnswer();
    updateStats();
    showMessage(els.message, 'Нажмите «Старт»', '');
    presentSummary(prevCorrect, prevWrong, prevLog);
  }

  function onRetry() {
    if (!state.running || !state.awaitingRetry) {
      return;
    }
    state.awaitingRetry = false;
    setRetryVisible(false);
    els.answer.value = '';
    enableAnswer(true);
    showMessage(els.message, 'Пересчитайте ещё раз', '');
  }

  function onSkip() {
    if (!state.running || !state.awaitingRetry) {
      return;
    }
    showMessage(els.message, `Пропуск · ответ ${state.answer}`, 'bad');
    state.nextTimer = window.setTimeout(() => {
      if (state.running) {
        nextQuestion();
      }
    }, 700);
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!state.running || state.awaitingRetry) {
      return;
    }
    if (els.answer.value.trim() === '') {
      showMessage(els.message, 'Введите сумму', 'bad');
      flashAnswer(els.answer, false);
      return;
    }

    const isCorrect = Number(els.answer.value) === state.answer;
    flashAnswer(els.answer, isCorrect);
    flashTask(els.task, isCorrect);

    if (isCorrect) {
      const elapsed = Math.max(0, Date.now() - state.questionStartedAt);
      state.correct += 1;
      state.lastMs = elapsed;
      pushSessionAttempt(state.sessionLog, state.currentLabel, true, state.questionStartedAt);
      bumpStat(els.correctCount);
      bumpStat(els.lastTime);
      updateStats();
      showMessage(els.message, `Верно · ${formatSeconds(elapsed)}`, 'good');
      disableAnswer();
      state.nextTimer = window.setTimeout(() => {
        if (state.running) {
          nextQuestion();
        }
      }, 900);
    } else {
      state.wrong += 1;
      pushSessionAttempt(state.sessionLog, state.currentLabel, false, state.questionStartedAt);
      bumpStat(els.wrongCount);
      updateStats();
      state.awaitingRetry = true;
      disableAnswer();
      setRetryVisible(true);
      showMessage(els.message, 'Неверно. Пересчитайте или пропустите', 'bad');
    }
  }

  function loadSettings() {
    if (!getSettings) {
      return;
    }
    const saved = getSettings().counting || {};

    // Миграция: старый формат { level: 'easy'|'medium'|'hard' }
    if (saved.level && !saved.denoms) {
      if (saved.level === 'medium') {
        state.denoms = [1, 5];
        state.slotsId = 'mid';
        state.chipsId = '5';
        state.dualMode = 'rare';
      } else if (saved.level === 'hard') {
        state.denoms = [1, 2, 5];
        state.slotsId = 'many';
        state.chipsId = '7';
        state.dualMode = 'often';
      } else {
        state.denoms = [1];
        state.slotsId = 'few';
        state.chipsId = '3';
        state.dualMode = 'off';
      }
      return;
    }

    if (Array.isArray(saved.denoms) && saved.denoms.length) {
      state.denoms = saved.denoms
        .map(Number)
        .filter((v) => ALL_DENOMS.includes(v));
      if (!state.denoms.length) {
        state.denoms = [1];
      }
    }
    if (saved.slotsId && SLOT_PRESETS.some((p) => p.id === saved.slotsId)) {
      state.slotsId = saved.slotsId;
    }
    if (saved.chipsId && CHIP_PRESETS.some((p) => p.id === saved.chipsId)) {
      state.chipsId = saved.chipsId;
    }
    if (saved.dualMode && DUAL_MODES[saved.dualMode]) {
      state.dualMode = saved.dualMode;
    }
    if (state.denoms.length < 2) {
      state.dualMode = 'off';
    }
  }

  Trainer.stopCounting = function stopCounting() {
    stopTimer();
    state.running = false;
    state.awaitingRetry = false;
  };

  Trainer.initCounting = function initCounting() {
    if (!els.startBtn) {
      return;
    }

    loadSettings();
    syncUi();

    els.denomButtons.forEach((button) => {
      button.addEventListener('click', () => toggleDenom(button.dataset.denom));
    });

    els.slotsButtons.forEach((button) => {
      button.addEventListener('click', () => setSlotsId(button.dataset.slots));
    });

    els.chipsButtons.forEach((button) => {
      button.addEventListener('click', () => setChipsId(button.dataset.chips));
    });

    els.dualButtons.forEach((button) => {
      button.addEventListener('click', () => setDualMode(button.dataset.dual));
    });

    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', reset);
    els.answerForm.addEventListener('submit', onSubmit);
    els.retryBtn.addEventListener('click', onRetry);
    els.skipBtn.addEventListener('click', onSkip);
    reset();
  };
})();
