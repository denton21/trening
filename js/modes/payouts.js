window.Trainer = window.Trainer || {};

(function () {
  const {
    $,
    $$,
    setPressed,
    flashAnswer,
    keepAnswerFocus,
    flashTask,
    showMessage,
    getSettings,
    saveSettings,
    cashPart,
    colorLeftFromCash,
    chipsCashFor,
    isValidChipsAnswer,
    randInt
  } = Trainer;

  const STACK_SIZE = 20;
  const CASH_STEPS = { 1: 50, 2: 100, 5: 100, 25: 500 };
  const MAX_PAYOUT_CHIPS = 1000;
  const MIN_COLOR_CHIPS = 5;
  const MAX_COLOR_CHIPS = 5 * STACK_SIZE;
  const CHIP_PAYOUT_CAPS = { 1: 520, 2: 480, 5: 380, 25: 280 };
  const MODES = ['mixed', 'cash', 'chips'];
  const number = new Intl.NumberFormat('ru-RU');
  const money = (value) => '$' + number.format(value);

  function generateCashQuestion(color) {
    const step = CASH_STEPS[color];
    const cashCap = color === 25 ? 10000 : (MAX_PAYOUT_CHIPS - MIN_COLOR_CHIPS) * color;
    const cash = randInt(color === 25 ? 2 : 1, Math.floor(cashCap / step)) * step;
    const cashInChips = cashPart(cash, color);
    const colorChips = randInt(MIN_COLOR_CHIPS, Math.min(MAX_COLOR_CHIPS, MAX_PAYOUT_CHIPS - cashInChips));
    const payout = cashInChips + colorChips;
    return {
      mode: 'cash',
      color,
      payout,
      cash,
      request: `Выдайте ${money(cash)} кэшем, остальное цветом.`,
      exampleKey: `${payout} фиш. по ${money(color)} · через ${money(cash)}`
    };
  }

  function generateChipsQuestion(color) {
    const exact = Math.random() < 0.5;
    const maxStacks = color >= 5 ? 4 : 5;
    const stacks = randInt(1, exact ? maxStacks : maxStacks - 1);
    const minChips = stacks * STACK_SIZE;
    const maxChips = exact ? minChips : minChips + STACK_SIZE;
    const payout = randInt(Math.max(color >= 5 ? 90 : 70, maxChips + STACK_SIZE), CHIP_PAYOUT_CAPS[color]);
    const stackWord = stacks === 1 ? 'стек' : stacks === 5 ? 'стеков' : 'стека';
    const request = exact ? `${stacks} ${stackWord}` : `примерно ${stacks}–${stacks + 1} ${stacks === 4 ? 'стеков' : 'стека'}`;
    return {
      mode: 'chips',
      color,
      payout,
      minChips,
      maxChips,
      request: `Оставьте цветом ${request}, остальное кэшем.`,
      exampleKey: `${payout} фиш. по ${money(color)} · ${request}`
    };
  }

  const state = {
    color: 1,
    mode: 'mixed',
    duration: 60,
    secondsLeft: 60,
    correct: 0,
    wrong: 0,
    running: false,
    reviewing: false,
    timer: null,
    question: null,
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
    value: $('#payoutsValue'),
    denom: $('#payoutsDenom'),
    request: $('#payoutsRequest'),
    detail: $('#payoutsDetail'),
    solution: $('#payoutsSolution'),
    message: $('#payoutsMessage'),
    timeLeft: $('#payoutsTimeLeft'),
    correctCount: $('#payoutsCorrectCount'),
    wrongCount: $('#payoutsWrongCount'),
    timeProgress: $('#payoutsTimeProgress'),
    task: $('#payoutsTask')
  };

  const inputs = [els.answer, els.chipsAnswer, els.cashAnswer];
  const options = [...els.colorButtons, ...els.modeButtons, ...els.timeButtons];
  const session = Trainer.createTimedSession({ state, els, summaryTitle: 'Итог: выплаты' });

  function persistSettings() {
    saveSettings({ payouts: { color: state.color, mode: state.mode, duration: state.duration } });
  }

  function syncSettings() {
    els.colorButtons.forEach((button) => setPressed(button, Number(button.dataset.color) === state.color));
    els.modeButtons.forEach((button) => setPressed(button, button.dataset.mode === state.mode));
    els.denom.textContent = money(state.color);
    persistSettings();
  }

  function syncRoundControls() {
    options.forEach((button) => { button.disabled = state.running; });
    els.startBtn.disabled = state.running;
    els.resetBtn.textContent = state.running ? 'Завершить' : 'Сброс';
    els.answerBtn.disabled = !state.running;
    const cashMode = state.question?.mode === 'cash';
    els.answer.disabled = !state.running || !cashMode;
    els.chipsAnswer.disabled = els.cashAnswer.disabled = !state.running || cashMode;
  }

  function clearReview() {
    state.reviewing = false;
    els.solution.classList.add('hidden');
    els.solution.textContent = '';
    els.answerBtn.textContent = 'Выдать';
    inputs.forEach((input) => {
      input.value = '';
      input.readOnly = false;
      input.classList.remove('flash-good', 'flash-bad');
    });
    els.task.classList.remove('is-correct', 'is-wrong');
  }

  function nextQuestion() {
    const previous = state.question;
    let question;
    for (let i = 0; i < 12; i += 1) {
      const cashMode = state.mode === 'cash' || (state.mode === 'mixed' && Math.random() < 0.5);
      question = cashMode ? generateCashQuestion(state.color) : generateChipsQuestion(state.color);
      if (question.exampleKey !== previous?.exampleKey) break;
    }
    state.question = question;
    const cashMode = question.mode === 'cash';
    clearReview();
    els.example.textContent = `${number.format(question.payout)} фиш.`;
    els.value.textContent = money(question.payout * question.color);
    els.detail.textContent = `«${question.request}»`;
    els.request.classList.remove('hidden');
    els.answerForm.classList.remove('hidden');
    els.cashInputs.classList.toggle('hidden', !cashMode);
    els.chipsInputs.classList.toggle('hidden', cashMode);
    syncRoundControls();
    state.questionStartedAt = Date.now();
    keepAnswerFocus(cashMode ? els.answer : els.chipsAnswer);
  }

  function finish() {
    session.finish(syncRoundControls);
  }

  function start() {
    session.beginRun();
    nextQuestion();
    session.updateStats();
    showMessage(els.message, '');
    els.task.scrollIntoView({ block: 'nearest' });
    session.startClock(finish);
  }

  function reset() {
    const prev = session.resetRun();
    state.question = null;
    clearReview();
    els.example.textContent = '—';
    els.value.textContent = '';
    els.request.classList.add('hidden');
    els.answerForm.classList.add('hidden');
    syncRoundControls();
    session.updateStats();
    showMessage(els.message, 'Нажми «Начать раунд»');
    session.presentSummary(prev.correct, prev.wrong, prev.log);
  }

  function explain(question, chips) {
    const { payout, color, cash, minChips, maxChips } = question;
    if (question.mode === 'cash') {
      const paidInCash = cashPart(cash, color);
      return `Кэш ${money(cash)} заменяет ${money(cash)} ÷ ${money(color)} = ${paidInCash} фиш. Гостю ещё нужно выдать ${payout} − ${paidInCash} = ${colorLeftFromCash(payout, cash, color)} фиш. цветом.`;
    }
    if (chips < minChips || chips > maxChips) {
      const request = minChips === maxChips ? `ровно ${minChips} фиш.` : `от ${minChips} до ${maxChips} фиш.`;
      return `Гость просил ${request} Если выдать ${minChips} фиш. цветом, кэш составит (${payout} − ${minChips}) × ${money(color)} = ${money(chipsCashFor(payout, minChips, color))}.`;
    }
    return `При выдаче ${chips} фиш. цветом кэш составит (${payout} − ${chips}) × ${money(color)} = ${money(chipsCashFor(payout, chips, color))}.`;
  }

  function submit(event) {
    event.preventDefault();
    if (!state.running || !state.question) return;
    if (state.reviewing) {
      nextQuestion();
      showMessage(els.message, '');
      return;
    }

    const question = state.question;
    const cashMode = question.mode === 'cash';
    const answerFields = cashMode ? [els.answer] : [els.chipsAnswer, els.cashAnswer];
    const invalid = answerFields.find((input) => {
      const value = Number(input.value);
      return input.value === '' || !Number.isSafeInteger(value) || value < 0;
    });
    if (invalid) {
      if (invalid === els.cashAnswer && document.activeElement === els.chipsAnswer && invalid.value === '') {
        keepAnswerFocus(invalid);
        return;
      }
      showMessage(els.message, 'Введи целое число в каждое поле', 'bad');
      flashAnswer(invalid, false);
      keepAnswerFocus(invalid);
      return;
    }

    const chips = Number(answerFields[0].value);
    const cash = cashMode ? question.cash : Number(els.cashAnswer.value);
    const correct = cashMode
      ? chips === colorLeftFromCash(question.payout, cash, question.color)
      : isValidChipsAnswer(question, chips, cash);
    session.record('payouts', question.exampleKey, correct);

    if (correct) {
      nextQuestion();
      flashTask(els.task, true);
      showMessage(els.message, `Верно · выдано ${chips} фиш. и ${money(cash)}`, 'good');
      return;
    }

    state.reviewing = true;
    answerFields.forEach((input) => {
      flashAnswer(input, false);
      input.readOnly = true;
    });
    flashTask(els.task, false);
    els.answerBtn.textContent = 'Дальше';
    els.solution.textContent = explain(question, chips);
    els.solution.classList.remove('hidden');
    showMessage(els.message, 'Ошибка в выплате', 'bad');
    els.answerBtn.focus({ preventScroll: true });
  }

  Trainer.stopPayouts = function stopPayouts() {
    if (!state.running) return;
    session.stopTimers();
    state.running = false;
    syncRoundControls();
    showMessage(els.message, 'Раунд остановлен');
  };

  Trainer.initPayouts = function initPayouts() {
    const saved = getSettings().payouts || {};
    if (Object.hasOwn(CASH_STEPS, saved.color)) state.color = Number(saved.color);
    if (MODES.includes(saved.mode)) state.mode = saved.mode;
    session.applySavedDuration(saved);
    session.syncTimeButtons(els.timeButtons);
    syncSettings();

    els.colorButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.color = Number(button.dataset.color);
        reset();
        syncSettings();
      });
    });
    els.modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.mode = button.dataset.mode;
        reset();
        syncSettings();
      });
    });
    session.bindTimeButtons(els.timeButtons, persistSettings);
    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', () => state.running ? finish() : reset());
    els.answerForm.addEventListener('submit', submit);

    reset();
  };
})();
