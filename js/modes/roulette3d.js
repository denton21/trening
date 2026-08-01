window.Trainer = window.Trainer || {};

(function () {
  const { $, $$, setPressed, flashAnswer, flashTask, showMessage, payoutOf, getSettings, saveSettings } = Trainer;
  const LEVEL = { easy: { min: 2, max: 4, count: 2 }, medium: { min: 4, max: 7, count: 3 }, hard: { min: 6, max: 10, count: 4 } };
  const colors = ['red', 'black', 'blue', 'green'];
  const state = { level: 'easy', denominations: [1, 5, 25], running: false, answer: 0, started: 0, correct: 0, wrong: 0, awaitingRetry: false };
  const els = {
    level: $$('#roulette3dLevelChoices button'), denoms: $$('#roulette3dDenominationChoices button'), start: $('#roulette3dStartBtn'), reset: $('#roulette3dResetBtn'), form: $('#roulette3dAnswerForm'), answer: $('#roulette3dAnswer'), answerBtn: $('#roulette3dAnswerBtn'), task: $('#roulette3dTask'), wheel: $('#roulette3dWheel'), bets: $('#roulette3dBets'), win: $('#roulette3dWinLabel'), message: $('#roulette3dMessage'), retryActions: $('#roulette3dRetryActions'), retry: $('#roulette3dRetryBtn'), skip: $('#roulette3dSkipBtn'), correct: $('#roulette3dCorrectCount'), wrong: $('#roulette3dWrongCount'), last: $('#roulette3dLastTime')
  };
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);
  function update() { els.correct.textContent = state.correct; els.wrong.textContent = state.wrong; }
  function setRetry(show) { els.retryActions.classList.toggle('hidden', !show); }
  function renderWheel(number) {
    els.wheel.innerHTML = '';
    for (let i = 0; i < 12; i += 1) { const segment = document.createElement('span'); segment.textContent = String((number + i * 3) % 37); segment.style.setProperty('--angle', `${i * 30}deg`); els.wheel.appendChild(segment); }
    els.wheel.classList.remove('spin-3d'); void els.wheel.offsetWidth; els.wheel.classList.add('spin-3d');
  }
  function renderBets(bets) {
    els.bets.innerHTML = '';
    bets.forEach((bet, i) => { const el = document.createElement('div'); el.className = `mixed-bet ${bet.color}`; el.style.setProperty('--x', `${18 + (i % 4) * 21}%`); el.style.setProperty('--y', `${25 + Math.floor(i / 4) * 24}%`); el.innerHTML = `<strong>${bet.amount}</strong><span>${bet.count} шт. · ×${bet.payout}</span>`; els.bets.appendChild(el); });
  }
  function next() {
    const cfg = LEVEL[state.level]; const number = rand(0, 36); const payoutTypes = ['straight', 'split', 'street', 'corner', 'sixline']; const bets = [];
    const count = rand(cfg.min, cfg.max); let answer = 0;
    for (let i = 0; i < count; i += 1) { const amount = state.denominations[rand(0, state.denominations.length - 1)]; const payout = payoutOf(payoutTypes[rand(0, payoutTypes.length - 1)]); const chip = { amount, count: rand(1, cfg.count), payout, color: colors[i % colors.length] }; answer += amount * chip.count * payout; bets.push(chip); }
    state.answer = answer; state.started = Date.now(); state.awaitingRetry = false; setRetry(false); els.answer.value = ''; els.win.textContent = `Выпало: ${number}`; renderWheel(number); renderBets(shuffle(bets)); els.answer.disabled = false; els.answerBtn.disabled = false; els.answer.focus(); showMessage(els.message, 'Сложите все смешанные номиналы', '');
  }
  function start() { if (!state.denominations.length) return; state.running = true; state.correct = 0; state.wrong = 0; update(); next(); }
  function reset() { state.running = false; state.awaitingRetry = false; state.correct = 0; state.wrong = 0; els.answer.value = ''; els.answer.disabled = true; els.answerBtn.disabled = true; els.win.textContent = 'Выпало: —'; els.bets.innerHTML = ''; setRetry(false); update(); showMessage(els.message, 'Нажмите «Старт»', ''); }
  function submit(event) { event.preventDefault(); if (!state.running || state.awaitingRetry || els.answer.value.trim() === '') return; const ok = Number(els.answer.value) === state.answer; flashAnswer(els.answer, ok); flashTask(els.task, ok); if (ok) { state.correct += 1; els.last.textContent = `${((Date.now() - state.started) / 1000).toFixed(1)} с`; update(); els.answer.disabled = true; els.answerBtn.disabled = true; showMessage(els.message, `Верно · ответ ${state.answer}`, 'good'); window.setTimeout(() => state.running && next(), 850); } else { state.wrong += 1; state.awaitingRetry = true; els.answer.disabled = true; els.answerBtn.disabled = true; setRetry(true); update(); showMessage(els.message, 'Неверно. Пересчитайте или пропустите', 'bad'); } }
  function retry() { if (!state.running || !state.awaitingRetry) return; state.awaitingRetry = false; setRetry(false); els.answer.value = ''; els.answer.disabled = false; els.answerBtn.disabled = false; els.answer.focus(); showMessage(els.message, 'Пересчитайте ещё раз', ''); }
  function skip() { if (state.running && state.awaitingRetry) { showMessage(els.message, `Пропуск · ответ ${state.answer}`, 'bad'); window.setTimeout(() => state.running && next(), 650); } }
  Trainer.stopRoulette3d = () => { state.running = false; state.awaitingRetry = false; };
  Trainer.initRoulette3d = function () { const saved = getSettings ? getSettings().roulette3d || {} : {}; if (LEVEL[saved.level]) state.level = saved.level; if (Array.isArray(saved.denominations)) state.denominations = saved.denominations; els.level.forEach((b) => { setPressed(b, b.dataset.level === state.level); b.addEventListener('click', () => { state.level = b.dataset.level; setPressed(b, true); els.level.filter((x) => x !== b).forEach((x) => setPressed(x, false)); saveSettings?.({ roulette3d: { level: state.level, denominations: state.denominations } }); }); }); els.denoms.forEach((b) => { setPressed(b, state.denominations.includes(Number(b.dataset.denomination))); b.addEventListener('click', () => { const n = Number(b.dataset.denomination); state.denominations = state.denominations.includes(n) ? state.denominations.filter((x) => x !== n) : [...state.denominations, n]; setPressed(b, state.denominations.includes(n)); saveSettings?.({ roulette3d: { level: state.level, denominations: state.denominations } }); }); }); els.start.addEventListener('click', start); els.reset.addEventListener('click', reset); els.form.addEventListener('submit', submit); els.retry.addEventListener('click', retry); els.skip.addEventListener('click', skip); reset(); };
})();
