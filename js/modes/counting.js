window.Trainer = window.Trainer || {};

(function () {
  const {
    $,
    $$,
    allMultipliers,
    setPressed,
    tableOptions,
    animateExample,
    flashAnswer,
    flashTask,
    showMessage
  } = Trainer;

  const state = {
    level: 'easy',
    answer: 0,
    running: false,
    nextTimer: null
  };

  const els = {
    levelButtons: $$('#countingLevelChoices button'),
    startBtn: $('#countingStartBtn'),
    resetBtn: $('#countingResetBtn'),
    answerForm: $('#countingAnswerForm'),
    answer: $('#countingAnswer'),
    answerBtn: $('#countingAnswerBtn'),
    example: $('#countingExample'),
    message: $('#countingMessage'),
    task: $('#countingTab .task')
  };

  function stopTimer() {
    if (state.nextTimer) {
      window.clearTimeout(state.nextTimer);
      state.nextTimer = null;
    }
  }

  function setNextQuestion(animate = true) {
    const itemCount =
      state.level === 'easy' ? 2 + Math.floor(Math.random() * 2) : state.level === 'medium' ? 4 : 5;

    const values = Array.from({ length: itemCount }, () => {
      const table = tableOptions[Math.floor(Math.random() * tableOptions.length)];
      const multiplier = allMultipliers[Math.floor(Math.random() * allMultipliers.length)];
      return table * multiplier;
    });

    state.answer = values.reduce((sum, value) => sum + value, 0);
    const text = values.join(' + ');
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
    els.answer.focus();
  }

  function start() {
    stopTimer();
    state.running = true;
    nextQuestion();
    showMessage(els.message, 'Сложите выплаты', '');
  }

  function reset() {
    stopTimer();
    state.running = false;
    setNextQuestion(false);
    els.answer.value = '';
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
    showMessage(els.message, 'Нажмите «Старт»', '');
  }

  function setLevel(level) {
    state.level = level;
    els.levelButtons.forEach((button) => setPressed(button, button.dataset.level === level));
    if (!state.running) {
      setNextQuestion(false);
    }
  }

  Trainer.stopCounting = function stopCounting() {
    stopTimer();
    state.running = false;
  };

  Trainer.initCounting = function initCounting() {
    els.levelButtons.forEach((button) => {
      button.addEventListener('click', () => setLevel(button.dataset.level));
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
      flashAnswer(els.answer, isCorrect);
      flashTask(els.task, isCorrect);

      if (isCorrect) {
        showMessage(els.message, 'Верно', 'good');
        nextQuestion();
      } else {
        showMessage(els.message, `Ошибка: правильная сумма ${state.answer}`, 'bad');
        els.answer.disabled = true;
        els.answerBtn.disabled = true;
        state.nextTimer = window.setTimeout(() => {
          if (state.running) {
            nextQuestion();
          }
        }, 900);
      }
    });

    reset();
  };
})();
