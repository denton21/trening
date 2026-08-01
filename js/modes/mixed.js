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

  /** Номиналы фишек (как «на 1 / 2 / 5» в зале). */
  const DENOM = {
    easy: [1, 5],
    medium: [1, 2, 5],
    hard: [1, 2, 5]
  };

  const LEVEL = {
    easy: {
      minSlots: 2,
      maxSlots: 4,
      maxChips: 3,
      // шанс второго стека другого номинала на том же слоте
      dualChance: 0.15,
      maxDual: 1
    },
    medium: {
      minSlots: 3,
      maxSlots: 6,
      maxChips: 5,
      dualChance: 0.35,
      maxDual: 2
    },
    hard: {
      minSlots: 5,
      maxSlots: 9,
      maxChips: 7,
      dualChance: 0.55,
      maxDual: 4
    }
  };

  const state = {
    level: 'easy',
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
    levelButtons: $$('#mixedLevelChoices button'),
    startBtn: $('#mixedStartBtn'),
    resetBtn: $('#mixedResetBtn'),
    answerForm: $('#mixedAnswerForm'),
    answer: $('#mixedAnswer'),
    answerBtn: $('#mixedAnswerBtn'),
    message: $('#mixedMessage'),
    task: $('#mixedTask'),
    board: $('#mixedBoard'),
    grid: $('#mixedGrid'),
    chips: $('#mixedChips'),
    winLabel: $('#mixedWinLabel'),
    zero: $('#mixedZero'),
    retryActions: $('#mixedRetryActions'),
    retryBtn: $('#mixedRetryBtn'),
    skipBtn: $('#mixedSkipBtn'),
    correctCount: $('#mixedCorrectCount'),
    wrongCount: $('#mixedWrongCount'),
    lastTime: $('#mixedLastTime')
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

  function pickDenom(pool, exclude) {
    const options = exclude == null ? pool : pool.filter((v) => v !== exclude);
    if (!options.length) {
      return pool[randInt(0, pool.length - 1)];
    }
    return options[randInt(0, options.length - 1)];
  }

  function formatSeconds(ms) {
    return `${(ms / 1000).toFixed(1)} с`;
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

  /** Три улицы вокруг выпавшего числа (или 1–9 / 28–36 у краёв). */
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

  /**
   * Стек: count штук номинала value на слоте type.
   * Выплата стека = count × value × payout(type).
   */
  function makeStack(slot, value, count, offsetIndex) {
    // Небольшое смещение, если на одном слоте два номинала
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

  function pickLayout(level) {
    const cfg = LEVEL[level] || LEVEL.easy;
    const denoms = DENOM[level] || DENOM.easy;
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
      randInt(cfg.minSlots, Math.min(cfg.maxSlots, available.length))
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
    while (chosen.length < Math.min(cfg.minSlots, available.length)) {
      const next = available.find((s) => !chosen.some((c) => c.key === s.key));
      if (!next) {
        break;
      }
      chosen.push(next);
    }

    // Гарантируем минимум 2 разных номинала на поле (если слотов ≥ 2)
    const usedValues = new Set();
    let dualLeft = cfg.maxDual;
    const chips = [];

    chosen.forEach((slot, index) => {
      let value;
      if (index === 0) {
        value = pickDenom(denoms);
      } else if (index === 1 && usedValues.size < 2 && denoms.length > 1) {
        // второй стек — другой номинал, чтобы микс был всегда
        value = pickDenom(denoms, [...usedValues][0]);
      } else {
        value = pickDenom(denoms);
      }
      usedValues.add(value);
      const count = randInt(1, cfg.maxChips);
      chips.push(makeStack(slot, value, count, 0));

      // Второй номинал на том же слоте (реализм: 1-ки и 5-ки вместе)
      if (
        dualLeft > 0 &&
        denoms.length > 1 &&
        Math.random() < cfg.dualChance
      ) {
        const other = pickDenom(denoms, value);
        const otherCount = randInt(1, Math.max(1, Math.ceil(cfg.maxChips * 0.7)));
        chips.push(makeStack(slot, other, otherCount, 1));
        usedValues.add(other);
        dualLeft -= 1;
      }
    });

    // Если всё же один номинал (мало слотов + неудачный dual) — перекрасим один стек
    if (usedValues.size < 2 && chips.length >= 2 && denoms.length > 1) {
      const first = chips[0].value;
      const other = pickDenom(denoms, first);
      chips[1].value = other;
    }

    const answer = chips.reduce(
      (sum, chip) => sum + chip.count * chip.value * payoutOf(chip.type),
      0
    );

    return { winNumber, grid, chips, answer };
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
    chips.forEach((chip, index) => {
      const el = document.createElement('span');
      const layers = Math.min(chip.count, 5);
      el.className = `chip chip-3d has-count chip-v${chip.value}`;
      el.style.left = `${chip.x}%`;
      el.style.top = `${chip.y}%`;
      el.style.setProperty('--i', String(index));
      el.style.setProperty('--layers', String(layers));
      el.title = `${chip.count} × ${chip.value} · ${chip.type} ×${payoutOf(chip.type)}`;
      el.setAttribute(
        'aria-label',
        `${chip.count} фишек по ${chip.value}, ${chip.type}`
      );

      // 3D-слойки стека
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
      badge.textContent = String(chip.value);
      el.appendChild(badge);

      els.chips.appendChild(el);
    });
  }

  function renderLayout(layout) {
    state.answer = layout.answer;
    state.questionStartedAt = Date.now();
    state.awaitingRetry = false;
    const values = [...new Set(layout.chips.map((c) => c.value))].sort((a, b) => a - b);
    state.currentLabel = `3D · ${layout.winNumber} · ${layout.chips.length} стек. · ${values.join('/')}`;
    setRetryVisible(false);

    els.winLabel.textContent = `Выпало: ${layout.winNumber}`;
    renderGrid(layout.grid, layout.winNumber);
    renderChips(layout.chips);
  }

  function persistSettings() {
    if (saveSettings) {
      saveSettings({ mixed: { level: state.level } });
    }
  }

  function presentSummary(correct, wrong, log) {
    const entries = log || state.sessionLog;
    if (!entries.length || !showSessionSummary) {
      return;
    }
    showSessionSummary({
      title: 'Итог: 3D · номиналы',
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

  function nextQuestion() {
    stopTimer();
    const layout = pickLayout(state.level);
    renderLayout(layout);
    els.answer.value = '';
    enableAnswer(true);
    showMessage(els.message, 'Сложите: кол-во × номинал × выплата', '');
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

  function setLevel(level) {
    state.level = level;
    els.levelButtons.forEach((button) => setPressed(button, button.dataset.level === level));
    persistSettings();
    if (!state.running) {
      showIdleBoard();
      els.answer.value = '';
      disableAnswer();
      showMessage(els.message, 'Нажмите «Старт»', '');
    }
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

  Trainer.stopMixed = function stopMixed() {
    stopTimer();
    state.running = false;
    state.awaitingRetry = false;
  };

  Trainer.initMixed = function initMixed() {
    if (!els.startBtn) {
      return;
    }

    if (getSettings) {
      const saved = getSettings().mixed || {};
      if (saved.level && LEVEL[saved.level]) {
        state.level = saved.level;
      }
      els.levelButtons.forEach((button) => setPressed(button, button.dataset.level === state.level));
    }

    els.levelButtons.forEach((button) => {
      button.addEventListener('click', () => setLevel(button.dataset.level));
    });
    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', reset);
    els.answerForm.addEventListener('submit', onSubmit);
    els.retryBtn.addEventListener('click', onRetry);
    els.skipBtn.addEventListener('click', onSkip);
    reset();
  };
})();
