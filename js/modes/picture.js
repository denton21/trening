window.Trainer = window.Trainer || {};

(function () {
  const {
    $,
    $$,
    formatTime,
    setPressed,
    bumpStat,
    flashAnswer,
    flashTask,
    setProgress,
    showMessage,
    recordAttempt,
    generatePicturePattern
  } = Trainer;

  const state = {
    duration: 60,
    secondsLeft: 60,
    correct: 0,
    wrong: 0,
    answer: 0,
    running: false,
    timer: null,
    nextTimer: null,
    lastSignature: '',
    questionStartedAt: null,
    patternLabel: ''
  };

  const els = {
    timeButtons: $$('#pictureTimeChoices button'),
    startBtn: $('#pictureStartBtn'),
    resetBtn: $('#pictureResetBtn'),
    answerForm: $('#pictureAnswerForm'),
    answer: $('#pictureAnswer'),
    answerBtn: $('#pictureAnswerBtn'),
    message: $('#pictureMessage'),
    timeLeft: $('#pictureTimeLeft'),
    correctCount: $('#pictureCorrectCount'),
    wrongCount: $('#pictureWrongCount'),
    timeProgress: $('#pictureTimeProgress'),
    chips: $('#rouletteChips'),
    task: $('#pictureTab .picture-task')
  };

  function signatureOf(pattern) {
    return pattern.chips
      .map(([x, y]) => `${x},${y}`)
      .sort()
      .join('|');
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

  function nextPattern() {
    let pattern = generatePicturePattern();
    let guard = 0;
    while (signatureOf(pattern) === state.lastSignature && guard < 20) {
      pattern = generatePicturePattern();
      guard += 1;
    }
    return pattern;
  }

  function renderPicture() {
    const pattern = nextPattern();
    state.lastSignature = signatureOf(pattern);
    state.answer = pattern.answer;
    state.patternLabel = pattern.meta.isZero
      ? `0/${pattern.answer}`
      : `c${pattern.meta.col}r${pattern.meta.row}/${pattern.answer}`;
    state.questionStartedAt = Date.now();

    els.chips.innerHTML = '';
    pattern.chips.forEach(([x, y], index) => {
      const element = document.createElement('span');
      element.className = 'chip';
      element.style.left = `${x}%`;
      element.style.top = `${y}%`;
      element.style.setProperty('--i', String(index));
      element.title = 'Фишка picture bet';
      els.chips.appendChild(element);
    });
  }

  function nextPicture() {
    renderPicture();
    els.answer.value = '';
    els.answer.disabled = false;
    els.answerBtn.disabled = false;
    els.answer.focus();
  }

  function finish() {
    stopTimer();
    state.running = false;
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
    showMessage(els.message, `Готово: ${state.correct} верно, ${state.wrong} ошибок`, 'good');
  }

  function start() {
    stopTimer();
    state.correct = 0;
    state.wrong = 0;
    state.secondsLeft = state.duration;
    state.running = true;
    nextPicture();
    updateStats();
    showMessage(els.message, 'Сложите выплаты фишек', '');

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
    renderPicture();
    els.answer.value = '';
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
    updateStats();
    showMessage(els.message, 'Нажмите «Старт»', '');
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

  Trainer.stopPicture = function stopPicture() {
    stopTimer();
    state.running = false;
  };

  Trainer.initPicture = function initPicture() {
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
        showMessage(els.message, 'Введите сумму', 'bad');
        flashAnswer(els.answer, false);
        return;
      }

      const isCorrect = Number(els.answer.value) === state.answer;
      recordAttempt('picture', state.patternLabel, isCorrect, state.questionStartedAt);

      flashAnswer(els.answer, isCorrect);
      flashTask(els.task, isCorrect);

      if (isCorrect) {
        state.correct += 1;
        bumpStat(els.correctCount);
        showMessage(els.message, 'Верно', 'good');
        nextPicture();
      } else {
        state.wrong += 1;
        bumpStat(els.wrongCount);
        showMessage(els.message, `Ошибка: правильная сумма ${state.answer}`, 'bad');
        els.answer.disabled = true;
        els.answerBtn.disabled = true;
        state.nextTimer = window.setTimeout(() => {
          if (state.running) {
            nextPicture();
          }
        }, 900);
      }
      updateStats();
    });

    reset();
  };
})();
