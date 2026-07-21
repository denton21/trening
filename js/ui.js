window.Trainer = window.Trainer || {};

function replayClass(element, className) {
  if (!element) {
    return;
  }
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

Trainer.showMessage = function showMessage(element, text, type = '') {
  if (!element) {
    return;
  }
  element.textContent = text;
  element.className = `message ${type || ''}`.trim();
  replayClass(element, 'is-pop');
};

Trainer.animateExample = function animateExample(element, text) {
  if (!element) {
    return;
  }
  element.textContent = text;
  replayClass(element, 'is-enter');
};

Trainer.flashAnswer = function flashAnswer(input, ok) {
  if (!input) {
    return;
  }
  input.classList.remove('flash-good', 'flash-bad');
  void input.offsetWidth;
  input.classList.add(ok ? 'flash-good' : 'flash-bad');
};

Trainer.bumpStat = function bumpStat(element) {
  if (!element) {
    return;
  }
  replayClass(element, 'is-bump');
};

Trainer.flashTask = function flashTask(taskElement, ok) {
  if (!taskElement) {
    return;
  }
  taskElement.classList.remove('is-correct', 'is-wrong');
  void taskElement.offsetWidth;
  if (ok) {
    taskElement.classList.add('is-correct');
  }
};

Trainer.setProgress = function setProgress(bar, secondsLeft, duration) {
  if (!bar) {
    return;
  }
  bar.style.width = secondsLeft === null ? '100%' : `${(secondsLeft / duration) * 100}%`;
};

/** Track one attempt inside a training session. */
Trainer.pushSessionAttempt = function pushSessionAttempt(log, label, correct, startedAt) {
  if (!Array.isArray(log)) {
    return;
  }
  const ms = Math.max(0, Date.now() - (startedAt || Date.now()));
  log.push({ label: String(label || '—'), correct: Boolean(correct), ms });
};

/**
 * Session summary overlay.
 * @param {{ title: string, correct: number, wrong: number, log?: Array }} options
 */
Trainer.showSessionSummary = function showSessionSummary(options = {}) {
  const overlay = document.getElementById('sessionSummary');
  if (!overlay) {
    return;
  }

  const title = options.title || 'Итог сессии';
  const correct = options.correct || 0;
  const wrong = options.wrong || 0;
  const log = Array.isArray(options.log) ? options.log : [];
  const total = log.length || correct + wrong;

  let totalMs = 0;
  let worst = null;
  log.forEach((entry) => {
    totalMs += entry.ms || 0;
    if (!worst || entry.ms > worst.ms) {
      worst = entry;
    }
  });

  const avgSec = total ? (totalMs / total / 1000).toFixed(1) : '—';
  const worstText = worst
    ? `${worst.label} · ${(worst.ms / 1000).toFixed(1)} с${worst.correct ? '' : ' (ошибка)'}`
    : '—';

  const titleEl = document.getElementById('sessionSummaryTitle');
  const bodyEl = document.getElementById('sessionSummaryBody');
  if (titleEl) {
    titleEl.textContent = title;
  }
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="session-summary-grid">
        <div class="stat"><span>Верно</span><strong>${correct}</strong></div>
        <div class="stat"><span>Ошибки</span><strong>${wrong}</strong></div>
        <div class="stat"><span>Ответов</span><strong>${total}</strong></div>
        <div class="stat"><span>Среднее</span><strong>${avgSec === '—' ? '—' : `${avgSec} с`}</strong></div>
      </div>
      <p class="session-summary-worst"><span>Самый долгий</span><strong>${worstText}</strong></p>
    `;
  }

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  const closeBtn = document.getElementById('sessionSummaryClose');
  if (closeBtn) {
    closeBtn.focus();
  }
};

Trainer.hideSessionSummary = function hideSessionSummary() {
  const overlay = document.getElementById('sessionSummary');
  if (!overlay) {
    return;
  }
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
};

Trainer.initSessionSummary = function initSessionSummary() {
  const overlay = document.getElementById('sessionSummary');
  const closeBtn = document.getElementById('sessionSummaryClose');
  if (!overlay) {
    return;
  }
  const close = () => Trainer.hideSessionSummary();
  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.classList.contains('hidden')) {
      close();
    }
  });
};
