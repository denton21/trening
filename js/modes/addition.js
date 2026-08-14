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
    keepAnswerFocus,
    flashTask,
    setProgress,
    showMessage,
    getSettings,
    saveSettings,
    recordAttempt,
    pushSessionAttempt,
    showSessionSummary
  } = Trainer;

  const ADDITION_BANK = Trainer.additionBank || [];

  const state = {
    duration: 60,
    secondsLeft: 60,
    current: null,
    correct: 0,
    wrong: 0,
    running: false,
    timer: null,
    nextTimer: null,
    lastKey: null,
    questionStartedAt: null,
    sessionLog: []
  };

  const els = {
    timeButtons: $$('#additionTimeChoices button'),
    startBtn: $('#additionStartBtn'),
    resetBtn: $('#additionResetBtn'),
    answerForm: $('#additionAnswerForm'),
    answer: $('#additionAnswer'),
    answerBtn: $('#additionAnswerBtn'),
    example: $('#additionExample'),
    message: $('#additionMessage'),
    timeLeft: $('#additionTimeLeft'),
    correctCount: $('#additionCorrectCount'),
    wrongCount: $('#additionWrongCount'),
    timeProgress: $('#additionTimeProgress'),
    bankCount: $('#additionBankCount'),
    task: $('#additionTab .task')
  };

  function persistSettings() {
    if (saveSettings) {
      saveSettings({ addition: { duration: state.duration } });
    }
  }

  const session = Trainer.createTimedSession({
    state,
    els,
    summaryTitle: 'Итог: сложение'
  });
  const { updateStats, stopTimers: stopTimer } = session;

  function pickProblem() {
    if (!ADDITION_BANK.length) {
      return null;
    }
    let item = ADDITION_BANK[Math.floor(Math.random() * ADDITION_BANK.length)];
    let key = item.a + '+' + item.b;
    let guard = 0;
    while (key === state.lastKey && ADDITION_BANK.length > 1 && guard < 40) {
      item = ADDITION_BANK[Math.floor(Math.random() * ADDITION_BANK.length)];
      key = item.a + '+' + item.b;
      guard += 1;
    }
    return item;
  }

  function setNextQuestion(animate) {
    const item = pickProblem();
    state.current = item;
    state.lastKey = item ? item.a + '+' + item.b : null;
    state.questionStartedAt = Date.now();
    const text = item ? item.a + ' + ' + item.b : '—';
    if (animate) {
      animateExample(els.example, text);
    } else {
      els.example.textContent = text;
    }
  }

  function nextQuestion() {
    setNextQuestion(true);
    els.answer.value = '';
    els.answer.disabled = false;
    els.answerBtn.disabled = false;
    keepAnswerFocus(els.answer);
  }

  function finish() {
    session.finish(function () {
      els.answer.disabled = true;
      els.answerBtn.disabled = true;
    });
  }

  function start() {
    session.beginRun();
    nextQuestion();
    updateStats();
    showMessage(els.message, 'Сложите числа', '');
    session.startClock(finish);
  }

  function showIdleExample() {
    els.example.textContent = '—';
    state.current = null;
    state.questionStartedAt = null;
  }

  function reset() {
    const prev = session.resetRun();
    showIdleExample();
    els.answer.value = '';
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
    updateStats();
    showMessage(els.message, 'Нажмите «Старт»', '');
    session.presentSummary(prev.correct, prev.wrong, prev.log);
  }

  function loadSavedSettings() {
    if (!getSettings) {
      return;
    }
    session.applySavedDuration(getSettings().addition || {});
    session.syncTimeButtons(els.timeButtons);
  }

  Trainer.stopAddition = function stopAddition() {
    stopTimer();
    state.running = false;
  };

  Trainer.initAddition = function initAddition() {
    loadSavedSettings();
    if (els.bankCount) {
      els.bankCount.textContent = String(ADDITION_BANK.length);
    }

    session.bindTimeButtons(els.timeButtons, persistSettings);
    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', reset);

    els.answerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!state.running || !state.current || session.isWaiting()) {
        return;
      }
      if (els.answer.value.trim() === '') {
        showMessage(els.message, 'Введите сумму', 'bad');
        flashAnswer(els.answer, false);
        keepAnswerFocus(els.answer);
        return;
      }

      const expected = state.current.answer;
      const isCorrect = Number(els.answer.value) === expected;
      const label = state.current.a + ' + ' + state.current.b + ' = ' + expected;
      session.record('addition', label, isCorrect);

      flashAnswer(els.answer, isCorrect);
      flashTask(els.task, isCorrect);

      if (isCorrect) {
        showMessage(els.message, 'Верно', 'good');
        nextQuestion();
      } else {
        showMessage(els.message, 'Ошибка: ' + label, 'bad');
        keepAnswerFocus(els.answer);
        session.scheduleNext(nextQuestion, 900);
      }
    });

    reset();
  };
})();
