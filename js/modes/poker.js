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
    getSettings,
    saveSettings,
    pushSessionAttempt,
    showSessionSummary
  } = Trainer;

  function range(min, max, step) {
    const out = [];
    for (let v = min; v <= max + 1e-9; v += step) {
      out.push(v);
    }
    return out;
  }

  const STAKES_STD = range(25, 200, 5);
  const STAKES_JACKPOT = range(5, 100, 5);

  /**
   * pay:
   *  - bonus    — только ставка × коэф
   *  - texas    — анте по коэф + бет 1:1 (бет = анте) → stake × (mult + 1)
   *  - russian  — дан ante + комбо; бет = 2×ante (в уме); выплата = бет × коэф
   *  - ultimate — полная: Ante 1:1 + Play 1:1 + Blind×коэф (Blind=Ante, Play=k×Ante)
   *               ниже стрита Blind push (×0). Play k ∈ {1, 2, 4}
   */
  const CATALOG = {
    jackpot: {
      id: 'jackpot',
      label: 'Джекпот-бонус',
      short: 'Джекпот',
      stake: 'jackpot',
      pay: 'bonus',
      rows: [
        { hand: 'Две пары', mult: 2 },
        { hand: 'Тройка', mult: 10 },
        { hand: 'Стрит', mult: 25 },
        { hand: 'Флеш', mult: 50 },
        { hand: 'Фул-хаус', mult: 100 },
        { hand: 'Каре', mult: 250 }
      ]
    },
    sixcard: {
      id: 'sixcard',
      label: 'Шестикарточный',
      short: '6-карт',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Стрит · с раздачи', mult: 25 },
        { hand: 'Стрит · с покупкой', mult: 7 },
        { hand: 'Флеш · с раздачи', mult: 50 },
        { hand: 'Флеш · с покупкой', mult: 15 },
        { hand: 'Фул-хаус · с раздачи', mult: 100 },
        { hand: 'Фул-хаус · с покупкой', mult: 30 },
        { hand: 'Каре · с раздачи', mult: 300 },
        { hand: 'Каре · с покупкой', mult: 100 },
        { hand: 'Стрит-флеш · с раздачи', mult: 500 },
        { hand: 'Стрит-флеш · с покупкой', mult: 150 },
        { hand: 'Роял-флеш · с раздачи', mult: 1000 },
        { hand: 'Роял-флеш · с покупкой', mult: 300 }
      ]
    },
    texas: {
      id: 'texas',
      label: 'Техасский холдем',
      short: 'Техас',
      stake: 'std',
      pay: 'texas',
      rows: [
        { hand: 'Пара', mult: 1 },
        { hand: 'Две пары', mult: 1 },
        { hand: 'Тройка', mult: 1 },
        { hand: 'Стрит', mult: 1 },
        { hand: 'Флеш', mult: 2 },
        { hand: 'Фул-хаус', mult: 3 },
        { hand: 'Каре', mult: 10 },
        { hand: 'Стрит-флеш', mult: 20 },
        { hand: 'Роял-флеш', mult: 100 }
      ]
    },
    aa: {
      id: 'aa',
      label: 'Бонус AA',
      short: 'AA',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Пара тузов', mult: 7 },
        { hand: 'Две пары', mult: 7 },
        { hand: 'Тройка', mult: 7 },
        { hand: 'Стрит', mult: 7 },
        { hand: 'Флеш', mult: 20 },
        { hand: 'Фул-хаус', mult: 30 },
        { hand: 'Каре', mult: 40 },
        { hand: 'Стрит-флеш', mult: 50 },
        { hand: 'Роял-флеш', mult: 100 }
      ]
    },
    trips: {
      id: 'trips',
      label: 'Бонус Trips',
      short: 'Trips',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Тройка', mult: 3 },
        { hand: 'Стрит', mult: 4 },
        { hand: 'Флеш', mult: 7 },
        { hand: 'Фул-хаус', mult: 8 },
        { hand: 'Каре', mult: 30 },
        { hand: 'Стрит-флеш', mult: 40 },
        { hand: 'Роял-флеш', mult: 50 }
      ]
    },
    ultimate: {
      id: 'ultimate',
      label: 'Ультимейт',
      short: 'Ультимейт',
      stake: 'std',
      pay: 'ultimate',
      // Play: ×1 (ривер), ×2 (флоп), ×4 (префлоп)
      playMults: [1, 2, 4],
      rows: [
        { hand: 'Пара', mult: 0 },
        { hand: 'Две пары', mult: 0 },
        { hand: 'Тройка', mult: 0 },
        { hand: 'Стрит', mult: 1 },
        { hand: 'Флеш', mult: 1.5 },
        { hand: 'Фул-хаус', mult: 3 },
        { hand: 'Каре', mult: 10 },
        { hand: 'Стрит-флеш', mult: 50 },
        { hand: 'Роял-флеш', mult: 500 }
      ]
    },
    novo: {
      id: 'novo',
      label: 'Novo Poker',
      short: 'Novo',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Карты одного цвета', mult: 2 },
        { hand: 'Туз · король · дама', mult: 5 },
        { hand: 'Тройка', mult: 8 },
        { hand: 'Стрит', mult: 30 },
        { hand: 'Флеш', mult: 60 },
        { hand: 'Фул-хаус', mult: 100 },
        { hand: 'Пять картинок', mult: 120 },
        { hand: 'Каре', mult: 200 }
      ]
    },
    russian: {
      id: 'russian',
      label: 'Русский покер',
      short: 'Рус. покер',
      stake: 'std',
      pay: 'russian',
      // Ante на экране; бет = 2×ante в уме; выплата = бет × коэф
      rows: [
        { hand: 'Тройка', mult: 3 },
        { hand: 'Стрит', mult: 4 },
        { hand: 'Флеш', mult: 5 },
        { hand: 'Фул-хаус', mult: 7 },
        { hand: 'Каре', mult: 20 },
        { hand: 'Стрит-флеш', mult: 50 },
        { hand: 'Роял-флеш', mult: 100 }
      ]
    },
    bj20: {
      id: 'bj20',
      label: 'BJ · бонус 20',
      short: 'BJ 20',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Любые 20', mult: 5 },
        { hand: 'Одномастные 20', mult: 10 },
        { hand: 'Одинаковые 20', mult: 30 },
        { hand: 'Два крестовых короля', mult: 100 }
      ]
    },
    bj_jackpot: {
      id: 'bj_jackpot',
      label: 'BJ · джекпот',
      short: 'BJ JP',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Блекджек', mult: 2 },
        { hand: 'Одномастный блекджек', mult: 10 },
        { hand: 'Дама + король одномастные', mult: 25 },
        { hand: 'Две семёрки', mult: 50 },
        { hand: 'Две одномастные семёрки', mult: 100 },
        { hand: 'Три семёрки', mult: 250 }
      ]
    }
  };

  const ALL_IDS = Object.keys(CATALOG);

  const state = {
    duration: 60,
    secondsLeft: 60,
    correct: 0,
    wrong: 0,
    running: false,
    timer: null,
    nextTimer: null,
    selected: new Set(ALL_IDS),
    current: null,
    lastKey: null,
    questionStartedAt: null,
    sessionLog: []
  };

  const els = {
    timeButtons: $$('#pokerTimeChoices button'),
    games: $('#pokerGameChoices'),
    selectAllBtn: $('#pokerSelectAllBtn'),
    selectNoneBtn: $('#pokerSelectNoneBtn'),
    startBtn: $('#pokerStartBtn'),
    resetBtn: $('#pokerResetBtn'),
    answerForm: $('#pokerAnswerForm'),
    answer: $('#pokerAnswer'),
    answerBtn: $('#pokerAnswerBtn'),
    example: $('#pokerExample'),
    meta: $('#pokerMeta'),
    message: $('#pokerMessage'),
    timeLeft: $('#pokerTimeLeft'),
    correctCount: $('#pokerCorrectCount'),
    wrongCount: $('#pokerWrongCount'),
    timeProgress: $('#pokerTimeProgress'),
    task: $('#pokerTab .task'),
    hint: $('#pokerHint')
  };

  function stakesFor(cat) {
    return cat.stake === 'jackpot' ? STAKES_JACKPOT : STAKES_STD;
  }

  function formatMoney(n) {
    if (Number.isInteger(n)) {
      return String(n);
    }
    return String(Math.round(n * 100) / 100).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }

  function roundPay(n) {
    return Math.round(n * 1000) / 1000;
  }

  /**
   * stake — бонусная ставка или Ante
   * mult — коэф комбо (для ultimate — коэф Blind; 0 = push)
   * playMult — множитель Play к Ante (только ultimate)
   */
  function computeAnswer(pay, stake, mult, playMult) {
    if (pay === 'russian') {
      // Бет = 2 × Ante; выплата по бету: (2 × ante) × mult
      return roundPay(stake * 2 * mult);
    }
    if (pay === 'texas') {
      // Ante × mult + Bet × 1, Bet = Ante
      return roundPay(stake * mult + stake);
    }
    if (pay === 'ultimate') {
      // Ante 1:1 + Play 1:1 + Blind×mult; Blind = Ante, Play = playMult×Ante
      // Пример: ante 25, play ×4, флеш 1.5 → 25 + 100 + 37.5 = 162.5
      const k = playMult || 1;
      return roundPay(stake + stake * k + stake * mult);
    }
    // bonus — только ставка × коэф
    return roundPay(stake * mult);
  }

  function stakeLabel(pay) {
    if (pay === 'russian' || pay === 'texas' || pay === 'ultimate') {
      return 'Ante';
    }
    return 'Ставка';
  }

  function persistSettings() {
    if (saveSettings) {
      saveSettings({
        poker: {
          duration: state.duration,
          selected: Array.from(state.selected)
        }
      });
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

  function selectedCatalog() {
    return ALL_IDS.filter((id) => state.selected.has(id)).map((id) => CATALOG[id]);
  }

  function buildPool() {
    const pool = [];
    selectedCatalog().forEach((cat) => {
      const stakes = stakesFor(cat);
      const playMults = cat.pay === 'ultimate' ? cat.playMults || [1, 2, 4] : [null];
      cat.rows.forEach((row) => {
        stakes.forEach((stake) => {
          playMults.forEach((playMult) => {
            pool.push({
              gameId: cat.id,
              game: cat.label,
              short: cat.short,
              pay: cat.pay,
              hand: row.hand,
              mult: row.mult,
              playMult,
              stake,
              answer: computeAnswer(cat.pay, stake, row.mult, playMult),
              key: `${cat.id}|${row.hand}|${stake}|${playMult ?? ''}`
            });
          });
        });
      });
    });
    return pool;
  }

  function pickQuestion() {
    const pool = buildPool();
    if (!pool.length) {
      return null;
    }
    let q = pool[Math.floor(Math.random() * pool.length)];
    let guard = 0;
    while (pool.length > 1 && q.key === state.lastKey && guard < 12) {
      q = pool[Math.floor(Math.random() * pool.length)];
      guard += 1;
    }
    return q;
  }

  function renderChoiceButtons() {
    if (!els.games) {
      return;
    }
    els.games.innerHTML = '';
    ALL_IDS.forEach((id) => {
      const cat = CATALOG[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice poker-game-choice';
      btn.dataset.game = id;
      btn.setAttribute('aria-pressed', state.selected.has(id) ? 'true' : 'false');
      if (state.selected.has(id)) {
        btn.classList.add('active');
      }
      const stakeHint = cat.stake === 'jackpot' ? '5–100' : '25–200';
      btn.innerHTML = `<span class="poker-game-name">${cat.short}</span><span class="poker-game-stake">${stakeHint}</span>`;
      btn.title = cat.label;
      btn.addEventListener('click', () => toggleGame(id));
      els.games.appendChild(btn);
    });
    updateHint();
  }

  function updateHint() {
    if (!els.hint) {
      return;
    }
    const n = state.selected.size;
    if (n === 0) {
      els.hint.textContent = 'Выберите хотя бы одну игру или бонус.';
      return;
    }
    const names = selectedCatalog().map((c) => c.short).join(', ');
    els.hint.textContent =
      `Выбрано: ${n} · ${names}. ` +
      'Бонусы: ставка×коэф. Техас: анте×коэф+бет1:1. Русский: бет=2×анте, бет×коэф. ' +
      'Ультимейт: Ante+Play+Blind (Play ×1/×2/×4).';
  }

  function toggleGame(id) {
    if (state.running) {
      return;
    }
    if (state.selected.has(id)) {
      if (state.selected.size === 1) {
        showMessage(els.message, 'Нужна хотя бы одна игра', 'bad');
        return;
      }
      state.selected.delete(id);
    } else {
      state.selected.add(id);
    }
    const btn = els.games?.querySelector(`[data-game="${id}"]`);
    if (btn) {
      const on = state.selected.has(id);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    updateHint();
    persistSettings();
  }

  function setAll(on) {
    if (state.running) {
      return;
    }
    state.selected = new Set(on ? ALL_IDS : [ALL_IDS[0]]);
    renderChoiceButtons();
    persistSettings();
  }

  function showIdleExample() {
    state.current = null;
    state.questionStartedAt = null;
    if (els.example) {
      els.example.textContent = '—';
    }
    if (els.meta) {
      els.meta.textContent = 'Выберите игры и нажмите «Старт»';
    }
  }

  function setNextQuestion(animate = true) {
    const q = pickQuestion();
    if (!q) {
      showIdleExample();
      showMessage(els.message, 'Нет выбранных игр', 'bad');
      return false;
    }
    state.current = q;
    state.lastKey = q.key;
    state.questionStartedAt = Date.now();
    const line = `${formatMoney(q.stake)}`;
    if (animate) {
      animateExample(els.example, line);
    } else {
      els.example.textContent = line;
    }
    if (els.meta) {
      let html =
        `<span class="poker-meta-game">${q.game}</span>` +
        `<span class="poker-meta-sep">·</span>` +
        `<span class="poker-meta-hand">${stakeLabel(q.pay)}</span>` +
        `<span class="poker-meta-sep">·</span>` +
        `<span class="poker-meta-hand">${q.hand}</span>`;
      if (q.pay === 'ultimate' && q.playMult != null) {
        html +=
          `<span class="poker-meta-sep">·</span>` +
          `<span class="poker-meta-hand">Play ×${q.playMult}</span>`;
      }
      els.meta.innerHTML = html;
    }
    return true;
  }

  function nextQuestion() {
    if (!setNextQuestion(true)) {
      return;
    }
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
      title: 'Итог: Покер / бонусы',
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
    if (!state.selected.size) {
      showMessage(els.message, 'Выберите хотя бы одну игру', 'bad');
      return;
    }
    stopTimer();
    state.correct = 0;
    state.wrong = 0;
    state.sessionLog = [];
    state.secondsLeft = state.duration;
    state.running = true;
    nextQuestion();
    updateStats();
    showMessage(els.message, 'Назовите выплату', '');

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
    const saved = getSettings().poker || {};
    if (saved.duration === null || typeof saved.duration === 'number') {
      state.duration = saved.duration;
      state.secondsLeft = saved.duration;
    }
    if (Array.isArray(saved.selected) && saved.selected.length) {
      const valid = saved.selected
        .map((id) => (id === 'ultimate_blind' ? 'ultimate' : id))
        .filter((id) => CATALOG[id]);
      if (valid.length) {
        state.selected = new Set(valid);
      }
    }
    els.timeButtons.forEach((button) => {
      setPressed(
        button,
        String(state.duration) === button.dataset.seconds ||
          (state.duration === null && button.dataset.seconds === 'free')
      );
    });
  }

  function parseUserAnswer(raw) {
    const cleaned = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
    if (cleaned === '' || cleaned === '.' || cleaned === '-') {
      return NaN;
    }
    return Number(cleaned);
  }

  Trainer.stopPoker = function stopPoker() {
    stopTimer();
    state.running = false;
  };

  Trainer.initPoker = function initPoker() {
    loadSavedSettings();
    renderChoiceButtons();

    els.timeButtons.forEach((button) => {
      button.addEventListener('click', () =>
        setTime(button.dataset.seconds === 'free' ? null : Number(button.dataset.seconds))
      );
    });

    els.selectAllBtn?.addEventListener('click', () => setAll(true));
    els.selectNoneBtn?.addEventListener('click', () => setAll(false));
    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', reset);

    els.answerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!state.running || !state.current) {
        return;
      }
      if (els.answer.value.trim() === '') {
        showMessage(els.message, 'Введите выплату', 'bad');
        flashAnswer(els.answer, false);
        return;
      }

      const q = state.current;
      const expected = q.answer;
      const given = parseUserAnswer(els.answer.value);
      const isCorrect = Number.isFinite(given) && Math.abs(given - expected) < 0.001;
      let label;
      if (q.pay === 'russian') {
        const bet = q.stake * 2;
        label = `${q.short}: ${q.hand} · Ante ${formatMoney(q.stake)} (бет ${formatMoney(bet)}) → ${formatMoney(expected)}`;
      } else if (q.pay === 'texas') {
        label = `${q.short}: ${q.hand} · Ante ${formatMoney(q.stake)} → ${formatMoney(expected)}`;
      } else if (q.pay === 'ultimate') {
        label = `${q.short}: ${q.hand} · Ante ${formatMoney(q.stake)} · Play ×${q.playMult} → ${formatMoney(expected)}`;
      } else {
        label = `${q.short}: ${q.hand} · ${formatMoney(q.stake)} → ${formatMoney(expected)}`;
      }

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
        }, 1100);
      }
      updateStats();
    });

    reset();
  };
})();
