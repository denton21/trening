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
    return [100, 200, 500, 1000];
  }

  function cashPart(through, color) {
    return through / color;
  }

  function colorLeftFromCash(payout, through, color) {
    return payout - cashPart(through, color);
  }

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

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /** Выплата, кратная цвету, не больше MAX_PAYOUT. */
  function randomPayout(color, minUnits, maxUnits) {
    const maxByCap = Math.floor(MAX_PAYOUT / color);
    const hi = Math.min(maxUnits, maxByCap);
    const lo = Math.min(minUnits, hi);
    return randomInt(lo, hi) * color;
  }

  function generateCashQuestion(color) {
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
    const maxPayoutChips = color === 5 ? 380 : color === 2 ? 480 : 520;
    const minPayoutChips = color === 5 ? 90 : 70;
    const exact = Math.random() < 0.5;
    let attempts = 0;

    if (exact) {
      let stacks;
      let chips;
      let payout;
      let cash;
      do {
        attempts += 1;
        const maxStacks = color === 5 ? 4 : 5;
        stacks = pick(EXACT_STACKS.filter((n) => n <= maxStacks));
        chips = stacks * STACK_SIZE;
        payout = randomInt(Math.max(minPayoutChips, chips + 20), maxPayoutChips);
        cash = (payout - chips) * color;
      } while ((cash <= 0 || payout <= chips) && attempts < 40);

      if (cash <= 0 || payout <= chips) {
        stacks = 3;
        chips = 60;
        payout = color === 5 ? 187 : 241;
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
      color === 5 ? [APPROX_REQUESTS[0], APPROX_REQUESTS[1], APPROX_REQUESTS[2]] : APPROX_REQUESTS;

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
      payout = color === 5 ? 287 : color === 2 ? 313 : 241;
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

  function chipsCashFor(payout, chips, color) {
    return (payout - chips) * color;
  }

  function isValidChipsAnswer(question, chips, cash) {
    if (!Number.isInteger(chips) || !Number.isInteger(cash)) {
      return false;
    }
    if (chips <= 0 || chips >= question.payout) {
      return false;
    }
    if (chips < question.minChips || chips > question.maxChips) {
      return false;
    }
    if (cash < 0) {
      return false;
    }
    return cash === chipsCashFor(question.payout, chips, question.color);
  }

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
          state.color === 5
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
          state.color === 5
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

  function presentSummary(correct, wrong, log) {
    const entries = log || state.sessionLog;
    if (!entries.length || !showSessionSummary) {
      return;
    }
    showSessionSummary({
      title: 'Итог: выплаты',
      correct: correct != null ? correct : state.correct,
      wrong: wrong != null ? wrong : state.wrong,
      log: entries.slice()
    });
    state.sessionLog = [];
  }

  function updateStats() {
    els.timeLeft.textContent = formatTime(state.secondsLeft);
    els.correctCount.textContent = state.correct;
    els.wrongCount.textContent = state.wrong;
    setProgress(els.timeProgress, state.secondsLeft, state.duration);
  }

  function stopTimer() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
    if (state.nextTimer) {
      window.clearTimeout(state.nextTimer);
      state.nextTimer = null;
    }
  }

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
  }

  function nextQuestion() {
    makeQuestion();
    renderQuestion(true);
    clearInputs();
    setInputsEnabled(true);
    focusAnswer();
  }

  function finish() {
    stopTimer();
    state.running = false;
    setInputsEnabled(false);
    showMessage(els.message, `Готово: ${state.correct} верно, ${state.wrong} ошибок`, 'good');
    presentSummary();
  }

  function start() {
    stopTimer();
    state.correct = 0;
    state.wrong = 0;
    state.sessionLog = [];
    state.secondsLeft = state.duration;
    state.running = true;
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

    if (state.secondsLeft !== null) {
      state.timer = window.setInterval(() => {
        state.secondsLeft -= 1;
        updateStats();
        if (state.secondsLeft <= 0) {
          finish();
        }
      }, 1000);
    }
  }

  function reset() {
    const prevCorrect = state.correct;
    const prevWrong = state.wrong;
    const prevLog = state.sessionLog.slice();
    stopTimer();
    state.correct = 0;
    state.wrong = 0;
    state.secondsLeft = state.duration;
    state.running = false;
    state.question = null;
    state.lastKey = null;
    clearInputs();
    setInputsEnabled(false);
    updateModeUi();
    els.example.textContent = '—';
    els.detail.textContent = 'Нажмите «Старт»';
    updateStats();
    showMessage(els.message, 'Нажмите «Старт»', '');
    presentSummary(prevCorrect, prevWrong, prevLog);
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

  function setTime(seconds) {
    state.duration = seconds;
    state.secondsLeft = seconds;
    els.timeButtons.forEach((button) => {
      setPressed(
        button,
        String(seconds) === button.dataset.seconds || (seconds === null && button.dataset.seconds === 'free')
      );
    });
    updateStats();
    persistSettings();
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
    recordAttempt('payouts', q.exampleKey, isCorrect, state.questionStartedAt);
    pushSessionAttempt(state.sessionLog, q.exampleKey, isCorrect, state.questionStartedAt);
    flashAnswer(els.answer, isCorrect);
    flashTask(els.task, isCorrect);

    if (isCorrect) {
      state.correct += 1;
      bumpStat(els.correctCount);
      showMessage(els.message, 'Верно', 'good');
      nextQuestion();
    } else {
      state.wrong += 1;
      bumpStat(els.wrongCount);
      showMessage(
        els.message,
        `Ошибка: ${q.through}÷${q.divisor}=${q.cash} кэша → ${q.payout}−${q.cash}=${q.colorLeft}`,
        'bad'
      );
      setInputsEnabled(false);
      state.nextTimer = window.setTimeout(() => {
        if (state.running) {
          nextQuestion();
        }
      }, 1200);
    }
    updateStats();
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

    recordAttempt('payouts', q.exampleKey, isCorrect, state.questionStartedAt);
    pushSessionAttempt(state.sessionLog, q.exampleKey, isCorrect, state.questionStartedAt);
    flashAnswer(els.chipsAnswer, isCorrect);
    flashAnswer(els.cashAnswer, isCorrect);
    flashTask(els.task, isCorrect);

    if (isCorrect) {
      state.correct += 1;
      bumpStat(els.correctCount);
      showMessage(els.message, 'Верно', 'good');
      nextQuestion();
    } else {
      state.wrong += 1;
      bumpStat(els.wrongCount);
      showMessage(els.message, `Ошибка: ${chipsErrorHint(q, chips, cash)}`, 'bad');
      setInputsEnabled(false);
      state.nextTimer = window.setTimeout(() => {
        if (state.running) {
          nextQuestion();
        }
      }, 1800);
    }
    updateStats();
  }

  Trainer.stopPayouts = function stopPayouts() {
    stopTimer();
    state.running = false;
  };

  Trainer.initPayouts = function initPayouts() {
    if (getSettings) {
      const saved = getSettings().payouts || {};
      if (saved.color === 1 || saved.color === 2 || saved.color === 5) {
        state.color = saved.color;
      }
      if (saved.mode === 'cash' || saved.mode === 'chips') {
        state.mode = saved.mode;
      }
      if (saved.duration === null || typeof saved.duration === 'number') {
        state.duration = saved.duration;
        state.secondsLeft = saved.duration;
      }
      els.colorButtons.forEach((button) => {
        setPressed(button, Number(button.dataset.color) === state.color);
      });
      els.modeButtons.forEach((button) => {
        setPressed(button, button.dataset.mode === state.mode);
      });
      els.timeButtons.forEach((button) => {
        setPressed(
          button,
          String(state.duration) === button.dataset.seconds ||
            (state.duration === null && button.dataset.seconds === 'free')
        );
      });
    }

    els.colorButtons.forEach((button) => {
      button.addEventListener('click', () => setColor(Number(button.dataset.color)));
    });
    els.modeButtons.forEach((button) => {
      button.addEventListener('click', () => setMode(button.dataset.mode));
    });
    els.timeButtons.forEach((button) => {
      button.addEventListener('click', () =>
        setTime(button.dataset.seconds === 'free' ? null : Number(button.dataset.seconds))
      );
    });
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
