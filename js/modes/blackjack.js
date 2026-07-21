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

  function setNextQuestion(animate = true) {
    let bet = blackjackBets[Math.floor(Math.random() * blackjackBets.length)];
    while (bet === state.lastBet) {
      bet = blackjackBets[Math.floor(Math.random() * blackjackBets.length)];
    }
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

  function presentSummary(correct, wrong, log) {
    const entries = log || state.sessionLog;
    if (!entries.length || !showSessionSummary) {
      return;
    }
    showSessionSummary({
      title: 'Итог: Blackjack',
      correct: correct != null ? correct : state.correct,
      wrong: wrong != null ? wrong : state.wrong,
      log: entries.slice()
    });
    state.sessionLog = [];
  }

  function finish() {
    stopTimer();
    state.running = false;
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
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
    nextQuestion();
    updateStats();
    showMessage(els.message, 'Умножьте ставку на 1.5', '');

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

  function showIdleExample() {
    els.example.textContent = '—';
    state.currentBet = null;
    state.questionStartedAt = null;
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
    showIdleExample();
    els.answer.value = '';
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
    updateStats();
    showMessage(els.message, 'Нажмите «Старт»', '');
    presentSummary(prevCorrect, prevWrong, prevLog);
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

  function loadSavedSettings() {
    if (!getSettings) {
      return;
    }
    const saved = getSettings().blackjack || {};
    if (saved.duration === null || typeof saved.duration === 'number') {
      state.duration = saved.duration;
      state.secondsLeft = saved.duration;
    }
    els.timeButtons.forEach((button) => {
      setPressed(
        button,
        String(state.duration) === button.dataset.seconds ||
          (state.duration === null && button.dataset.seconds === 'free')
      );
    });
  }

  Trainer.stopBlackjack = function stopBlackjack() {
    stopTimer();
    state.running = false;
  };

  Trainer.initBlackjack = function initBlackjack() {
    loadSavedSettings();

    els.timeButtons.forEach((button) => {
      button.addEventListener('click', () =>
        setTime(button.dataset.seconds === 'free' ? null : Number(button.dataset.seconds))
      );
    });
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

      const expected = state.currentBet * 1.5;
      const isCorrect = Math.abs(Number(els.answer.value.replace(',', '.')) - expected) < 0.001;
      const label = `${state.currentBet} → ${expected}`;
      recordAttempt('blackjack', label, isCorrect, state.questionStartedAt);
      pushSessionAttempt(state.sessionLog, label, isCorrect, state.questionStartedAt);

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
        showMessage(els.message, `Ошибка: ${label}`, 'bad');
        els.answer.disabled = true;
        els.answerBtn.disabled = true;
        state.nextTimer = window.setTimeout(() => {
          if (state.running) {
            nextQuestion();
          }
        }, 900);
      }
      updateStats();
    });

    reset();
  };
})();
