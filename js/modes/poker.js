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
    pushSessionAttempt,
    recordAttempt,
    showSessionSummary
  } = Trainer;

  const {
    computePokerPayout,
    computeUltimateParts,
    formatMoney,
    trainRows
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

  /** Джекпот: чаще 5/10/15/20/30. Обычные: чаще 25/30/35/40. Чем выше — тем реже. */
  const JACKPOT_W = {
    5: 20, 10: 18, 15: 16, 20: 14, 25: 6, 30: 12, 35: 4, 40: 4, 45: 3, 50: 3
  };
  const STD_W = {
    25: 20, 30: 18, 35: 16, 40: 14, 45: 5, 50: 5
  };

  function stakeWeight(stake, kind) {
    const table = kind === 'jackpot' ? JACKPOT_W : STD_W;
    if (table[stake]) {
      return table[stake];
    }
    if (kind === 'jackpot') {
      return stake <= 70 ? 2 : 1;
    }
    if (stake <= 70) {
      return 3;
    }
    if (stake <= 100) {
      return 2;
    }
    return 1;
  }

  /** Разворачиваем список ставок по весу (для равномерного random по пулу). */
  function expandStakes(stakes, kind) {
    const out = [];
    stakes.forEach((s) => {
      const w = stakeWeight(s, kind);
      for (let i = 0; i < w; i += 1) {
        out.push(s);
      }
    });
    return out;
  }

  const CATALOG = Trainer.payoutCatalog?.games || {};
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
    answerBlind: $('#pokerAnswerBlind'),
    answerAnte: $('#pokerAnswerAnte'),
    singleInputs: $('#pokerSingleInputs'),
    ultimateInputs: $('#pokerUltimateInputs'),
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

  function isUltimateQ(q) {
    return q && q.pay === 'ultimate';
  }

  function setAnswerMode(ultimate) {
    els.singleInputs?.classList.toggle('hidden', ultimate);
    els.ultimateInputs?.classList.toggle('hidden', !ultimate);
  }

  function clearAnswers() {
    if (els.answer) {
      els.answer.value = '';
    }
    if (els.answerBlind) {
      els.answerBlind.value = '';
    }
    if (els.answerAnte) {
      els.answerAnte.value = '';
    }
  }

  function setAnswersEnabled(enabled) {
    if (els.answer) {
      els.answer.disabled = !enabled;
    }
    if (els.answerBlind) {
      els.answerBlind.disabled = !enabled;
    }
    if (els.answerAnte) {
      els.answerAnte.disabled = !enabled;
    }
    if (els.answerBtn) {
      els.answerBtn.disabled = !enabled;
    }
  }

  function focusAnswer(q) {
    if (isUltimateQ(q) && els.answerBlind) {
      keepAnswerFocus(els.answerBlind);
      return;
    }
    keepAnswerFocus(els.answer);
  }

  function stakesFor(cat) {
    return cat.stake === 'jackpot' ? STAKES_JACKPOT : STAKES_STD;
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

  const session = Trainer.createTimedSession({
    state,
    els,
    summaryTitle: 'Итог: Покер / бонусы'
  });
  const { updateStats, stopTimers: stopTimer } = session;

  function selectedCatalog() {
    return ALL_IDS.filter((id) => state.selected.has(id)).map((id) => CATALOG[id]);
  }

  function buildPool() {
    const pool = [];
    selectedCatalog().forEach((cat) => {
      const kind = cat.stake === 'jackpot' ? 'jackpot' : 'std';
      const stakes = expandStakes(stakesFor(cat), kind);
      const playMults = cat.pay === 'ultimate' ? cat.playMults || [1, 2, 4] : [null];
      trainRows(cat).forEach((row) => {
        stakes.forEach((stake) => {
          playMults.forEach((playMult) => {
            const item = {
              gameId: cat.id,
              game: cat.label,
              short: cat.short,
              pay: cat.pay,
              hand: row.hand,
              mult: row.mult,
              playMult,
              stake,
              answer: computePokerPayout(cat.pay, stake, row.mult, playMult),
              key: `${cat.id}|${row.hand}|${stake}|${playMult ?? ''}`
            };
            if (cat.pay === 'ultimate') {
              const parts = computeUltimateParts(stake, row.mult, playMult);
              item.answerBlind = parts.blind;
              item.answerAntePlay = parts.antePlay;
              item.answer = parts.total;
            }
            pool.push(item);
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
      'Бонусы: ставка×коэф. Техас: анте×коэф+бет1:1 (бет=2×анте). Русский: бет=2×анте, бет×коэф. ' +
      'Ультимейт: Blind (от стрита, ниже 0) и Ante+Play (Play ×1/×2/×4).';
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
      Trainer.replayClass?.(els.meta, 'is-enter');
    }
    return true;
  }

  function nextQuestion() {
    if (!setNextQuestion(true)) {
      return;
    }
    const q = state.current;
    setAnswerMode(isUltimateQ(q));
    clearAnswers();
    setAnswersEnabled(true);
    focusAnswer(q);
  }

  function finish() {
    session.finish(() => setAnswersEnabled(false));
  }

  function start() {
    if (!state.selected.size) {
      showMessage(els.message, 'Выберите хотя бы одну игру', 'bad');
      return;
    }
    session.beginRun();
    nextQuestion();
    updateStats();
    showMessage(els.message, 'Назовите выплату', '');
    session.startClock(finish);
  }

  function reset() {
    const prev = session.resetRun();
    showIdleExample();
    setAnswerMode(false);
    clearAnswers();
    setAnswersEnabled(false);
    updateStats();
    showMessage(els.message, 'Нажмите «Старт»', '');
    session.presentSummary(prev.correct, prev.wrong, prev.log);
  }

  function loadSavedSettings() {
    if (!getSettings) {
      return;
    }
    const saved = getSettings().poker || {};
    session.applySavedDuration(saved);
    if (Array.isArray(saved.selected) && saved.selected.length) {
      const valid = saved.selected
        .map((id) => (id === 'ultimate_blind' ? 'ultimate' : id))
        .filter((id) => CATALOG[id]);
      if (valid.length) {
        state.selected = new Set(valid);
      }
    }
    session.syncTimeButtons(els.timeButtons);
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

    session.bindTimeButtons(els.timeButtons, persistSettings);

    els.selectAllBtn?.addEventListener('click', () => setAll(true));
    els.selectNoneBtn?.addEventListener('click', () => setAll(false));
    els.startBtn.addEventListener('click', start);
    els.resetBtn.addEventListener('click', reset);

    els.answerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!state.running || !state.current || session.isWaiting()) {
        return;
      }

      const q = state.current;
      const ultimate = isUltimateQ(q);
      let isCorrect = false;
      let label;

      if (ultimate) {
        const rawBlind = els.answerBlind?.value.trim() ?? '';
        const rawAnte = els.answerAnte?.value.trim() ?? '';
        if (rawBlind === '' || rawAnte === '') {
          showMessage(els.message, 'Введите блайнд и анте+бет', 'bad');
          if (rawBlind === '') {
            flashAnswer(els.answerBlind, false);
          }
          if (rawAnte === '') {
            flashAnswer(els.answerAnte, false);
          }
          return;
        }
        const givenBlind = parseUserAnswer(rawBlind);
        const givenAnte = parseUserAnswer(rawAnte);
        const expBlind = q.answerBlind;
        const expAnte = q.answerAntePlay;
        const okBlind = Number.isFinite(givenBlind) && Math.abs(givenBlind - expBlind) < 0.001;
        const okAnte = Number.isFinite(givenAnte) && Math.abs(givenAnte - expAnte) < 0.001;
        isCorrect = okBlind && okAnte;
        label =
          `${q.short}: ${q.hand} · Ante ${formatMoney(q.stake)} · Play ×${q.playMult} → ` +
          `Blind ${formatMoney(expBlind)} · Ante+Play ${formatMoney(expAnte)}`;
        flashAnswer(els.answerBlind, okBlind);
        flashAnswer(els.answerAnte, okAnte);
      } else {
        if (els.answer.value.trim() === '') {
          showMessage(els.message, 'Введите выплату', 'bad');
          flashAnswer(els.answer, false);
          return;
        }
        const expected = q.answer;
        const given = parseUserAnswer(els.answer.value);
        isCorrect = Number.isFinite(given) && Math.abs(given - expected) < 0.001;
        if (q.pay === 'russian') {
          const bet = q.stake * 2;
          label = `${q.short}: ${q.hand} · Ante ${formatMoney(q.stake)} (бет ${formatMoney(bet)}) → ${formatMoney(expected)}`;
        } else if (q.pay === 'texas') {
          const bet = q.stake * 2;
          label = `${q.short}: ${q.hand} · Ante ${formatMoney(q.stake)} (бет ${formatMoney(bet)}) → ${formatMoney(expected)}`;
        } else {
          label = `${q.short}: ${q.hand} · ${formatMoney(q.stake)} → ${formatMoney(expected)}`;
        }
        flashAnswer(els.answer, isCorrect);
      }

      session.record('poker', label, isCorrect);
      flashTask(els.task, isCorrect);

      if (isCorrect) {
        showMessage(els.message, 'Верно', 'good');
        nextQuestion();
      } else {
        showMessage(els.message, `Ошибка: ${label}`, 'bad');
        if (ultimate) {
          keepAnswerFocus(els.answerBlind);
        } else {
          keepAnswerFocus(els.answer);
        }
        session.scheduleNext(nextQuestion, 1100);
      }
    });

    reset();
  };
})();
