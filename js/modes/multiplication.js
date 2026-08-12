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
    recordAttempt,
    getSettings,
    saveSettings,
    pushSessionAttempt,
    showSessionSummary
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
    questionStartedAt: null,
    sessionLog: []
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

  function persistSettings() {
    if (!saveSettings) {
      return;
    }
    saveSettings({
      multiplication: {
        tables: [...state.selectedTables],
        mode: state.mode,
        multipliers: state.mode === 'custom' ? [...state.selected] : null,
        duration: state.duration
      }
    });
  }

  const session = Trainer.createTimedSession({
    state,
    els,
    summaryTitle: 'Итог: умножение'
  });
  const { updateStats, stopTimers: stopTimer } = session;

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

  function nextQuestion() {
    setNextQuestion();
    els.answerInput.value = '';
    els.answerInput.disabled = false;
    els.answerBtn.disabled = false;
    showQuestion(true);
    els.answerInput.focus();
  }

  function finish() {
    session.finish(() => {
      els.answerInput.disabled = true;
      els.answerBtn.disabled = true;
    });
  }

  function start() {
    session.beginRun();
    setNextQuestion();
    els.answerInput.disabled = false;
    els.answerBtn.disabled = false;
    els.answerInput.value = '';
    els.answerInput.focus();
    showQuestion(true);
    updateStats();
    showMessage(els.message, 'Решайте пример', '');
    session.startClock(finish);
  }

  function reset() {
    const prev = session.resetRun();
    els.answerInput.disabled = true;
    els.answerBtn.disabled = true;
    els.answerInput.value = '';
    showIdleExample();
    updateStats();
    showMessage(els.message, 'Нажмите “Старт”', '');
    session.presentSummary(prev.correct, prev.wrong, prev.log);
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
          persistSettings();
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
          persistSettings();
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
    persistSettings();
  }

  function loadSavedSettings() {
    if (!getSettings) {
      return;
    }
    const saved = getSettings().multiplication || {};
    if (Array.isArray(saved.tables) && saved.tables.length) {
      state.selectedTables = new Set(saved.tables.filter((t) => tableOptions.includes(t)));
      if (!state.selectedTables.size) {
        state.selectedTables = new Set([5]);
      }
    }
    if (saved.mode === 'custom' || saved.mode === 'all') {
      state.mode = saved.mode;
    }
    if (state.mode === 'custom' && Array.isArray(saved.multipliers) && saved.multipliers.length) {
      state.selected = new Set(saved.multipliers.filter((n) => n >= 1 && n <= 20));
      if (!state.selected.size) {
        state.selected = new Set(allMultipliers);
      }
    }
    session.applySavedDuration(saved);
    setPressed(els.allNumbersBtn, state.mode === 'all');
    setPressed(els.customNumbersBtn, state.mode === 'custom');
    els.numberPickerWrap.classList.toggle('hidden', state.mode !== 'custom');
    session.syncTimeButtons(els.timeButtons);
  }

  Trainer.stopMultiplication = function stopMultiplication() {
    stopTimer();
    state.running = false;
  };

  Trainer.initMultiplication = function initMultiplication() {
    loadSavedSettings();

    els.allNumbersBtn.addEventListener('click', () => setNumberMode('all'));
    els.customNumbersBtn.addEventListener('click', () => setNumberMode('custom'));
    session.bindTimeButtons(els.timeButtons, persistSettings);
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
      const label = `${state.currentTable} × ${state.currentMultiplier}`;
      session.record('multiplication', label, isCorrect);

      flashAnswer(els.answerInput, isCorrect);
      flashTask(els.task, isCorrect);

      if (isCorrect) {
        showMessage(els.message, 'Верно', 'good');
        nextQuestion();
      } else {
        showMessage(els.message, `Ошибка: ${label} = ${rightAnswer}`, 'bad');
        els.answerInput.disabled = true;
        els.answerBtn.disabled = true;
        session.scheduleNext(nextQuestion, 900);
      }
    });

    renderTables();
    renderNumbers();
    reset();
  };
})();
