window.Trainer = window.Trainer || {};

/**
 * Shared timed-session loop for multiplication / addition / BJ / payouts / poker.
 * Modes keep their own question logic and pass the same state object.
 */
Trainer.createTimedSession = function createTimedSession(options) {
  const state = options.state;
  const els = options.els || {};
  const summaryTitle = options.summaryTitle || 'Итог сессии';

  function stopTimers() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
    if (state.nextTimer) {
      window.clearTimeout(state.nextTimer);
      state.nextTimer = null;
    }
  }

  function updateStats() {
    if (els.timeLeft && Trainer.formatTime) {
      els.timeLeft.textContent = Trainer.formatTime(state.secondsLeft);
    }
    if (els.correctCount) {
      els.correctCount.textContent = state.correct;
    }
    if (els.wrongCount) {
      els.wrongCount.textContent = state.wrong;
    }
    if (els.timeProgress && Trainer.setProgress) {
      Trainer.setProgress(els.timeProgress, state.secondsLeft, state.duration);
    }
  }

  function syncTimeButtons(buttons) {
    if (!buttons) {
      return;
    }
    buttons.forEach((button) => {
      Trainer.setPressed(
        button,
        String(state.duration) === button.dataset.seconds ||
          (state.duration === null && button.dataset.seconds === 'free')
      );
    });
  }

  function applySavedDuration(saved) {
    if (!saved) {
      return;
    }
    if (saved.duration === null || typeof saved.duration === 'number') {
      state.duration = saved.duration;
      state.secondsLeft = saved.duration;
      if (state.timeMode !== undefined) {
        state.timeMode = saved.duration === null ? 'free' : 'timed';
      }
    }
  }

  function setDuration(seconds, persist) {
    state.duration = seconds;
    state.secondsLeft = seconds;
    if (state.timeMode !== undefined) {
      state.timeMode = seconds === null ? 'free' : 'timed';
    }
    updateStats();
    persist?.(seconds);
  }

  function bindTimeButtons(buttons, persist) {
    if (!buttons) {
      return;
    }
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        setDuration(button.dataset.seconds === 'free' ? null : Number(button.dataset.seconds), persist);
        syncTimeButtons(buttons);
      });
    });
  }

  function beginRun() {
    stopTimers();
    state.correct = 0;
    state.wrong = 0;
    state.sessionLog = [];
    state.secondsLeft = state.duration;
    state.running = true;
  }

  function startClock(onExpire) {
    const timed = state.duration !== null && (state.timeMode === undefined || state.timeMode === 'timed');
    if (!timed) {
      return;
    }
    state.timer = window.setInterval(() => {
      state.secondsLeft -= 1;
      updateStats();
      if (state.secondsLeft <= 0) {
        onExpire();
      }
    }, 1000);
  }

  function presentSummary(correct, wrong, log) {
    const entries = log || state.sessionLog;
    if (!entries.length || !Trainer.showSessionSummary) {
      return;
    }
    Trainer.showSessionSummary({
      title: summaryTitle,
      correct: correct != null ? correct : state.correct,
      wrong: wrong != null ? wrong : state.wrong,
      log: entries.slice()
    });
    state.sessionLog = [];
  }

  function finish(onAfter) {
    stopTimers();
    state.running = false;
    onAfter?.();
    if (els.message && Trainer.showMessage) {
      Trainer.showMessage(els.message, `Готово: ${state.correct} верно, ${state.wrong} ошибок`, 'good');
    }
    presentSummary();
  }

  function resetRun() {
    const snapshot = {
      correct: state.correct,
      wrong: state.wrong,
      log: (state.sessionLog || []).slice()
    };
    stopTimers();
    state.correct = 0;
    state.wrong = 0;
    state.secondsLeft = state.duration;
    state.running = false;
    state.questionStartedAt = null;
    return snapshot;
  }

  function record(mode, label, isCorrect) {
    Trainer.pushSessionAttempt?.(state.sessionLog, label, isCorrect, state.questionStartedAt);
    Trainer.recordAttempt?.(mode, label, isCorrect, state.questionStartedAt);
    if (isCorrect) {
      state.correct += 1;
      Trainer.bumpStat?.(els.correctCount);
    } else {
      state.wrong += 1;
      Trainer.bumpStat?.(els.wrongCount);
    }
    updateStats();
  }

  function isWaiting() {
    return Boolean(state.nextTimer);
  }

  function scheduleNext(fn, ms) {
    if (state.nextTimer) {
      window.clearTimeout(state.nextTimer);
    }
    state.nextTimer = window.setTimeout(() => {
      state.nextTimer = null;
      if (state.running) {
        fn();
      }
    }, ms);
  }

  return {
    stopTimers,
    updateStats,
    syncTimeButtons,
    applySavedDuration,
    setDuration,
    bindTimeButtons,
    beginRun,
    startClock,
    presentSummary,
    finish,
    resetRun,
    record,
    isWaiting,
    scheduleNext
  };
};
