window.Trainer = window.Trainer || {};

(function () {
  const { $ } = Trainer;
  const statsKey = 'roulette-trainer-stats-v1';

  function emptyModeStats() {
    return { attempts: 0, correct: 0, totalMs: 0, examples: {} };
  }

  function loadStoredStats() {
    try {
      const stored = JSON.parse(localStorage.getItem(statsKey));
      if (stored && stored.multiplication && stored.picture) {
        return {
          ...stored,
          blackjack: stored.blackjack || emptyModeStats(),
          payouts: stored.payouts || emptyModeStats()
        };
      }
    } catch {
      // Ignore damaged local cache and begin fresh.
    }
    return {
      multiplication: emptyModeStats(),
      picture: emptyModeStats(),
      blackjack: emptyModeStats(),
      payouts: emptyModeStats()
    };
  }

  const storedStats = loadStoredStats();
  Trainer.storedStats = storedStats;

  function renderTimingChart(mode, chartElement, emptyText) {
    const entries = Object.entries(storedStats[mode].examples)
      .map(([example, result]) => ({ example, average: result.totalMs / result.attempts }))
      .sort((left, right) => right.average - left.average);

    chartElement.innerHTML = '';
    if (entries.length === 0) {
      chartElement.innerHTML = `<p class="timing-empty">${emptyText}</p>`;
      return;
    }

    const maximum = entries[0].average;
    entries.forEach(({ example, average }) => {
      const row = document.createElement('div');
      row.className = 'timing-row';
      row.setAttribute('aria-label', `${example}: ${(average / 1000).toFixed(1)} секунд`);

      const label = document.createElement('span');
      label.textContent = example;

      const track = document.createElement('span');
      track.className = 'timing-track';
      const bar = document.createElement('span');
      bar.className = 'timing-bar';
      track.appendChild(bar);

      const value = document.createElement('span');
      value.textContent = `${(average / 1000).toFixed(1)} с`;

      row.append(label, track, value);
      chartElement.appendChild(row);

      requestAnimationFrame(() => {
        bar.style.width = `${Math.max(6, (average / maximum) * 100)}%`;
      });
    });
  }

  Trainer.renderStoredStats = function renderStoredStats() {
    const multiplication = storedStats.multiplication;
    const picture = storedStats.picture;
    const blackjack = storedStats.blackjack;
    const payouts = storedStats.payouts || emptyModeStats();

    $('#multiplicationAttempts').textContent = multiplication.attempts;
    $('#multiplicationAverage').textContent = multiplication.attempts
      ? `${(multiplication.totalMs / multiplication.attempts / 1000).toFixed(1)} с`
      : '-';
    $('#pictureAttempts').textContent = picture.attempts;
    $('#pictureAverage').textContent = picture.attempts
      ? `${(picture.totalMs / picture.attempts / 1000).toFixed(1)} с`
      : '-';
    $('#blackjackAttempts').textContent = blackjack.attempts;
    $('#blackjackAverage').textContent = blackjack.attempts
      ? `${(blackjack.totalMs / blackjack.attempts / 1000).toFixed(1)} с`
      : '-';
    const payoutsAttempts = $('#payoutsAttempts');
    const payoutsAverage = $('#payoutsAverage');
    if (payoutsAttempts) {
      payoutsAttempts.textContent = payouts.attempts;
    }
    if (payoutsAverage) {
      payoutsAverage.textContent = payouts.attempts
        ? `${(payouts.totalMs / payouts.attempts / 1000).toFixed(1)} с`
        : '-';
    }

    renderTimingChart(
      'multiplication',
      $('#multiplicationChart'),
      'Решите примеры, чтобы увидеть скорость по каждому из них.'
    );
    renderTimingChart(
      'blackjack',
      $('#blackjackChart'),
      'Решите выплаты, чтобы увидеть скорость по каждой ставке.'
    );
    const payoutsChart = $('#payoutsChart');
    if (payoutsChart) {
      renderTimingChart(
        'payouts',
        payoutsChart,
        'Решите выплаты, чтобы увидеть скорость по заданиям.'
      );
    }
  };

  Trainer.recordAttempt = function recordAttempt(mode, example, correct, startedAt) {
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    if (!storedStats[mode]) {
      storedStats[mode] = emptyModeStats();
    }
    const modeStats = storedStats[mode];
    const exampleStats = modeStats.examples[example] || { attempts: 0, correct: 0, totalMs: 0 };

    modeStats.attempts += 1;
    modeStats.correct += correct ? 1 : 0;
    modeStats.totalMs += elapsedMs;
    exampleStats.attempts += 1;
    exampleStats.correct += correct ? 1 : 0;
    exampleStats.totalMs += elapsedMs;
    modeStats.examples[example] = exampleStats;

    localStorage.setItem(statsKey, JSON.stringify(storedStats));
    Trainer.renderStoredStats();
  };

  Trainer.clearModeStats = function clearModeStats(mode) {
    if (!storedStats[mode]) {
      return false;
    }
    storedStats[mode] = emptyModeStats();
    localStorage.setItem(statsKey, JSON.stringify(storedStats));
    Trainer.renderStoredStats();
    return true;
  };

  Trainer.initStatsControls = function initStatsControls() {
    const labels = {
      multiplication: 'умножения',
      blackjack: 'blackjack',
      payouts: 'выплат'
    };

    const bindings = [
      ['#resetMultiplicationStatsBtn', 'multiplication'],
      ['#resetBlackjackStatsBtn', 'blackjack'],
      ['#resetPayoutsStatsBtn', 'payouts']
    ];

    bindings.forEach(([selector, mode]) => {
      const button = $(selector);
      if (!button) {
        return;
      }
      button.addEventListener('click', () => {
        const label = labels[mode] || mode;
        if (!window.confirm(`Сбросить статистику ${label}?`)) {
          return;
        }
        Trainer.clearModeStats(mode);
      });
    });
  };
})();
