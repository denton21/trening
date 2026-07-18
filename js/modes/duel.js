window.Trainer = window.Trainer || {};

(function () {
  const {
    $,
    $$,
    setPressed,
    animateExample,
    flashAnswer,
    flashTask,
    showMessage,
    winningSlotsForZero,
    winningSlotsForCell,
    payoutOf
  } = Trainer;

  const PRESSURE_SEC = 10;
  const PEER_PREFIX = 'rt-duel-';
  const MODE_LABELS = {
    multiplication: 'Умнож.',
    blackjack: 'BJ',
    counting: 'Счёт'
  };
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

  const state = {
    mode: 'multiplication',
    role: null,
    roomCode: null,
    peer: null,
    conn: null,
    phase: 'lobby',
    question: null,
    round: 0,
    meSolved: false,
    peerSolved: false,
    pressureEndsAt: null,
    pressureTimer: null,
    tickTimer: null,
    finished: false
  };

  const els = {
    lobby: $('#duelLobby'),
    waiting: $('#duelWaiting'),
    game: $('#duelGame'),
    modeButtons: $$('#duelModeChoices button'),
    createBtn: $('#duelCreateBtn'),
    joinBtn: $('#duelJoinBtn'),
    joinCode: $('#duelJoinCode'),
    lobbyMessage: $('#duelLobbyMessage'),
    roomCode: $('#duelRoomCode'),
    waitingHint: $('#duelWaitingHint'),
    copyCodeBtn: $('#duelCopyCodeBtn'),
    cancelBtn: $('#duelCancelBtn'),
    modeLabel: $('#duelModeLabel'),
    round: $('#duelRound'),
    timer: $('#duelTimer'),
    status: $('#duelStatus'),
    example: $('#duelExample'),
    boardWrap: $('#duelBoardWrap'),
    winLabel: $('#duelWinLabel'),
    board: $('#duelBoard'),
    zero: $('#duelZero'),
    grid: $('#duelGrid'),
    chips: $('#duelChips'),
    answerForm: $('#duelAnswerForm'),
    answer: $('#duelAnswer'),
    answerBtn: $('#duelAnswerBtn'),
    message: $('#duelMessage'),
    task: $('#duelTask'),
    endActions: $('#duelEndActions'),
    backBtn: $('#duelBackBtn')
  };

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function makeRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i += 1) {
      code += alphabet[randInt(0, alphabet.length - 1)];
    }
    return code;
  }

  function peerIdFromCode(code) {
    return `${PEER_PREFIX}${String(code).trim().toUpperCase()}`;
  }

  function send(msg) {
    if (state.conn && state.conn.open) {
      state.conn.send(msg);
    }
  }

  function clearPressureTimers() {
    if (state.pressureTimer) {
      window.clearTimeout(state.pressureTimer);
      state.pressureTimer = null;
    }
    if (state.tickTimer) {
      window.clearInterval(state.tickTimer);
      state.tickTimer = null;
    }
    state.pressureEndsAt = null;
    if (els.timer) {
      els.timer.textContent = '—';
      els.timer.classList.remove('is-danger');
    }
  }

  function destroyPeer() {
    clearPressureTimers();
    try {
      if (state.conn) {
        state.conn.close();
      }
    } catch {
      // ignore
    }
    try {
      if (state.peer) {
        state.peer.destroy();
      }
    } catch {
      // ignore
    }
    state.conn = null;
    state.peer = null;
    state.role = null;
    state.roomCode = null;
    state.question = null;
    state.round = 0;
    state.meSolved = false;
    state.peerSolved = false;
    state.finished = false;
    state.phase = 'lobby';
  }

  function showLobby() {
    destroyPeer();
    els.lobby.classList.remove('hidden');
    els.waiting.classList.add('hidden');
    els.game.classList.add('hidden');
    els.endActions.classList.add('hidden');
    els.answer.value = '';
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
    showMessage(els.lobbyMessage, '', '');
    showMessage(els.message, '', '');
  }

  function showWaiting(code) {
    els.lobby.classList.add('hidden');
    els.waiting.classList.remove('hidden');
    els.game.classList.add('hidden');
    els.roomCode.textContent = code;
    els.waitingHint.textContent = 'Ждём второго игрока… Нужен интернет у обоих.';
  }

  function showGame() {
    els.lobby.classList.add('hidden');
    els.waiting.classList.add('hidden');
    els.game.classList.remove('hidden');
    els.endActions.classList.add('hidden');
    state.phase = 'playing';
    state.finished = false;
  }

  /* ——— Генерация вопросов (хост) ——— */

  function buildNumberGrid(winNumber) {
    if (winNumber === 0) {
      return {
        numbers: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9]
        ],
        isZero: true
      };
    }
    const streetIndex = Math.floor((winNumber - 1) / 3);
    let firstStreet = streetIndex - 1;
    if (firstStreet < 0) firstStreet = 0;
    if (firstStreet > 9) firstStreet = 9;
    const numbers = [0, 1, 2].map((rowOffset) => {
      const base = (firstStreet + rowOffset) * 3 + 1;
      return [base, base + 1, base + 2];
    });
    let winRow = 0;
    let winCol = 0;
    numbers.forEach((row, ri) => {
      row.forEach((n, ci) => {
        if (n === winNumber) {
          winRow = ri;
          winCol = ci;
        }
      });
    });
    return { numbers, winCol, winRow, isZero: false };
  }

  function makeCountingQuestion() {
    const winNumber = Math.random() < 0.1 ? 0 : randInt(1, 36);
    const grid = buildNumberGrid(winNumber);
    const available = grid.isZero
      ? winningSlotsForZero()
      : winningSlotsForCell(grid.winCol, grid.winRow);
    const slotCount = Math.min(available.length, randInt(3, Math.min(6, available.length)));
    const straight = available.find((s) => s.type === 'straight');
    const rest = shuffle(available.filter((s) => s.type !== 'straight'));
    const chosen = [];
    if (straight) chosen.push(straight);
    for (const slot of rest) {
      if (chosen.length >= slotCount) break;
      chosen.push(slot);
    }
    const chips = chosen.map((slot) => ({
      type: slot.type,
      x: slot.x,
      y: slot.y,
      key: slot.key,
      count: randInt(1, 4)
    }));
    const answer = chips.reduce((sum, chip) => sum + chip.count * payoutOf(chip.type), 0);
    return {
      mode: 'counting',
      answer,
      winNumber,
      grid,
      chips
    };
  }

  function makeQuestion(mode) {
    if (mode === 'blackjack') {
      const bet = randInt(1, 40) * 5;
      return {
        mode: 'blackjack',
        display: String(bet),
        answer: bet * 1.5
      };
    }
    if (mode === 'counting') {
      return makeCountingQuestion();
    }
    const tables = [5, 8, 11, 17, 35];
    const table = tables[randInt(0, tables.length - 1)];
    const mult = randInt(1, 20);
    return {
      mode: 'multiplication',
      display: `${table} × ${mult}`,
      answer: table * mult
    };
  }

  /* ——— UI вопроса ——— */

  function cellColorClass(number) {
    if (number === 0) return '';
    return RED.has(number) ? 'is-red' : 'is-black';
  }

  function renderCountingBoard(q) {
    els.boardWrap.classList.remove('hidden');
    els.example.classList.add('hidden');
    els.winLabel.textContent = `Выпало: ${q.winNumber}`;
    els.grid.innerHTML = '';
    q.grid.numbers.forEach((row) => {
      row.forEach((number) => {
        const cell = document.createElement('div');
        cell.className = `counting-cell ${cellColorClass(number)}`.trim();
        if (number === q.winNumber) cell.classList.add('is-win');
        cell.textContent = String(number);
        els.grid.appendChild(cell);
      });
    });
    els.zero.classList.toggle('is-win', q.winNumber === 0);
    els.chips.innerHTML = '';
    q.chips.forEach((chip, index) => {
      const el = document.createElement('span');
      el.className = 'chip has-count';
      el.style.left = `${chip.x}%`;
      el.style.top = `${chip.y}%`;
      el.style.setProperty('--i', String(index));
      el.textContent = String(chip.count);
      els.chips.appendChild(el);
    });
  }

  function renderQuestion(q, animate = true) {
    state.question = q;
    state.meSolved = false;
    state.peerSolved = false;
    clearPressureTimers();
    els.answer.value = '';
    els.answer.disabled = false;
    els.answerBtn.disabled = false;
    els.endActions.classList.add('hidden');
    els.modeLabel.textContent = MODE_LABELS[state.mode] || state.mode;
    els.round.textContent = String(state.round);

    if (q.mode === 'counting') {
      renderCountingBoard(q);
      showMessage(els.message, 'Сложите выплаты', '');
      els.status.textContent = 'Одинаковое поле · кто быстрее';
    } else {
      els.boardWrap.classList.add('hidden');
      els.example.classList.remove('hidden');
      if (animate) {
        animateExample(els.example, q.display);
      } else {
        els.example.textContent = q.display;
      }
      showMessage(
        els.message,
        q.mode === 'blackjack' ? 'Выплата BJ 3:2 (×1.5)' : 'Ответьте на пример',
        ''
      );
      els.status.textContent = 'Одинаковый пример · кто быстрее';
    }

    els.answer.focus();
  }

  function startRoundFromHost() {
    state.round += 1;
    const q = makeQuestion(state.mode);
    renderQuestion(q, true);
    send({ type: 'question', round: state.round, question: q, mode: state.mode });
  }

  function startPressureAsFirst() {
    state.pressureEndsAt = Date.now() + PRESSURE_SEC * 1000;
    els.status.textContent = `Ты решил! У соперника ${PRESSURE_SEC} сек`;
    showMessage(els.message, 'Ждём соперника…', 'good');
    els.timer.classList.add('is-danger');

    state.tickTimer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((state.pressureEndsAt - Date.now()) / 1000));
      els.timer.textContent = `${left}с`;
    }, 200);
    els.timer.textContent = `${PRESSURE_SEC}с`;

    state.pressureTimer = window.setTimeout(() => {
      if (state.finished) return;
      if (state.meSolved && !state.peerSolved) {
        finishMatch(true);
        send({ type: 'end', youWin: false });
      }
    }, PRESSURE_SEC * 1000);
  }

  function startPressureAsSecond() {
    state.pressureEndsAt = Date.now() + PRESSURE_SEC * 1000;
    els.status.textContent = `Соперник решил! У тебя ${PRESSURE_SEC} сек`;
    showMessage(els.message, 'Быстрее! 10 секунд', 'bad');
    els.timer.classList.add('is-danger');
    els.answer.disabled = false;
    els.answerBtn.disabled = false;
    els.answer.focus();

    state.tickTimer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((state.pressureEndsAt - Date.now()) / 1000));
      els.timer.textContent = `${left}с`;
    }, 200);
    els.timer.textContent = `${PRESSURE_SEC}с`;

    state.pressureTimer = window.setTimeout(() => {
      if (state.finished) return;
      if (state.peerSolved && !state.meSolved) {
        finishMatch(false);
        // Хост/соперник тоже зафиксирует победу у себя по своему таймеру
      }
    }, PRESSURE_SEC * 1000);
  }

  function bothSolvedNext() {
    clearPressureTimers();
    els.status.textContent = 'Оба верно → следующий';
    showMessage(els.message, 'Оба успели!', 'good');
    els.answer.disabled = true;
    els.answerBtn.disabled = true;

    if (state.role === 'host') {
      window.setTimeout(() => {
        if (!state.finished && state.conn) {
          startRoundFromHost();
        }
      }, 700);
    }
  }

  function finishMatch(iWon) {
    if (state.finished) return;
    state.finished = true;
    state.phase = 'finished';
    clearPressureTimers();
    els.answer.disabled = true;
    els.answerBtn.disabled = true;
    els.endActions.classList.remove('hidden');
    els.timer.textContent = '—';
    els.timer.classList.remove('is-danger');

    if (iWon) {
      els.status.textContent = 'Победа!';
      showMessage(els.message, 'Соперник не успел. Ты выиграл!', 'good');
      flashTask(els.task, true);
    } else {
      els.status.textContent = 'Поражение';
      showMessage(els.message, 'Время вышло. Ты проиграл.', 'bad');
    }
  }

  function answersMatch(raw, expected) {
    if (raw === '' || raw == null) return false;
    const value = Number(String(raw).trim().replace(',', '.'));
    if (Number.isNaN(value)) return false;
    return Math.abs(value - expected) < 0.001;
  }

  function onLocalCorrect() {
    if (state.finished || !state.question || state.meSolved) return;

    state.meSolved = true;
    flashAnswer(els.answer, true);
    flashTask(els.task, true);
    send({ type: 'solved', round: state.round });

    if (state.peerSolved) {
      // Соперник уже решил — оба успели
      bothSolvedNext();
    } else {
      // Мы первые
      els.answer.disabled = true;
      els.answerBtn.disabled = true;
      startPressureAsFirst();
    }
  }

  function onMessage(data) {
    if (!data || !data.type) {
      return;
    }
    if (state.finished && data.type !== 'end') {
      return;
    }

    switch (data.type) {
      case 'hello':
        // Хост уже стартует на conn.open
        break;

      case 'welcome':
        if (data.mode) {
          state.mode = data.mode;
          els.modeLabel.textContent = MODE_LABELS[state.mode] || state.mode;
        }
        break;

      case 'question':
        if (state.finished) break;
        state.mode = data.mode || state.mode;
        state.round = data.round || state.round + 1;
        showGame();
        renderQuestion(data.question, true);
        break;

      case 'solved':
        if (state.finished) break;
        if (data.round != null && data.round !== state.round) break;
        state.peerSolved = true;
        if (state.meSolved) {
          bothSolvedNext();
        } else if (!state.pressureEndsAt) {
          startPressureAsSecond();
        }
        break;

      case 'end':
        finishMatch(Boolean(data.youWin));
        break;

      case 'peer_left':
        if (!state.finished) {
          showMessage(els.message, 'Соперник отключился', 'bad');
          els.answer.disabled = true;
          els.answerBtn.disabled = true;
          els.endActions.classList.remove('hidden');
          clearPressureTimers();
        }
        break;

      default:
        break;
    }
  }

  function wireConnection(conn) {
    state.conn = conn;
    conn.on('data', (data) => onMessage(data));
    conn.on('close', () => {
      if (!state.finished && state.phase !== 'lobby') {
        showMessage(els.message, 'Связь потеряна', 'bad');
        showMessage(els.lobbyMessage, 'Связь потеряна. Создай комнату заново.', 'bad');
        els.answer.disabled = true;
        els.answerBtn.disabled = true;
        els.endActions.classList.remove('hidden');
        clearPressureTimers();
      }
    });
    conn.on('error', () => {
      showMessage(els.lobbyMessage, 'Ошибка связи', 'bad');
    });
  }

  function ensurePeerJs() {
    return typeof window.Peer === 'function';
  }

  function createRoom() {
    if (!ensurePeerJs()) {
      showMessage(els.lobbyMessage, 'PeerJS не загрузился. Нужен интернет.', 'bad');
      return;
    }

    destroyPeer();
    const code = makeRoomCode();
    state.role = 'host';
    state.roomCode = code;
    state.phase = 'waiting';

    const peer = new window.Peer(peerIdFromCode(code), {
      debug: 0
    });
    state.peer = peer;
    showWaiting(code);
    showMessage(els.lobbyMessage, '', '');

    peer.on('open', () => {
      els.waitingHint.textContent = `Комната ${code} открыта. Ждём друга…`;
    });

    peer.on('connection', (conn) => {
      if (state.conn && state.conn.open) {
        conn.close();
        return;
      }
      wireConnection(conn);
      conn.on('open', () => {
        send({ type: 'welcome', mode: state.mode });
        // Один старт матча, когда гость на связи
        if (state.role === 'host' && state.round === 0 && !state.finished) {
          showGame();
          startRoundFromHost();
        }
      });
    });

    peer.on('error', (err) => {
      const msg = String(err && err.type ? err.type : err);
      if (msg === 'unavailable-id') {
        showMessage(els.lobbyMessage, 'Код занят, жми ещё раз «Создать»', 'bad');
        showLobby();
        return;
      }
      showMessage(els.lobbyMessage, `Ошибка: ${msg}`, 'bad');
      els.waitingHint.textContent = `Ошибка PeerJS: ${msg}. Проверь интернет.`;
    });
  }

  function joinRoom() {
    if (!ensurePeerJs()) {
      showMessage(els.lobbyMessage, 'PeerJS не загрузился. Нужен интернет.', 'bad');
      return;
    }

    const code = String(els.joinCode.value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) {
      showMessage(els.lobbyMessage, 'Введи код из 4 символов', 'bad');
      return;
    }

    destroyPeer();
    state.role = 'guest';
    state.roomCode = code;
    state.phase = 'connecting';
    showMessage(els.lobbyMessage, 'Подключаемся…', '');

    const peer = new window.Peer({ debug: 0 });
    state.peer = peer;

    peer.on('open', () => {
      const conn = peer.connect(peerIdFromCode(code), { reliable: true });
      wireConnection(conn);
      conn.on('open', () => {
        send({ type: 'hello' });
        showMessage(els.lobbyMessage, 'На связи! Ждём пример…', 'good');
        showGame();
        els.status.textContent = 'Подключено · ждём хоста';
        showMessage(els.message, 'Сейчас придёт первый пример', '');
        els.answer.disabled = true;
        els.answerBtn.disabled = true;
      });
      conn.on('error', () => {
        showMessage(els.lobbyMessage, 'Не удалось войти. Проверь код.', 'bad');
        showLobby();
      });
    });

    peer.on('error', (err) => {
      const msg = String(err && err.type ? err.type : err);
      showMessage(els.lobbyMessage, `Ошибка: ${msg}. Комната не найдена?`, 'bad');
      showLobby();
    });
  }

  function onSubmit(event) {
    event.preventDefault();
    if (state.finished || !state.question || state.meSolved) return;
    if (els.answer.disabled) return;

    const raw = els.answer.value;
    if (String(raw).trim() === '') {
      showMessage(els.message, 'Введи ответ', 'bad');
      flashAnswer(els.answer, false);
      return;
    }

    if (answersMatch(raw, state.question.answer)) {
      onLocalCorrect();
    } else {
      flashAnswer(els.answer, false);
      showMessage(els.message, 'Неверно, ещё раз', 'bad');
    }
  }

  Trainer.stopDuel = function stopDuel() {
    // Комнату не рвём при переключении вкладки — только «Отмена» / «В лобби».
  };

  Trainer.initDuel = function initDuel() {
    if (!els.createBtn) return;

    els.modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.mode = button.dataset.mode;
        els.modeButtons.forEach((b) => setPressed(b, b.dataset.mode === state.mode));
      });
    });

    els.createBtn.addEventListener('click', createRoom);
    els.joinBtn.addEventListener('click', joinRoom);
    els.joinCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        joinRoom();
      }
    });
    els.cancelBtn.addEventListener('click', showLobby);
    els.backBtn.addEventListener('click', showLobby);
    els.copyCodeBtn.addEventListener('click', async () => {
      const code = state.roomCode || els.roomCode.textContent;
      try {
        await navigator.clipboard.writeText(code);
        els.waitingHint.textContent = 'Код скопирован!';
      } catch {
        els.waitingHint.textContent = `Код: ${code}`;
      }
    });
    els.answerForm.addEventListener('submit', onSubmit);

    showLobby();
  };
})();
