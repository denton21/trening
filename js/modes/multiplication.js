window.Trainer = window.Trainer || {};

(function () {
  const {
    $,
    $$,
    allMultipliers,
    formatTime,
    makeButton,
    setPressed,
    tableOptions,
    animateExample,
    bumpStat,
    flashAnswer,
    flashTask,
    setProgress,
    showMessage,
    recordAttempt
  } = Trainer;

  const state = {
    selectedTables: new Set([5]),
    mode: 'all',
    timeMode: 'timed',
    duration: 60,
    selected: new Set(allMultipliers),
    currentTable: 5,
    currentMultiplier: 1,
    correct: 0,
    wrong: 0,
    secondsLeft: 60,
    running: false,
    timer: null,
    nextTimer: null,
    lastQuestion: '',
    questionStartedAt: null
  };

  const els = {
    tables: $('#tables'),
    numbers: $('#numbers'),
    numberPickerWrap: $('#numberPickerWrap'),
    allNumbersBtn: $('#allNumbers'),
    customNumbersBtn: $('#customNumbers'),
    timeButtons: $$('#timeChoices button'),
    startBtn: $('#startBtn'),
    resetBtn: $('#resetBtn'),
    answerForm: $('#answerForm'),
    answerInput: $('#answer'),
    answerBtn: $('#answerBtn'),
    example: $('#example'),
    message: $('#message'),
    timeLeft: $('#timeLeft'),
    correctCount: $('#correctCount'),
    wrongCount: $('#wrongCount'),
    tableHint: $('#tableHint'),
    timeProgress: $('#timeProgress'),
    task: $('#multiplicationTab .task')
  };

  function getPool() {
    return state.mode === 'all' ? allMultipliers : [...state.selected];
  }

  function setNextQuestion() {
    const tables = [...state.selectedTables];
    const multipliers = getPool();
    let nextTable = tables[Math.floor(Math.random() * tables.length)];
    let nextMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
    let nextQuestion = `${nextTable}x${nextMultiplier}`;

    if (tables.length * multipliers.length > 1) {
      while (nextQuestion === state.lastQuestion) {
        nextTable = tables[Math.floor(Math.random() * tables.length)];
        nextMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
        nextQuestion = `${nextTable}x${nextMultiplier}`;
      }
    }

    state.currentTable = nextTable;
    state.currentMultiplier = nextMultiplier;
    state.lastQuestion = nextQuestion;
    state.questionStartedAt = Date.now();
  }

  function showQuestion(animate = true) {
    const text = `${state.currentTable} × ${state.currentMultiplier}`;
    if (animate) {
      animateExample(els.example, text);
    } else {
      els.example.textContent = text;
    }
  }

  function showIdleExample() {
    els.example.textContent = '—';
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

  function nextQuestion() {
    setNextQuestion();
    els.answerInput.value = '';
    els.answerInput.disabled = false;
    els.answerBtn.disabled = false;
    showQuestion(true);
    els.answerInput.focus();
  }

  function finish() {
    stopTimer();
    state.running = false;
    els.answerInput.disabled = true;
    els.answerBtn.disabled = true;
    showMessage(els.message, `Готово: ${state.correct} верно, ${state.wrong} ошибок`, 'good');
  }

  function start() {
    stopTimer();
    state.correct = 0;
    state.wrong = 0;
    state.running = true;
    state.secondsLeft = state.duration;
    setNextQuestion();
    els.answerInput.disabled = false;
    els.answerBtn.disabled = false;
    els.answerInput.value = '';
    els.answerInput.focus();
    showQuestion(true);
    updateStats();
    showMessage(els.message, 'Решайте пример', '');

    if (state.timeMode === 'timed') {
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
    state.running = false;
    state.secondsLeft = state.duration;
    state.questionStartedAt = null;
    els.answerInput.disabled = true;
    els.answerBtn.disabled = true;
    els.answerInput.value = '';
    showIdleExample();
    updateStats();
    showMessage(els.message, 'Нажмите “Старт”', '');
  }

  function renderTables() {
    els.tables.innerHTML = '';
    tableOptions.forEach((table) => {
      els.tables.appendChild(
        makeButton(table, state.selectedTables.has(table), () => {
          if (state.selectedTables.has(table) && state.selectedTables.size > 1) {
            state.selectedTables.delete(table);
          } else {
            state.selectedTables.add(table);
          }
          renderTables();
        })
      );
    });
    els.tableHint.textContent = `Выбрано: ${[...state.selectedTables].join(', ')}`;
  }

  function renderNumbers() {
    els.numbers.innerHTML = '';
    allMultipliers.forEach((number) => {
      els.numbers.appendChild(
        makeButton(number, state.selected.has(number), () => {
          if (state.selected.has(number) && state.selected.size > 1) {
            state.selected.delete(number);
          } else {
            state.selected.add(number);
          }
          renderNumbers();
        })
      );
    });
  }

  function setNumberMode(mode) {
    state.mode = mode;
    setPressed(els.allNumbersBtn, mode === 'all');
    setPressed(els.customNumbersBtn, mode === 'custom');
    els.numberPickerWrap.classList.toggle('hidden', mode !== 'custom');
    if (mode === 'all') {
      state.selected = new Set(allMultipliers);
      renderNumbers();
    }
    if (!state.running) {
      showIdleExample();
    }
  }

  function setTimeMode(seconds) {
    state.duration = seconds;
    state.timeMode = seconds === null ? 'free' : 'timed';
    els.timeButtons.forEach((button) => {
      setPressed(
        button,
        String(seconds) === button.dataset.seconds || (seconds === null && button.dataset.seconds === 'free')
      );
    });
    state.secondsLeft = seconds;
    updateStats();
  }

  Trainer.stopMultiplication = function stopMultiplication() {
    stopTimer();
    state.running = false;
  };

  Trainer.initMultiplication = function initMultiplication() {
    els.allNumbersBtn.addEventListener('click', () => setNumberMode('all'));
    els.customNumbersBtn.addEventListener('click', () => setNumberMode('custom'));
    els.timeButtons.forEach((button) => {
      button.addEventListener('click', () =>
        setTimeMode(button.dataset.seconds === 'free' ? null : Number(button.dataset.seconds))
      );
    });
    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', reset);

    els.answerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!state.running) {
        return;
      }
      if (els.answerInput.value.trim() === '') {
        showMessage(els.message, 'Введите ответ', 'bad');
        flashAnswer(els.answerInput, false);
        return;
      }

      const userAnswer = Number(els.answerInput.value);
      const rightAnswer = state.currentTable * state.currentMultiplier;
      const isCorrect = userAnswer === rightAnswer;
      recordAttempt(
        'multiplication',
        `${state.currentTable} × ${state.currentMultiplier}`,
        isCorrect,
        state.questionStartedAt
      );

      flashAnswer(els.answerInput, isCorrect);
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
          `Ошибка: ${state.currentTable} × ${state.currentMultiplier} = ${rightAnswer}`,
          'bad'
        );
        els.answerInput.disabled = true;
        els.answerBtn.disabled = true;
        state.nextTimer = window.setTimeout(() => {
          if (state.running) {
            nextQuestion();
          }
        }, 900);
      }
      updateStats();
    });

    renderTables();
    renderNumbers();
    reset();
  };
})();
