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
    recordAttempt
  } = Trainer;

  /** Стек = 20 фишек. */
  const STACK_SIZE = 20;

  /**
   * Через кэш:
   *   кэш = «через N» ÷ цвет
   *   фишки цвета = выплата − кэш
   *
   * ×2:  780 через 500 → 500/2=250 → цвет 530
   * ×5:  240 через 500 → 500/5=100 → цвет 140
   * ×1:  340 через 100 → 100/1=100 → цвет 240
   *
   * Выплата ≤ 1000 — иначе «камаз» фишек гостю.
   */
  const MAX_PAYOUT = 1000;

  /**
   * Через фишки:
   *   выплата = число фишек (не доллары)
   *   гость просит N стеков → отдаём chips = N×20
   *   остаток = выплата − chips
   *   кэш ($) = остаток × цвет
   *
   * ×5: 300, 5 стеков (100) → ост. 200 → 200×5 = 1000$
   *     (или 200÷2×10, или «добавить 0» к половине)
   * ×2: 300, 100 фишек → ост. 200 → 200×2 = 400$
   * ×1: остаток × 1 = кэш
   */

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

  function stackLabel(stacks) {
    if (stacks === 1) {
      return '1 стек';
    }
    if (stacks >= 2 && stacks <= 4) {
      return `${stacks} стека`;
    }
    return `${stacks} стеков`;
  }

  /**
   * Выплата в фишках; гость берёт stacks стеков;
   * кэш = (выплата − chips) × color.
   */
  function generateChipsQuestion(color) {
    // Выплата: 160…500 фишек, кратно 20 (чтобы удобно со стеками)
    let payout;
    let stacks;
    let chips;
    let remaining;
    let cash;
    let attempts = 0;

    do {
      attempts += 1;
      // Чем выше цвет, тем меньше фишек в выплате (кэш не раздувать)
      const maxPayoutChips = color === 5 ? 400 : color === 2 ? 500 : 500;
      const minPayoutChips = color === 5 ? 160 : 140;
      const units = randomInt(minPayoutChips / STACK_SIZE, maxPayoutChips / STACK_SIZE);
      payout = units * STACK_SIZE;

      // Гость просит 1…5 стеков, но меньше выплаты (остаток ≥ 1 стек)
      const maxStacks = Math.min(5, units - 1);
      const minStacks = 1;
      if (maxStacks < minStacks) {
        continue;
      }
      stacks = randomInt(minStacks, maxStacks);
      chips = stacks * STACK_SIZE;
      remaining = payout - chips;
      cash = remaining * color;
    } while ((cash <= 0 || remaining < STACK_SIZE) && attempts < 40);

    if (cash <= 0 || remaining < STACK_SIZE) {
      // Фоллбек — примеры из постановки
      if (color === 5) {
        payout = 300;
        stacks = 5;
      } else if (color === 2) {
        payout = 300;
        stacks = 5;
      } else {
        payout = 240;
        stacks = 2;
      }
      chips = stacks * STACK_SIZE;
      remaining = payout - chips;
      cash = remaining * color;
    }

    return {
      mode: 'chips',
      color,
      payout,
      stacks,
      chips,
      remaining,
      cash,
      requestLabel: stackLabel(stacks),
      sampleChips: chips,
      sampleCash: cash,
      exampleKey: `фишки ${payout} ${stackLabel(stacks)} (×${color})`
    };
  }

  function isValidChipsAnswer(question, chips, cash) {
    if (!Number.isInteger(chips) || !Number.isInteger(cash)) {
      return false;
    }
    if (chips < 0 || cash < 0) {
      return false;
    }
    // Отдаём ровно запрошенные фишки; кэш = остаток × цвет
    return chips === question.chips && cash === question.cash;
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
    questionStartedAt: null
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
            ? { payout: 300, stacks: 5, chips: 100, cash: 1000 }
            : state.color === 2
              ? { payout: 300, stacks: 5, chips: 100, cash: 400 }
              : { payout: 240, stacks: 2, chips: 40, cash: 200 };
        els.hint.innerHTML =
          `<strong>Через фишки (×${state.color}):</strong> выплата — число фишек. ` +
          `Стек = 20. Отдаём запрошенные фишки, остаток × ${state.color} = кэш ($). ` +
          `Пример: ${ex.payout}, ${ex.stacks} стек(ов) → ${ex.chips} фишек, ` +
          `остаток ${ex.payout - ex.chips} × ${state.color} = <strong>${ex.cash}$</strong>.`;
      }
    }
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
    } else {
      els.detail.textContent = `просит ${q.requestLabel} (${q.chips} фишек) · цвет ×${q.color}`;
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
  }

  function start() {
    stopTimer();
    state.correct = 0;
    state.wrong = 0;
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
  }

  function setColor(color) {
    state.color = color;
    els.colorButtons.forEach((button) => {
      setPressed(button, Number(button.dataset.color) === color);
    });
    updateModeUi();
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
      const hint =
        `${q.chips} фишек + (${q.payout}−${q.chips})×${q.color}=${q.cash}$ ` +
        `(остаток ${q.remaining} × ${q.color})`;
      showMessage(els.message, `Ошибка: ${hint}`, 'bad');
      setInputsEnabled(false);
      state.nextTimer = window.setTimeout(() => {
        if (state.running) {
          nextQuestion();
        }
      }, 1400);
    }
    updateStats();
  }

  Trainer.stopPayouts = function stopPayouts() {
    stopTimer();
    state.running = false;
  };

  Trainer.initPayouts = function initPayouts() {
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
