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

  const MQTT_URLS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  const LOBBY_TOPIC = 'roulette-trainer/v2/lobby';
  const ROOM_PREFIX = 'roulette-trainer/v2/room/';
  const MAX_LIVES = 3;
  const ROOM_STALE_MS = 7000;
  const ANNOUNCE_MS = 2000;

  const PRESSURE_BY_MODE = {
    multiplication: 4,
    blackjack: 4,
    counting: 10
  };

  const COUNTING_LEVEL = {
    easy: { minSlots: 2, maxSlots: 4, maxChips: 3 },
    medium: { minSlots: 4, maxSlots: 7, maxChips: 5 },
    hard: { minSlots: 6, maxSlots: 11, maxChips: 8 }
  };

  const LEVEL_LABELS = { easy: 'лёгкий', medium: 'средний', hard: 'высокий' };
  const MODE_LABELS = { multiplication: 'Умнож.', blackjack: 'BJ', counting: 'Счёт' };
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

  const state = {
    mode: 'multiplication',
    level: 'easy',
    playerId: null,
    playerName: 'Игрок',
    role: null,
    roomId: null,
    roomNumber: null,
    roomTopic: null,
    phase: 'lobby',
    client: null,
    lobbyRooms: {},
    players: {},
    hostId: null,
    round: 0,
    question: null,
    meSolved: false,
    pressureActive: false,
    pressureEndsAt: null,
    pressureTimer: null,
    tickTimer: null,
    announceTimer: null,
    lobbySweepTimer: null,
    finished: false,
    finishingOnly: false,
    brokerIndex: 0,
    lobbyReady: false
  };

  const els = {
    lobby: $('#duelLobby'),
    waiting: $('#duelWaiting'),
    game: $('#duelGame'),
    modeButtons: $$('#duelModeChoices button'),
    levelField: $('#duelLevelField'),
    levelButtons: $$('#duelLevelChoices button'),
    playerName: $('#duelPlayerName'),
    createBtn: $('#duelCreateBtn'),
    refreshBtn: $('#duelRefreshLobbyBtn'),
    roomList: $('#duelRoomList'),
    roomListEmpty: $('#duelRoomListEmpty'),
    lobbyMessage: $('#duelLobbyMessage'),
    roomTitle: $('#duelRoomTitle'),
    waitingHint: $('#duelWaitingHint'),
    waitingPlayers: $('#duelWaitingPlayers'),
    startBtn: $('#duelStartBtn'),
    cancelBtn: $('#duelCancelBtn'),
    modeLabel: $('#duelModeLabel'),
    round: $('#duelRound'),
    lives: $('#duelLives'),
    gamePlayers: $('#duelGamePlayers'),
    timer: $('#duelTimer'),
    status: $('#duelStatus'),
    example: $('#duelExample'),
    boardWrap: $('#duelBoardWrap'),
    winLabel: $('#duelWinLabel'),
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

  function makeId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function pressureSec() {
    return PRESSURE_BY_MODE[state.mode] || 4;
  }

  function hearts(n) {
    const lives = Math.max(0, n);
    return '♥'.repeat(lives) + '♡'.repeat(Math.max(0, MAX_LIVES - lives));
  }

  function myPlayer() {
    return state.players[state.playerId] || null;
  }

  function activePlayers() {
    return Object.values(state.players).filter((p) => !p.eliminated);
  }

  function ensureMqttLib() {
    return typeof window.mqtt !== 'undefined' && typeof window.mqtt.connect === 'function';
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
    state.pressureActive = false;
    state.pressureEndsAt = null;
    if (els.timer) {
      els.timer.textContent = '—';
      els.timer.classList.remove('is-danger');
    }
  }

  function clearAnnounce() {
    if (state.announceTimer) {
      window.clearInterval(state.announceTimer);
      state.announceTimer = null;
    }
  }

  function publishLobby(msg) {
    if (!state.client || !state.client.connected) return;
    state.client.publish(LOBBY_TOPIC, JSON.stringify({ ...msg, from: state.playerId, ts: Date.now() }), {
      qos: 0
    });
  }

  function publishRoom(msg) {
    if (!state.client || !state.client.connected || !state.roomTopic) return;
    state.client.publish(
      state.roomTopic,
      JSON.stringify({ ...msg, from: state.playerId, ts: Date.now() }),
      { qos: 1 }
    );
  }

  function getName() {
    const raw = (els.playerName && els.playerName.value) || state.playerName || 'Игрок';
    const name = String(raw).trim().slice(0, 16) || 'Игрок';
    state.playerName = name;
    try {
      localStorage.setItem('duel-player-name', name);
    } catch {
      // ignore
    }
    if (Trainer.saveSettings) {
      Trainer.saveSettings({ duel: { playerName: name, mode: state.mode, level: state.level } });
    }
    return name;
  }

  function updateLobbyModeUi() {
    if (els.levelField) {
      els.levelField.classList.toggle('hidden', state.mode !== 'counting');
    }
  }

  function renderRoomList() {
    if (!els.roomList) return;
    const rooms = Object.values(state.lobbyRooms)
      .filter((r) => r.status === 'waiting')
      .sort((a, b) => a.number - b.number);

    els.roomList.innerHTML = '';
    if (rooms.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'timing-empty';
      empty.id = 'duelRoomListEmpty';
      empty.textContent = 'Пока пусто — создай комнату или подожди.';
      els.roomList.appendChild(empty);
      return;
    }

    rooms.forEach((room) => {
      const card = document.createElement('div');
      card.className = 'duel-room-card';
      const modeText =
        room.mode === 'counting'
          ? `Счёт (${LEVEL_LABELS[room.level] || room.level})`
          : MODE_LABELS[room.mode] || room.mode;
      const info = document.createElement('div');
      info.innerHTML = `<strong>Комната ${room.number}</strong><span>${modeText} · игроков: ${room.playerCount || 1}</span>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'primary';
      btn.textContent = 'Войти';
      btn.addEventListener('click', () => joinRoom(room));
      card.append(info, btn);
      els.roomList.appendChild(card);
    });
  }

  function renderPlayersList(container) {
    if (!container) return;
    container.innerHTML = '';
    const list = Object.values(state.players).sort((a, b) => {
      if (a.id === state.hostId) return -1;
      if (b.id === state.hostId) return 1;
      return String(a.name).localeCompare(String(b.name), 'ru');
    });

    list.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'duel-player-row';
      if (p.id === state.playerId) row.classList.add('is-me');
      if (p.eliminated) row.classList.add('is-out');
      if (p.solved) row.classList.add('is-solved');

      const left = document.createElement('span');
      const hostMark = p.id === state.hostId ? ' 👑' : '';
      const meMark = p.id === state.playerId ? ' (ты)' : '';
      const outMark = p.eliminated ? ' · выбыл' : '';
      const okMark = p.solved && !p.eliminated ? ' ✓' : '';
      left.textContent = `${p.name}${hostMark}${meMark}${outMark}${okMark}`;

      const right = document.createElement('span');
      right.className = 'duel-hearts';
      right.textContent = hearts(p.lives);
      row.append(left, right);
      container.appendChild(row);
    });
  }

  function updateLivesUi() {
    const me = myPlayer();
    if (els.lives) {
      els.lives.textContent = me ? hearts(me.lives) : hearts(MAX_LIVES);
    }
    renderPlayersList(els.waitingPlayers);
    renderPlayersList(els.gamePlayers);
  }

  function showScreen(name) {
    els.lobby.classList.toggle('hidden', name !== 'lobby');
    els.waiting.classList.toggle('hidden', name !== 'waiting');
    els.game.classList.toggle('hidden', name !== 'game');
  }

  function roomSnapshot() {
    return {
      type: 'room_announce',
      roomId: state.roomId,
      number: state.roomNumber,
      mode: state.mode,
      level: state.level,
      hostId: state.hostId,
      status: state.phase === 'playing' || state.phase === 'finished' ? state.phase : 'waiting',
      playerCount: Object.keys(state.players).length,
      players: Object.values(state.players).map((p) => ({
        id: p.id,
        name: p.name,
        lives: p.lives,
        eliminated: p.eliminated
      }))
    };
  }

  function syncRoom(extra = {}) {
    if (state.role !== 'host') return;
    publishRoom({
      type: 'sync',
      roomId: state.roomId,
      number: state.roomNumber,
      mode: state.mode,
      level: state.level,
      hostId: state.hostId,
      phase: state.phase,
      round: state.round,
      players: state.players,
      question: state.question,
      pressureActive: state.pressureActive,
      pressureEndsAt: state.pressureEndsAt,
      finished: state.finished,
      ...extra
    });
    publishLobby(roomSnapshot());
  }

  /* ——— Вопросы ——— */

  function buildNumberGrid(winNumber) {
    if (winNumber === 0) {
      return { numbers: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], isZero: true };
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
    const cfg = COUNTING_LEVEL[state.level] || COUNTING_LEVEL.easy;
    const winNumber = Math.random() < 0.1 ? 0 : randInt(1, 36);
    const grid = buildNumberGrid(winNumber);
    const available = grid.isZero
      ? winningSlotsForZero()
      : winningSlotsForCell(grid.winCol, grid.winRow);
    const slotCount = Math.min(
      available.length,
      randInt(cfg.minSlots, Math.min(cfg.maxSlots, available.length))
    );
    const straight = available.find((s) => s.type === 'straight');
    const rest = shuffle(available.filter((s) => s.type !== 'straight'));
    const chosen = [];
    if (straight && Math.random() < 0.85) chosen.push(straight);
    for (const slot of rest) {
      if (chosen.length >= slotCount) break;
      chosen.push(slot);
    }
    while (chosen.length < Math.min(cfg.minSlots, available.length)) {
      const next = available.find((s) => !chosen.some((c) => c.key === s.key));
      if (!next) break;
      chosen.push(next);
    }
    const chips = chosen.map((slot) => ({
      type: slot.type,
      x: slot.x,
      y: slot.y,
      key: slot.key,
      count: randInt(1, cfg.maxChips)
    }));
    const answer = chips.reduce((sum, chip) => sum + chip.count * payoutOf(chip.type), 0);
    return { mode: 'counting', answer, winNumber, grid, chips, level: state.level };
  }

  function makeQuestion(mode) {
    if (mode === 'blackjack') {
      const bet = randInt(1, 40) * 5;
      return { mode: 'blackjack', display: String(bet), answer: bet * 1.5 };
    }
    if (mode === 'counting') return makeCountingQuestion();
    const tables = [5, 8, 11, 17, 35];
    const table = tables[randInt(0, tables.length - 1)];
    const mult = randInt(1, 20);
    return { mode: 'multiplication', display: `${table} × ${mult}`, answer: table * mult };
  }

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

  function canAnswerNow() {
    const me = myPlayer();
    if (!me || state.finished) return false;
    if (state.meSolved) return false;
    // Выбыл — только дорешивает текущий, если ещё не решил
    if (me.eliminated && !state.finishingOnly) return false;
    if (me.eliminated && state.finishingOnly) return !state.meSolved;
    return true;
  }

  function setAnswerEnabled(on) {
    const enabled = on && canAnswerNow();
    els.answer.disabled = !enabled;
    els.answerBtn.disabled = !enabled;
  }

  function renderQuestion(q, animate = true) {
    state.question = q;
    state.meSolved = false;
    clearPressureTimers();
    Object.values(state.players).forEach((p) => {
      p.solved = false;
    });

    const me = myPlayer();
    // После вылета на следующем раунде finishingOnly снимается
    if (me && me.eliminated) {
      state.finishingOnly = false;
      setAnswerEnabled(false);
    } else {
      state.finishingOnly = false;
    }

    els.answer.value = '';
    els.endActions.classList.add('hidden');
    const modeText = MODE_LABELS[state.mode] || state.mode;
    els.modeLabel.textContent =
      state.mode === 'counting'
        ? `${modeText} · ${LEVEL_LABELS[state.level] || state.level}`
        : modeText;
    els.round.textContent = String(state.round);
    updateLivesUi();

    if (q.mode === 'counting') {
      renderCountingBoard(q);
      showMessage(els.message, me && me.eliminated ? 'Ты выбыл — наблюдаешь' : 'Сложите выплаты', '');
    } else {
      els.boardWrap.classList.add('hidden');
      els.example.classList.remove('hidden');
      if (animate) animateExample(els.example, q.display);
      else els.example.textContent = q.display;
      showMessage(
        els.message,
        me && me.eliminated
          ? 'Ты выбыл — наблюдаешь'
          : q.mode === 'blackjack'
            ? 'Выплата BJ 3:2 (×1.5)'
            : 'Ответьте на пример',
        me && me.eliminated ? 'bad' : ''
      );
    }

    if (me && me.eliminated) {
      els.status.textContent = 'Выбыл из игры';
      setAnswerEnabled(false);
    } else {
      els.status.textContent = 'Кто быстрее решит верно';
      setAnswerEnabled(true);
      els.answer.focus();
    }
  }

  function startPressureUi(endsAt) {
    clearPressureTimers();
    state.pressureActive = true;
    state.pressureEndsAt = endsAt;
    const sec = Math.max(1, Math.ceil((endsAt - Date.now()) / 1000));
    els.timer.classList.add('is-danger');
    els.timer.textContent = `${sec}с`;

    const me = myPlayer();
    if (state.meSolved) {
      els.status.textContent = `Ты решил! У остальных ${sec} сек`;
      showMessage(els.message, 'Ждём остальных…', 'good');
    } else if (me && !me.eliminated) {
      els.status.textContent = `Успей за ${sec} сек!`;
      showMessage(els.message, `Быстрее! ${sec} секунд`, 'bad');
      setAnswerEnabled(true);
      els.answer.focus();
    } else if (me && me.eliminated && state.finishingOnly) {
      els.status.textContent = 'Дорешивай текущий';
    }

    state.tickTimer = window.setInterval(() => {
      if (!state.pressureEndsAt) return;
      const left = Math.max(0, Math.ceil((state.pressureEndsAt - Date.now()) / 1000));
      els.timer.textContent = `${left}с`;
    }, 150);

    // Только хост применяет штраф по таймауту
    if (state.role === 'host') {
      const delay = Math.max(0, endsAt - Date.now());
      state.pressureTimer = window.setTimeout(() => {
        hostResolvePressure();
      }, delay + 50);
    }
  }

  function hostResolvePressure() {
    if (state.role !== 'host' || state.finished) return;

    Object.values(state.players).forEach((p) => {
      if (p.eliminated) return;
      if (p.solved) return;
      p.lives = Math.max(0, p.lives - 1);
      if (p.lives <= 0) {
        p.eliminated = true;
      }
    });

    clearPressureTimers();
    publishRoom({ type: 'pressure_end', players: state.players, round: state.round });
    applyPlayers(state.players, { afterPressure: true });

    const alive = activePlayers();
    if (alive.length <= 1) {
      window.setTimeout(() => hostFinishMatch(), 900);
      return;
    }

    window.setTimeout(() => {
      if (!state.finished) hostNextRound();
    }, 1200);
  }

  function hostFinishMatch() {
    const alive = activePlayers();
    let winnerId = null;
    if (alive.length === 1) winnerId = alive[0].id;
    state.finished = true;
    state.phase = 'finished';
    clearPressureTimers();
    clearAnnounce();
    publishLobby({ type: 'room_closed', roomId: state.roomId });
    publishRoom({ type: 'match_end', winnerId, players: state.players });
    showMatchEnd(winnerId);
  }

  function showMatchEnd(winnerId) {
    state.finished = true;
    state.phase = 'finished';
    setAnswerEnabled(false);
    els.endActions.classList.remove('hidden');
    updateLivesUi();
    if (winnerId === state.playerId) {
      els.status.textContent = 'Победа!';
      showMessage(els.message, 'Ты победил!', 'good');
      flashTask(els.task, true);
    } else if (winnerId) {
      const w = state.players[winnerId];
      els.status.textContent = 'Игра окончена';
      showMessage(els.message, `Победитель: ${w ? w.name : '—'}`, 'bad');
    } else {
      els.status.textContent = 'Ничья';
      showMessage(els.message, 'Никто не остался с жизнями', '');
    }
  }

  function hostNextRound() {
    state.round += 1;
    Object.values(state.players).forEach((p) => {
      p.solved = false;
    });
    const q = makeQuestion(state.mode);
    state.question = q;
    publishRoom({
      type: 'question',
      round: state.round,
      mode: state.mode,
      level: state.level,
      question: q,
      players: state.players
    });
    showScreen('game');
    renderQuestion(q, true);
    syncRoom();
  }

  function hostStartGame() {
    if (state.role !== 'host') return;
    const count = Object.keys(state.players).length;
    if (count < 2) {
      showMessage(els.waitingHint, 'Нужно минимум 2 игрока', 'bad');
      return;
    }
    state.phase = 'playing';
    state.finished = false;
    state.round = 0;
    clearAnnounce();
    // Больше не ждём в лобби-листе как waiting
    publishLobby({ ...roomSnapshot(), status: 'playing' });
    hostNextRound();
  }

  function applyPlayers(players, opts = {}) {
    state.players = players;
    const me = myPlayer();
    if (me && me.eliminated && opts.afterPressure && !state.meSolved) {
      // Только что выбил — можно дорешать текущий
      state.finishingOnly = true;
      setAnswerEnabled(true);
      els.status.textContent = 'Жизни кончились — дореши текущий';
      showMessage(els.message, 'Ты выбыл, но можешь дорешать этот пример', 'bad');
    }
    updateLivesUi();
  }

  function onLocalCorrect() {
    if (!state.question || state.meSolved || state.finished) return;
    if (!canAnswerNow()) return;

    state.meSolved = true;
    const me = myPlayer();
    if (me) me.solved = true;

    flashAnswer(els.answer, true);
    flashTask(els.task, true);
    setAnswerEnabled(false);
    updateLivesUi();

    // Брокер часто не шлёт publish самому себе — хост обрабатывает локально
    publishRoom({ type: 'solved', round: state.round });
    if (state.role === 'host') {
      handleSolved(state.playerId, state.round);
    }

    if (me && me.eliminated) {
      showMessage(els.message, 'Дорешал. Жди конца раунда / игры', 'good');
      els.status.textContent = 'Выбыл · пример закрыт';
      return;
    }

    showMessage(els.message, 'Верно!', 'good');
  }

  function answersMatch(raw, expected) {
    if (raw === '' || raw == null) return false;
    const value = Number(String(raw).trim().replace(',', '.'));
    if (Number.isNaN(value)) return false;
    return Math.abs(value - expected) < 0.001;
  }

  /* ——— Сообщения ——— */

  function onLobbyMessage(data) {
    if (!data || !data.type) return;

    if (data.type === 'room_announce' && data.roomId) {
      // Свою комнату тоже показываем в списке? Можно скрыть
      state.lobbyRooms[data.roomId] = {
        roomId: data.roomId,
        number: data.number || 0,
        mode: data.mode,
        level: data.level,
        hostId: data.hostId,
        status: data.status || 'waiting',
        playerCount: data.playerCount || 1,
        seenAt: Date.now()
      };
      if (state.phase === 'lobby') renderRoomList();
      return;
    }

    if (data.type === 'room_closed' && data.roomId) {
      delete state.lobbyRooms[data.roomId];
      if (state.phase === 'lobby') renderRoomList();
    }
  }

  function onRoomMessage(data) {
    if (!data || !data.type) return;
    // Свои сообщения игнорим (хост обрабатывает solved локально)
    if (data.from === state.playerId) return;

    switch (data.type) {
      case 'join_request':
        if (state.role === 'host' && state.phase === 'waiting') {
          hostAddPlayer(data.from, data.name || 'Игрок');
        } else if (state.role === 'host' && state.phase !== 'waiting') {
          publishRoom({ type: 'join_denied', to: data.from, reason: 'Игра уже идёт' });
        }
        break;

      case 'join_ok':
        if (state.role === 'guest' && data.to === state.playerId) {
          state.players = data.players || {};
          state.hostId = data.hostId;
          state.mode = data.mode || state.mode;
          state.level = data.level || state.level;
          state.roomNumber = data.number;
          state.phase = 'waiting';
          showScreen('waiting');
          els.roomTitle.textContent = `Комната ${state.roomNumber}`;
          els.waitingHint.textContent = 'Ждём старта от хоста…';
          els.startBtn.classList.add('hidden');
          updateLivesUi();
          showMessage(els.lobbyMessage, '', '');
        }
        break;

      case 'join_denied':
        if (data.to === state.playerId) {
          showMessage(els.lobbyMessage, data.reason || 'Нельзя войти', 'bad');
          leaveRoomLocal(false);
          showScreen('lobby');
        }
        break;

      case 'sync':
        if (state.role === 'host') break;
        applySync(data);
        break;

      case 'player_left':
        if (state.players[data.playerId]) {
          delete state.players[data.playerId];
          updateLivesUi();
          if (state.role === 'host') {
            syncRoom();
            if (state.phase === 'playing' && activePlayers().length <= 1) {
              hostFinishMatch();
            }
          }
        }
        if (data.playerId === state.hostId && state.role !== 'host') {
          showMessage(els.message, 'Хост вышел — комната закрыта', 'bad');
          showMessage(els.waitingHint, 'Хост вышел', 'bad');
          window.setTimeout(() => leaveToLobby(), 800);
        }
        break;

      case 'solved':
        handleSolved(data.from, data.round);
        break;

      case 'pressure_start':
        if (state.role === 'host') break;
        if (data.players) applyPlayers(data.players);
        startPressureUi(data.endsAt);
        break;

      case 'pressure_end':
        if (state.role === 'host') break;
        clearPressureTimers();
        applyPlayers(data.players || state.players, {
          afterPressure: !data.allSolved
        });
        showMessage(
          els.message,
          data.allSolved ? 'Все успели!' : 'Кто не успел — потерял жизнь',
          data.allSolved ? 'good' : ''
        );
        break;

      case 'question':
        if (state.role === 'host') break;
        state.phase = 'playing';
        state.finished = false;
        state.round = data.round;
        state.mode = data.mode || state.mode;
        state.level = data.level || state.level;
        if (data.players) applyPlayers(data.players);
        showScreen('game');
        renderQuestion(data.question, true);
        break;

      case 'match_end':
        if (state.role === 'host') break;
        if (data.players) applyPlayers(data.players);
        showMatchEnd(data.winnerId);
        break;

      default:
        break;
    }
  }

  function handleSolved(playerId, round) {
    if (state.finished) return;
    if (round != null && round !== state.round) return;
    const p = state.players[playerId];
    if (!p) return;

    // Выбывший дорешивает — без влияния на таймер
    if (p.eliminated) {
      p.solved = true;
      updateLivesUi();
      return;
    }

    if (p.solved && playerId !== state.playerId) {
      // уже учтён
      updateLivesUi();
      return;
    }
    p.solved = true;
    if (playerId === state.playerId) state.meSolved = true;
    updateLivesUi();

    // Гости только обновляют UI; если давление ещё не шло и это чужой solve — ждём pressure_start от хоста
    if (state.role !== 'host') {
      if (!state.meSolved && !state.pressureActive) {
        // хост пришлёт pressure_start
      }
      return;
    }

    const alive = activePlayers();
    const solvedAlive = alive.filter((x) => x.solved);

    // Все живые решили — следующий раунд без штрафа
    if (alive.length > 0 && alive.every((x) => x.solved)) {
      clearPressureTimers();
      publishRoom({
        type: 'pressure_end',
        players: state.players,
        round: state.round,
        allSolved: true
      });
      showMessage(els.message, 'Все успели!', 'good');
      window.setTimeout(() => {
        if (!state.finished) hostNextRound();
      }, 700);
      return;
    }

    // Первый верный среди живых → таймер для остальных
    if (solvedAlive.length >= 1 && !state.pressureActive) {
      const endsAt = Date.now() + pressureSec() * 1000;
      state.pressureActive = true;
      state.pressureEndsAt = endsAt;
      publishRoom({
        type: 'pressure_start',
        endsAt,
        round: state.round,
        players: state.players
      });
      startPressureUi(endsAt);
    }
  }

  function applySync(data) {
    if (data.mode) state.mode = data.mode;
    if (data.level) state.level = data.level;
    if (data.hostId) state.hostId = data.hostId;
    if (data.number != null) state.roomNumber = data.number;
    if (data.players) applyPlayers(data.players);
    if (data.round != null) state.round = data.round;
    if (data.phase) state.phase = data.phase;
    if (data.finished) state.finished = data.finished;

    if (data.phase === 'waiting') {
      showScreen('waiting');
      els.roomTitle.textContent = `Комната ${state.roomNumber}`;
      els.startBtn.classList.add('hidden');
      updateLivesUi();
    } else if (data.phase === 'playing' && data.question) {
      showScreen('game');
      renderQuestion(data.question, false);
      if (data.pressureActive && data.pressureEndsAt) {
        startPressureUi(data.pressureEndsAt);
      }
    } else if (data.phase === 'finished') {
      showMatchEnd(null);
    }
  }

  function hostAddPlayer(id, name) {
    if (state.players[id]) {
      publishRoom({
        type: 'join_ok',
        to: id,
        players: state.players,
        hostId: state.hostId,
        mode: state.mode,
        level: state.level,
        number: state.roomNumber
      });
      return;
    }
    state.players[id] = {
      id,
      name: String(name || 'Игрок').slice(0, 16),
      lives: MAX_LIVES,
      eliminated: false,
      solved: false
    };
    publishRoom({
      type: 'join_ok',
      to: id,
      players: state.players,
      hostId: state.hostId,
      mode: state.mode,
      level: state.level,
      number: state.roomNumber
    });
    syncRoom();
    updateLivesUi();
    els.waitingHint.textContent = `Игроков: ${Object.keys(state.players).length}. Можно стартовать.`;
  }

  /* ——— MQTT connect ——— */

  function handleMessage(topic, buffer) {
    let data;
    try {
      data = JSON.parse(String(buffer));
    } catch {
      return;
    }
    if (topic === LOBBY_TOPIC) {
      onLobbyMessage(data);
      return;
    }
    if (state.roomTopic && topic === state.roomTopic) {
      onRoomMessage(data);
    }
  }

  function ensureClient(cb) {
    if (!ensureMqttLib()) {
      showMessage(els.lobbyMessage, 'MQTT не загрузился. Нужен интернет, обнови страницу.', 'bad');
      return;
    }
    if (state.client && state.client.connected) {
      cb();
      return;
    }
    if (state.client) {
      try {
        state.client.end(true);
      } catch {
        // ignore
      }
      state.client = null;
    }

    if (!state.playerId) state.playerId = makeId('p');

    const url = MQTT_URLS[state.brokerIndex % MQTT_URLS.length];
    const client = window.mqtt.connect(url, {
      clientId: `rt_${state.playerId}`,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 12000,
      protocolVersion: 4
    });
    state.client = client;

    client.on('connect', () => {
      client.subscribe(LOBBY_TOPIC, { qos: 0 }, () => {
        state.lobbyReady = true;
        if (!state.lobbySweepTimer) {
          state.lobbySweepTimer = window.setInterval(sweepLobby, 2000);
        }
        cb();
      });
    });

    client.on('message', handleMessage);
    client.on('error', () => {
      if (state.phase === 'lobby') {
        showMessage(els.lobbyMessage, 'Сбой связи…', 'bad');
      }
    });
  }

  function sweepLobby() {
    const now = Date.now();
    let changed = false;
    Object.keys(state.lobbyRooms).forEach((id) => {
      if (now - state.lobbyRooms[id].seenAt > ROOM_STALE_MS) {
        delete state.lobbyRooms[id];
        changed = true;
      }
    });
    if (changed && state.phase === 'lobby') renderRoomList();
  }

  function nextRoomNumber() {
    let max = 0;
    Object.values(state.lobbyRooms).forEach((r) => {
      if (r.number > max) max = r.number;
    });
    return max + 1;
  }

  function subscribeRoom(roomId, cb) {
    state.roomId = roomId;
    state.roomTopic = ROOM_PREFIX + roomId;
    state.client.subscribe(state.roomTopic, { qos: 1 }, (err) => {
      if (err) {
        showMessage(els.lobbyMessage, 'Не удалось войти в комнату', 'bad');
        return;
      }
      cb();
    });
  }

  function createRoom() {
    ensureClient(() => {
      const name = getName();
      state.role = 'host';
      state.hostId = state.playerId;
      state.roomId = makeId('room');
      state.roomNumber = nextRoomNumber();
      state.phase = 'waiting';
      state.finished = false;
      state.finishingOnly = false;
      state.round = 0;
      state.players = {
        [state.playerId]: {
          id: state.playerId,
          name,
          lives: MAX_LIVES,
          eliminated: false,
          solved: false
        }
      };

      subscribeRoom(state.roomId, () => {
        showScreen('waiting');
        els.roomTitle.textContent = `Комната ${state.roomNumber}`;
        els.waitingHint.textContent = 'Ждём игроков. Когда будут готовы — жми «Старт».';
        els.startBtn.classList.remove('hidden');
        updateLivesUi();
        syncRoom();
        clearAnnounce();
        state.announceTimer = window.setInterval(() => {
          if (state.phase === 'waiting') publishLobby(roomSnapshot());
        }, ANNOUNCE_MS);
        showMessage(els.lobbyMessage, '', '');
      });
    });
  }

  function joinRoom(room) {
    if (!room || !room.roomId) return;
    if (room.status && room.status !== 'waiting') {
      showMessage(els.lobbyMessage, 'Игра уже началась', 'bad');
      return;
    }
    ensureClient(() => {
      const name = getName();
      state.role = 'guest';
      state.roomNumber = room.number;
      state.mode = room.mode || state.mode;
      state.level = room.level || state.level;
      state.phase = 'connecting';
      state.finished = false;
      showMessage(els.lobbyMessage, `Входим в комнату ${room.number}…`, '');

      subscribeRoom(room.roomId, () => {
        publishRoom({ type: 'join_request', name });
        // таймаут
        window.setTimeout(() => {
          if (state.phase === 'connecting') {
            showMessage(els.lobbyMessage, 'Нет ответа от комнаты. Обнови список.', 'bad');
            leaveRoomLocal(false);
            showScreen('lobby');
          }
        }, 8000);
      });
    });
  }

  function leaveRoomLocal(notify) {
    if (notify && state.roomTopic) {
      publishRoom({ type: 'player_left', playerId: state.playerId });
      if (state.role === 'host') {
        publishLobby({ type: 'room_closed', roomId: state.roomId });
      }
    }
    if (state.client && state.roomTopic) {
      try {
        state.client.unsubscribe(state.roomTopic);
      } catch {
        // ignore
      }
    }
    clearAnnounce();
    clearPressureTimers();
    state.roomId = null;
    state.roomTopic = null;
    state.roomNumber = null;
    state.role = null;
    state.hostId = null;
    state.players = {};
    state.question = null;
    state.round = 0;
    state.phase = 'lobby';
    state.finished = false;
    state.finishingOnly = false;
    state.meSolved = false;
  }

  function leaveToLobby() {
    leaveRoomLocal(true);
    showScreen('lobby');
    renderRoomList();
    showMessage(els.lobbyMessage, '', '');
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!state.question || state.meSolved) return;
    if (!canAnswerNow()) return;

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
    // не рвём MQTT при смене вкладки
  };

  Trainer.initDuel = function initDuel() {
    if (!els.createBtn) return;

    try {
      const legacy = localStorage.getItem('duel-player-name');
      const saved = Trainer.getSettings ? Trainer.getSettings().duel || {} : {};
      const name = saved.playerName || legacy || '';
      if (name && els.playerName) {
        els.playerName.value = name;
        state.playerName = name;
      }
      if (saved.mode && MODE_LABELS[saved.mode]) {
        state.mode = saved.mode;
      }
      if (saved.level && LEVEL_LABELS[saved.level]) {
        state.level = saved.level;
      }
      els.modeButtons.forEach((b) => setPressed(b, b.dataset.mode === state.mode));
      els.levelButtons.forEach((b) => setPressed(b, b.dataset.level === state.level));
    } catch {
      // ignore
    }

    els.modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.mode = button.dataset.mode;
        els.modeButtons.forEach((b) => setPressed(b, b.dataset.mode === state.mode));
        updateLobbyModeUi();
        if (Trainer.saveSettings) {
          Trainer.saveSettings({ duel: { mode: state.mode, level: state.level, playerName: state.playerName } });
        }
      });
    });

    els.levelButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.level = button.dataset.level;
        els.levelButtons.forEach((b) => setPressed(b, b.dataset.level === state.level));
        if (Trainer.saveSettings) {
          Trainer.saveSettings({ duel: { mode: state.mode, level: state.level, playerName: state.playerName } });
        }
      });
    });

    els.createBtn.addEventListener('click', createRoom);
    if (els.refreshBtn) {
      els.refreshBtn.addEventListener('click', () => {
        ensureClient(() => {
          showMessage(els.lobbyMessage, 'Список обновляется…', '');
          renderRoomList();
        });
      });
    }
    els.startBtn.addEventListener('click', hostStartGame);
    els.cancelBtn.addEventListener('click', leaveToLobby);
    els.backBtn.addEventListener('click', leaveToLobby);
    els.answerForm.addEventListener('submit', onSubmit);

    updateLobbyModeUi();
    showScreen('lobby');
    // Подключаемся к лобби сразу, чтобы видеть комнаты
    ensureClient(() => {
      renderRoomList();
    });
  };
})();
