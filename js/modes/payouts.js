window.Trainer = window.Trainer || {};

(function () {
  const {
    $,
    $$,
    formatTime,
    setPressed,
    animateExample,
    bumpStat,
    flashAnswer,
    flashTask,
    setProgress,
    showMessage,
    recordAttempt,
    getSettings,
    saveSettings,
    pushSessionAttempt,
    showSessionSummary
  } = Trainer;

  /** Стек = 20 фишек. */
  const STACK_SIZE = 20;
  const EXACT_STACKS = [1, 2, 3, 4, 5];
  const PAYOUT_COLORS = [1, 2, 5, 25];
  const COLOR_25_THROUGHS = [
    1000,
    2000, 2000,
    2500, 2500,
    3000, 3000,
    3500,
    4000,
    4500,
    5000,
    5500, 5500,
    6000,
    7500,
    10000
  ];
  const APPROX_REQUESTS = [
    { label: '1–2 стека', minChips: 12, maxChips: 45 },
    { label: '2–3 стека', minChips: 30, maxChips: 70 },
    { label: '3–4 стека', minChips: 50, maxChips: 90 },
    { label: '4–5 стеков', minChips: 70, maxChips: 110 }
  ];

  /**
   * Через кэш:
   *   кэш = «через N» ÷ цвет
   *   фишки цвета = выплата − кэш
   * Выплата ≤ 1000 — иначе «камаз» фишек гостю.
   */
  const MAX_PAYOUT = 1000;

  function throughBillsForColor(color) {
    // Только купюры, где N/цвет оставляет место под выплату ≤ 1000
    if (color === 1) {
      return [50, 100, 200, 500];
    }
    if (color === 2) {
      return [100, 200, 500, 1000];
    }
    if (color === 25) {
      return COLOR_25_THROUGHS;
    }
    return [100, 200, 500, 1000];
  }

  const cashPart = Trainer.cashPart;
  const colorLeftFromCash = Trainer.colorLeftFromCash;

  /** Купюры: целый кэш, остаток цвета адекватный (не камаз). */
  function cashThroughOptions(color, payout) {
    return throughBillsForColor(color).filter((through) => {
      if (through % color !== 0) {
        return false;
      }
      const cash = cashPart(through, color);
      const left = colorLeftFromCash(payout, through, color);
      if (!Number.isInteger(cash) || !Number.isInteger(left)) {
        return false;
      }
      if (left % color !== 0) {
        return false;
      }
      // кэш ощутимый, цвет > 0 и не больше выплаты; верх — чтобы не возить стеки
      return cash >= 25 && left >= color * 5 && left < payout && left <= 800;
    });
  }

  const randomInt = Trainer.randInt;
  const pick = Trainer.pick;

  /** Выплата, кратная цвету, не больше MAX_PAYOUT. */
  function randomPayout(color, minUnits, maxUnits) {
    const maxByCap = Math.floor(MAX_PAYOUT / color);
    const hi = Math.min(maxUnits, maxByCap);
    const lo = Math.min(minUnits, hi);
    return randomInt(lo, hi) * color;
  }

  function generateCashQuestion(color) {
    if (color === 25) {
      const through = pick(COLOR_25_THROUGHS);
      const cash = cashPart(through, color);
      const maxLeft = Math.min(800, MAX_PAYOUT - cash);
      const colorLeft = randomInt(5, Math.floor(maxLeft / color)) * color;
      const payout = cash + colorLeft;

      return {
        mode: 'cash',
        color,
        payout,
        through,
        cash,
        colorLeft,
        divisor: color,
        exampleKey: `кэш ${payout} через ${through} (×${color})`
      };
    }

    let payout;
    let throughOptions = [];
    let attempts = 0;

    while (throughOptions.length === 0 && attempts < 80) {
      attempts += 1;
      // Выплата 100…1000, кратна цвету
      if (color === 1) {
        payout = randomPayout(1, 100, 1000);
      } else if (color === 2) {
        payout = randomPayout(2, 60, 500);
      } else {
        payout = randomPayout(5, 30, 200);
      }
      throughOptions = cashThroughOptions(color, payout);
    }

    if (throughOptions.length === 0) {
      if (color === 2) {
        payout = 780;
        throughOptions = [500];
      } else if (color === 5) {
        payout = 240;
        throughOptions = [500];
      } else {
        payout = 340;
        throughOptions = [100];
      }
    }

    const through = pick(throughOptions);
    const cash = cashPart(through, color);
    const colorLeft = colorLeftFromCash(payout, through, color);

    return {
      mode: 'cash',
      color,
      payout,
      through,
      cash,
      colorLeft,
      divisor: color,
      exampleKey: `кэш ${payout} через ${through} (×${color})`
    };
  }

  function stackWord(n) {
    if (n === 1) return '1 стек';
    if (n >= 2 && n <= 4) return `${n} стека`;
    return `${n} стеков`;
  }

  /**
   * Выплата в фишках; ~50% точные стеки, ~50% «примерно».
   * кэш = (выплата − chips) × color.
   */
  function generateChipsQuestion(color) {
    const maxPayoutChips = color === 25 ? 280 : color === 5 ? 380 : color === 2 ? 480 : 520;
    const minPayoutChips = color === 5 || color === 25 ? 90 : 70;
    const exact = Math.random() < 0.5;
    let attempts = 0;

    if (exact) {
      let stacks;
      let chips;
      let payout;
      let cash;
      do {
        attempts += 1;
        const maxStacks = color === 5 || color === 25 ? 4 : 5;
        stacks = pick(EXACT_STACKS.filter((n) => n <= maxStacks));
        chips = stacks * STACK_SIZE;
        payout = randomInt(Math.max(minPayoutChips, chips + 20), maxPayoutChips);
        cash = (payout - chips) * color;
      } while ((cash <= 0 || payout <= chips) && attempts < 40);

      if (cash <= 0 || payout <= chips) {
        stacks = 3;
        chips = 60;
        payout = color === 25 ? 187 : color === 5 ? 187 : 241;
        cash = (payout - chips) * color;
      }

      return {
        mode: 'chips',
        color,
        payout,
        requestStyle: 'exact',
        requestLabel: stackWord(stacks),
        stacks,
        minChips: chips,
        maxChips: chips,
        sampleChips: chips,
        sampleCash: cash,
        exampleKey: `фишки ${payout} ${stackWord(stacks)} (×${color})`
      };
    }

    const pool =
      color === 5 || color === 25
        ? [APPROX_REQUESTS[0], APPROX_REQUESTS[1], APPROX_REQUESTS[2]]
        : APPROX_REQUESTS;

    let request = pick(pool);
    let payout;
    let sampleChips;
    let sampleCash;
    attempts = 0;

    do {
      attempts += 1;
      request = pick(pool);
      payout = randomInt(minPayoutChips, maxPayoutChips);
      if (payout - request.maxChips < 10) {
        continue;
      }
      sampleChips = randomInt(request.minChips, Math.min(request.maxChips, payout - 10));
      sampleCash = (payout - sampleChips) * color;
    } while ((sampleCash <= 0 || payout <= request.minChips) && attempts < 50);

    if (sampleCash <= 0 || payout <= request.minChips) {
      request = APPROX_REQUESTS[1];
      payout = color === 25 ? 287 : color === 5 ? 287 : color === 2 ? 313 : 241;
      sampleChips = 50;
      sampleCash = (payout - sampleChips) * color;
    }

    return {
      mode: 'chips',
      color,
      payout,
      requestStyle: 'approx',
      requestLabel: request.label,
      minChips: request.minChips,
      maxChips: Math.min(request.maxChips, payout - 1),
      sampleChips,
      sampleCash,
      exampleKey: `фишки ${payout} ~${request.label} (×${color})`
    };
  }

  const chipsCashFor = Trainer.chipsCashFor;
  const isValidChipsAnswer = Trainer.isValidChipsAnswer;

  function chipsErrorHint(question, chips, cash) {
    const expected = Number.isInteger(chips)
      ? chipsCashFor(question.payout, chips, question.color)
      : null;

    if (!Number.isInteger(chips) || !Number.isInteger(cash)) {
      return 'нужны целые числа';
    }
    if (chips <= 0 || chips >= question.payout) {
      return `фишки от 1 до ${question.payout - 1}`;
    }
    if (chips < question.minChips || chips > question.maxChips) {
      const formulaOk = cash === expected;
      if (question.requestStyle === 'exact') {
        return (
          `нужно ровно ${question.minChips} фишек (${question.requestLabel}), ты: ${chips}` +
          (formulaOk ? ` — кэш ${cash}$ верный, но число фишек другое` : '')
        );
      }
      return (
        `фишки примерно ${question.minChips}–${question.maxChips} (${question.requestLabel}), ты: ${chips}` +
        (formulaOk ? ` — кэш ${cash}$ верный, но возьми фишки в диапазоне` : '')
      );
    }
    if (cash !== expected) {
      return (
        `при ${chips} фишках: (${question.payout}−${chips})×${question.color}=${expected}$, а не ${cash}`
      );
    }
    return (
      `${question.minChips}${question.minChips === question.maxChips ? '' : `–${question.maxChips}`} фишек, ` +
      `кэш=(выплата−фишки)×${question.color} (напр. ${question.sampleChips} → ${question.sampleCash}$)`
    );
  }

  const state = {
    color: 1,
    mode: 'cash',
    duration: 60,
    secondsLeft: 60,
    correct: 0,
    wrong: 0,
    running: false,
    timer: null,
    nextTimer: null,
    question: null,
    lastKey: null,
    questionStartedAt: null,
    sessionLog: []
  };

  const els = {
    colorButtons: $$('#payoutsColorChoices button'),
    modeButtons: $$('#payoutsModeChoices button'),
    timeButtons: $$('#payoutsTimeChoices button'),
    startBtn: $('#payoutsStartBtn'),
    resetBtn: $('#payoutsResetBtn'),
    answerForm: $('#payoutsAnswerForm'),
    answer: $('#payoutsAnswer'),
    chipsAnswer: $('#payoutsChipsAnswer'),
    cashAnswer: $('#payoutsCashAnswer'),
    answerBtn: $('#payoutsAnswerBtn'),
    cashInputs: $('#payoutsCashInputs'),
    chipsInputs: $('#payoutsChipsInputs'),
    example: $('#payoutsExample'),
    detail: $('#payoutsDetail'),
    meta: $('#payoutsMeta'),
    message: $('#payoutsMessage'),
    timeLeft: $('#payoutsTimeLeft'),
    correctCount: $('#payoutsCorrectCount'),
    wrongCount: $('#payoutsWrongCount'),
    timeProgress: $('#payoutsTimeProgress'),
    task: $('#payoutsTask'),
    hint: $('#payoutsHint')
  };

  function updateModeUi() {
    const cashMode = state.mode === 'cash';
    els.cashInputs.classList.toggle('hidden', !cashMode);
    els.chipsInputs.classList.toggle('hidden', cashMode);
    els.meta.textContent = `цвет ×${state.color} · ${cashMode ? 'через кэш' : 'через фишки'}`;

    if (els.hint) {
      if (cashMode) {
        const div = state.color;
        const ex =
          state.color === 25
            ? { payout: 595, through: 5500 }
            : state.color === 5
            ? { payout: 240, through: 500 }
            : state.color === 2
              ? { payout: 780, through: 500 }
              : { payout: 340, through: 100 };
        const exCash = ex.through / div;
        const exLeft = ex.payout - exCash;
        els.hint.innerHTML =
          `<strong>Через кэш (×${state.color}):</strong> кэш = N ÷ ${div}, цвет = выплата − кэш. Выплата ≤ 1000. ` +
          `Пример: ${ex.payout} через ${ex.through} → ${ex.through}÷${div}=${exCash}, цвет <strong>${exLeft}</strong>.`;
      } else {
        const ex =
          state.color === 25
            ? { payout: 287, chips: 50, cash: 5925 }
            : state.color === 5
            ? { payout: 287, chips: 50, cash: 1185 }
            : state.color === 2
              ? { payout: 313, chips: 90, cash: 446 }
              : { payout: 241, chips: 50, cash: 191 };
        els.hint.innerHTML =
          `<strong>Через фишки (×${state.color}):</strong> выплата — число фишек. ` +
          `Иногда «5 стеков» (ровно 100), иногда «примерно 2–3 стека». ` +
          `Кэш = (выплата − фишки) × ${state.color}. ` +
          `Пример: ${ex.payout}, ~2–3 стека, ${ex.chips} → ` +
          `(${ex.payout}−${ex.chips})×${state.color} = <strong>${ex.cash}$</strong>.`;
      }
    }
  }

  function persistSettings() {
    if (saveSettings) {
      saveSettings({
        payouts: { color: state.color, mode: state.mode, duration: state.duration }
      });
    }
  }

  const session = Trainer.createTimedSession({
    state,
    els,
    summaryTitle: 'Итог: выплаты'
  });
  const { updateStats, stopTimers: stopTimer } = session;

  function setInputsEnabled(enabled) {
    els.answer.disabled = !enabled;
    els.chipsAnswer.disabled = !enabled;
    els.cashAnswer.disabled = !enabled;
    els.answerBtn.disabled = !enabled;
  }

  function clearInputs() {
    els.answer.value = '';
    els.chipsAnswer.value = '';
    els.cashAnswer.value = '';
  }

  function focusAnswer() {
    if (state.mode === 'cash') {
      els.answer.focus();
    } else {
      els.chipsAnswer.focus();
    }
  }

  function makeQuestion() {
    let question;
    let guard = 0;
    do {
      question = state.mode === 'cash' ? generateCashQuestion(state.color) : generateChipsQuestion(state.color);
      guard += 1;
    } while (question.exampleKey === state.lastKey && guard < 12);

    state.question = question;
    state.lastKey = question.exampleKey;
    state.questionStartedAt = Date.now();
  }

  function renderQuestion(animate = true) {
    const q = state.question;
    if (!q) {
      els.example.textContent = '—';
      els.detail.textContent = 'Нажмите «Старт»';
      return;
    }

    if (animate) {
      animateExample(els.example, String(q.payout));
    } else {
      els.example.textContent = String(q.payout);
    }

    if (q.mode === 'cash') {
      els.detail.textContent = `через ${q.through}`;
    } else if (q.requestStyle === 'exact') {
      els.detail.textContent =
        `просит ${q.requestLabel} (ровно ${q.minChips} фиш.), остальное кэшем · ×${q.color}`;
    } else {
      els.detail.textContent =
        `примерно ${q.requestLabel} (~${q.minChips}–${q.maxChips} фиш.), остальное кэшем · ×${q.color}`;
    }
    Trainer.replayClass?.(els.detail, 'is-enter');
  }

  function nextQuestion() {
    makeQuestion();
    renderQuestion(true);
    clearInputs();
    setInputsEnabled(true);
    focusAnswer();
  }

  function finish() {
    session.finish(() => setInputsEnabled(false));
  }

  function start() {
    session.beginRun();
    updateModeUi();
    nextQuestion();
    updateStats();
    showMessage(
      els.message,
      state.mode === 'cash'
        ? 'Сколько фишек цвета останется?'
        : 'Сколько фишек отдать и сколько $ кэша?',
      ''
    );
    session.startClock(finish);
  }

  function reset() {
    const prev = session.resetRun();
    state.question = null;
    state.lastKey = null;
    clearInputs();
    setInputsEnabled(false);
    updateModeUi();
    els.example.textContent = '—';
    els.detail.textContent = 'Нажмите «Старт»';
    updateStats();
    showMessage(els.message, 'Нажмите «Старт»', '');
    session.presentSummary(prev.correct, prev.wrong, prev.log);
  }

  function setColor(color) {
    state.color = color;
    els.colorButtons.forEach((button) => {
      setPressed(button, Number(button.dataset.color) === color);
    });
    updateModeUi();
    persistSettings();
    if (state.running) {
      nextQuestion();
    }
  }

  function setMode(mode) {
    state.mode = mode;
    els.modeButtons.forEach((button) => {
      setPressed(button, button.dataset.mode === mode);
    });
    updateModeUi();
    clearInputs();
    persistSettings();
    if (state.running) {
      nextQuestion();
    } else {
      els.detail.textContent = 'Нажмите «Старт»';
      els.example.textContent = '—';
    }
  }

  function submitCash() {
    const q = state.question;
    if (els.answer.value.trim() === '') {
      showMessage(els.message, 'Введите остаток цвета (фишки)', 'bad');
      flashAnswer(els.answer, false);
      return;
    }

    const value = Number(els.answer.value);
    const isCorrect = value === q.colorLeft;
    session.record('payouts', q.exampleKey, isCorrect);
    flashAnswer(els.answer, isCorrect);
    flashTask(els.task, isCorrect);

    if (isCorrect) {
      showMessage(els.message, 'Верно', 'good');
      nextQuestion();
    } else {
      showMessage(
        els.message,
        `Ошибка: ${q.through}÷${q.divisor}=${q.cash} кэша → ${q.payout}−${q.cash}=${q.colorLeft}`,
        'bad'
      );
      setInputsEnabled(false);
      session.scheduleNext(nextQuestion, 1200);
    }
  }

  function submitChips() {
    const q = state.question;
    const chipsRaw = els.chipsAnswer.value.trim();
    const cashRaw = els.cashAnswer.value.trim();

    if (chipsRaw === '' || cashRaw === '') {
      showMessage(els.message, 'Введите фишки и кэш', 'bad');
      if (chipsRaw === '') flashAnswer(els.chipsAnswer, false);
      if (cashRaw === '') flashAnswer(els.cashAnswer, false);
      return;
    }

    const chips = Number(chipsRaw);
    const cash = Number(cashRaw);
    const isCorrect = isValidChipsAnswer(q, chips, cash);

    session.record('payouts', q.exampleKey, isCorrect);
    flashAnswer(els.chipsAnswer, isCorrect);
    flashAnswer(els.cashAnswer, isCorrect);
    flashTask(els.task, isCorrect);

    if (isCorrect) {
      showMessage(els.message, 'Верно', 'good');
      nextQuestion();
    } else {
      showMessage(els.message, `Ошибка: ${chipsErrorHint(q, chips, cash)}`, 'bad');
      setInputsEnabled(false);
      session.scheduleNext(nextQuestion, 1800);
    }
  }

  Trainer.stopPayouts = function stopPayouts() {
    stopTimer();
    state.running = false;
  };

  Trainer.initPayouts = function initPayouts() {
    if (getSettings) {
      const saved = getSettings().payouts || {};
      if (PAYOUT_COLORS.includes(saved.color)) {
        state.color = saved.color;
      }
      if (saved.mode === 'cash' || saved.mode === 'chips') {
        state.mode = saved.mode;
      }
      session.applySavedDuration(saved);
      els.colorButtons.forEach((button) => {
        setPressed(button, Number(button.dataset.color) === state.color);
      });
      els.modeButtons.forEach((button) => {
        setPressed(button, button.dataset.mode === state.mode);
      });
      session.syncTimeButtons(els.timeButtons);
    }

    els.colorButtons.forEach((button) => {
      button.addEventListener('click', () => setColor(Number(button.dataset.color)));
    });
    els.modeButtons.forEach((button) => {
      button.addEventListener('click', () => setMode(button.dataset.mode));
    });
    session.bindTimeButtons(els.timeButtons, persistSettings);
    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', reset);

    els.answerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!state.running || !state.question) {
        return;
      }
      if (state.mode === 'cash') {
        submitCash();
      } else {
        submitChips();
      }
    });

    reset();
  };
})();
