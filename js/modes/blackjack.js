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
    showSessionSummary,
    blackjackPayout
  } = Trainer;

  const blackjackBets = Array.from({ length: 40 }, (_, index) => (index + 1) * 5);

  const state = {
    duration: 60,
    secondsLeft: 60,
    currentBet: 5,
    correct: 0,
    wrong: 0,
    running: false,
    timer: null,
    nextTimer: null,
    lastBet: null,
    questionStartedAt: null,
    sessionLog: []
  };

  const els = {
    timeButtons: $$('#blackjackTimeChoices button'),
    startBtn: $('#blackjackStartBtn'),
    resetBtn: $('#blackjackResetBtn'),
    answerForm: $('#blackjackAnswerForm'),
    answer: $('#blackjackAnswer'),
    answerBtn: $('#blackjackAnswerBtn'),
    example: $('#blackjackExample'),
    message: $('#blackjackMessage'),
    timeLeft: $('#blackjackTimeLeft'),
    correctCount: $('#blackjackCorrectCount'),
    wrongCount: $('#blackjackWrongCount'),
    timeProgress: $('#blackjackTimeProgress'),
    task: $('#blackjackTab .task')
  };

  function persistSettings() {
    if (saveSettings) {
      saveSettings({ blackjack: { duration: state.duration } });
    }
  }

  const session = Trainer.createTimedSession({
    state,
    els,
    summaryTitle: 'Итог: Blackjack'
  });
  const { updateStats, stopTimers: stopTimer } = session;

  function setNextQuestion(animate = true) {
    const available = blackjackBets.filter((bet) => bet !== state.lastBet);
    const pool = available.length ? available : blackjackBets;
    const bet = pool[Math.floor(Math.random() * pool.length)];
    state.currentBet = bet;
    state.lastBet = bet;
    state.questionStartedAt = Date.now();
    if (animate) {
      animateExample(els.example, String(bet));
    } else {
      els.example.textContent = bet;
    }
  }

  function nextQuestion() {
    setNextQuestion(true);
    els.answer.value = '';
    els.answer.disabled = false;
    els.answerBtn.disabled = false;
    els.answer.focus();
  }

  function finish() {
    session.finish(() => {
      els.answer.disabled = true;
      els.answerBtn.disabled = true;
    });
  }

  function start() {
    session.beginRun();
    nextQuestion();
    updateStats();
    showMessage(els.message, 'Умножьте ставку на 1.5', '');
    session.startClock(finish);
  }

  function showIdleExample() {
    els.example.textContent = '—';
    state.currentBet = null;
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
    session.applySavedDuration(getSettings().blackjack || {});
    session.syncTimeButtons(els.timeButtons);
  }

  Trainer.stopBlackjack = function stopBlackjack() {
    stopTimer();
    state.running = false;
  };

  Trainer.initBlackjack = function initBlackjack() {
    loadSavedSettings();

    session.bindTimeButtons(els.timeButtons, persistSettings);
    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', reset);

    els.answerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!state.running) {
        return;
      }
      if (els.answer.value.trim() === '') {
        showMessage(els.message, 'Введите выплату', 'bad');
        flashAnswer(els.answer, false);
        return;
      }

      const expected = blackjackPayout(state.currentBet);
      const isCorrect = Math.abs(Number(els.answer.value.replace(',', '.')) - expected) < 0.001;
      const label = `${state.currentBet} → ${expected}`;
      session.record('blackjack', label, isCorrect);

      flashAnswer(els.answer, isCorrect);
      flashTask(els.task, isCorrect);

      if (isCorrect) {
        showMessage(els.message, 'Верно', 'good');
        nextQuestion();
      } else {
        showMessage(els.message, `Ошибка: ${label}`, 'bad');
        els.answer.disabled = true;
        els.answerBtn.disabled = true;
        session.scheduleNext(nextQuestion, 900);
      }
    });

    reset();
  };
})();
