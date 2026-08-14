window.Trainer = window.Trainer || {};

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function replayClass(element, className) {
  if (!element) {
    return;
  }
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

Trainer.replayClass = replayClass;

const exampleTimers = new WeakMap();

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

  const nextText = text == null ? '' : String(text);
  if (prefersReducedMotion() || element.textContent === nextText || !element.textContent || element.textContent === '—') {
    element.textContent = nextText;
    replayClass(element, 'is-enter');
    return;
  }

  const prev = exampleTimers.get(element);
  if (prev) {
    window.clearTimeout(prev);
  }

  element.classList.remove('is-enter');
  element.classList.add('is-leave');

  const timer = window.setTimeout(() => {
    element.textContent = nextText;
    element.classList.remove('is-leave');
    void element.offsetWidth;
    element.classList.add('is-enter');
    exampleTimers.delete(element);
  }, 150);

  exampleTimers.set(element, timer);
};

Trainer.flashAnswer = function flashAnswer(input, ok) {
  if (!input) {
    return;
  }
  input.classList.remove('flash-good', 'flash-bad');
  void input.offsetWidth;
  input.classList.add(ok ? 'flash-good' : 'flash-bad');
};

/** Keep the virtual keyboard open: never disable a focused field, refocus in the same gesture. */
Trainer.keepAnswerFocus = function keepAnswerFocus(input) {
  if (!input || input.disabled) {
    return;
  }
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
};

Trainer.bumpStat = function bumpStat(element) {
  if (!element) {
    return;
  }
  replayClass(element, 'is-bump');
  const card = element.closest?.('.stat');
  if (card) {
    replayClass(card, 'is-bump-card');
  }
};

Trainer.flashTask = function flashTask(taskElement, ok) {
  if (!taskElement) {
    return;
  }
  taskElement.classList.remove('is-correct', 'is-wrong');
  void taskElement.offsetWidth;
  taskElement.classList.add(ok ? 'is-correct' : 'is-wrong');
};

Trainer.setProgress = function setProgress(bar, secondsLeft, duration) {
  if (!bar) {
    return;
  }
  const track = bar.parentElement;
  if (secondsLeft === null || duration == null || duration <= 0) {
    bar.style.width = '100%';
    track?.classList.remove('is-low');
    return;
  }
  const ratio = Math.max(0, Math.min(1, secondsLeft / duration));
  bar.style.width = `${ratio * 100}%`;
  track?.classList.toggle('is-low', ratio > 0 && ratio <= 0.22);
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
  const esc = Trainer.escapeHtml || ((v) => String(v ?? ''));
  const worstText = worst
    ? `${esc(worst.label)} · ${(worst.ms / 1000).toFixed(1)} с${worst.correct ? '' : ' (ошибка)'}`
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

  overlay.classList.remove('hidden', 'is-leaving');
  overlay.setAttribute('aria-hidden', 'false');
  const closeBtn = document.getElementById('sessionSummaryClose');
  if (closeBtn) {
    closeBtn.focus();
  }
};

Trainer.hideSessionSummary = function hideSessionSummary() {
  const overlay = document.getElementById('sessionSummary');
  if (!overlay || overlay.classList.contains('hidden')) {
    return;
  }

  if (prefersReducedMotion()) {
    overlay.classList.add('hidden');
    overlay.classList.remove('is-leaving');
    overlay.setAttribute('aria-hidden', 'true');
    return;
  }

  overlay.classList.add('is-leaving');
  const finish = () => {
    overlay.classList.add('hidden');
    overlay.classList.remove('is-leaving');
    overlay.setAttribute('aria-hidden', 'true');
  };

  window.setTimeout(finish, 220);
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
