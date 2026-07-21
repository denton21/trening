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
    payoutOf
  } = Trainer;

  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

  const LEVEL = {
    easy: { minSlots: 2, maxSlots: 4, maxChips: 3 },
    medium: { minSlots: 4, maxSlots: 7, maxChips: 5 },
    hard: { minSlots: 6, maxSlots: 11, maxChips: 8 }
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
    awaitingRetry: false
  };

  const els = {
    levelButtons: $$('#countingLevelChoices button'),
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
        isZero: true
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

    return { numbers, winCol, winRow, isZero: false };
  }

  function pickLayout(level) {
    const cfg = LEVEL[level] || LEVEL.easy;
    const winNumber = Math.random() < 0.08 ? 0 : randInt(1, 36);
    const grid = buildNumberGrid(winNumber);
    const available = grid.isZero
      ? winningSlotsForZero()
      : winningSlotsForCell(grid.winCol, grid.winRow);

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

    const chips = chosen.map((slot) => ({
      ...slot,
      count: randInt(1, cfg.maxChips)
    }));

    const answer = chips.reduce((sum, chip) => sum + chip.count * payoutOf(chip.type), 0);

    return { winNumber, grid, chips, answer };
  }

  function renderGrid(grid, winNumber) {
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
  }

  function renderChips(chips) {
    els.chips.innerHTML = '';
    chips.forEach((chip, index) => {
      const el = document.createElement('span');
      el.className = 'chip has-count';
      el.style.left = `${chip.x}%`;
      el.style.top = `${chip.y}%`;
      el.style.setProperty('--i', String(index));
      el.textContent = String(chip.count);
      el.title = `${chip.count} фиш.`;
      els.chips.appendChild(el);
    });
  }

  function renderLayout(layout) {
    state.answer = layout.answer;
    state.questionStartedAt = Date.now();
    state.awaitingRetry = false;
    setRetryVisible(false);

    els.winLabel.textContent = `Выпало: ${layout.winNumber}`;
    renderGrid(layout.grid, layout.winNumber);
    renderChips(layout.chips);
  }

  function showIdleBoard() {
    state.answer = null;
    state.questionStartedAt = null;
    state.awaitingRetry = false;
    setRetryVisible(false);
    els.winLabel.textContent = 'Выпало: —';
    els.grid.innerHTML = '';
    els.chips.innerHTML = '';
    els.zero.classList.remove('is-win');
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
    showMessage(els.message, 'Сложите выплаты по фишкам', '');
  }

  function start() {
    stopTimer();
    state.running = true;
    state.correct = 0;
    state.wrong = 0;
    state.lastMs = null;
    updateStats();
    nextQuestion();
  }

  function reset() {
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
  }

  function setLevel(level) {
    state.level = level;
    els.levelButtons.forEach((button) => setPressed(button, button.dataset.level === level));
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
      bumpStat(els.wrongCount);
      updateStats();
      state.awaitingRetry = true;
      disableAnswer();
      setRetryVisible(true);
      showMessage(els.message, 'Неверно. Пересчитайте или пропустите', 'bad');
    }
  }

  Trainer.stopCounting = function stopCounting() {
    stopTimer();
    state.running = false;
    state.awaitingRetry = false;
  };

  Trainer.initCounting = function initCounting() {
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
