window.Trainer = window.Trainer || {};

(function () {
  const { $ } = Trainer;
  const statsKey = 'roulette-trainer-stats-v2';
  const modes = ['multiplication', 'addition', 'blackjack', 'counting', 'payouts', 'poker'];

  function emptyModeStats() {
    return { attempts: 0, correct: 0, totalMs: 0, examples: {} };
  }

  function normalize(raw) {
    const result = {};
    modes.forEach((mode) => {
      result[mode] = raw?.[mode] ? { ...emptyModeStats(), ...raw[mode], examples: raw[mode].examples || {} } : emptyModeStats();
    });
    return result;
  }

  function loadStoredStats() {
    try {
      const current = JSON.parse(localStorage.getItem(statsKey) || 'null');
      if (current) return normalize(current);
      const legacy = JSON.parse(localStorage.getItem('roulette-trainer-stats-v1') || 'null');
      return normalize(legacy || {});
    } catch {
      return normalize({});
    }
  }

  const storedStats = loadStoredStats();
  Trainer.storedStats = storedStats;

  function save() {
    try { localStorage.setItem(statsKey, JSON.stringify(storedStats)); } catch { /* storage unavailable */ }
  }

  function renderTimingChart(mode, chartElement, emptyText) {
    if (!chartElement) return;
    const entries = Object.entries(storedStats[mode].examples)
      .map(([example, result]) => ({ example, average: result.totalMs / Math.max(1, result.attempts) }))
      .sort((left, right) => right.average - left.average);
    chartElement.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'timing-empty';
      empty.textContent = emptyText;
      chartElement.appendChild(empty);
      return;
    }
    const maximum = entries[0].average;
    entries.slice(0, 30).forEach(({ example, average }) => {
      const row = document.createElement('div'); row.className = 'timing-row';
      row.setAttribute('aria-label', `${example}: ${(average / 1000).toFixed(1)} секунд`);
      const label = document.createElement('span'); label.textContent = example;
      const track = document.createElement('span'); track.className = 'timing-track';
      const bar = document.createElement('span'); bar.className = 'timing-bar'; track.appendChild(bar);
      const value = document.createElement('span'); value.textContent = `${(average / 1000).toFixed(1)} с`;
      row.append(label, track, value); chartElement.appendChild(row);
      requestAnimationFrame(() => { bar.style.width = `${Math.max(6, (average / Math.max(1, maximum)) * 100)}%`; });
    });
  }

  Trainer.renderStoredStats = function renderStoredStats() {
    modes.forEach((mode) => {
      const stats = storedStats[mode];
      const attempts = $(`#${mode}Attempts`);
      const average = $(`#${mode}Average`);
      if (attempts) attempts.textContent = stats.attempts;
      if (average) average.textContent = stats.attempts ? `${(stats.totalMs / stats.attempts / 1000).toFixed(1)} с` : '-';
      renderTimingChart(mode, $(`#${mode}Chart`), 'Решите примеры, чтобы увидеть скорость.');
    });
  };

  Trainer.recordAttempt = function recordAttempt(mode, example, correct, startedAt) {
    const elapsedMs = Math.max(0, Date.now() - (startedAt || Date.now()));
    const stats = storedStats[mode] || (storedStats[mode] = emptyModeStats());
    const key = String(example || '—');
    const item = stats.examples[key] || { attempts: 0, correct: 0, totalMs: 0 };
    stats.attempts += 1; stats.correct += correct ? 1 : 0; stats.totalMs += elapsedMs;
    item.attempts += 1; item.correct += correct ? 1 : 0; item.totalMs += elapsedMs;
    stats.examples[key] = item; save(); Trainer.renderStoredStats();
  };

  Trainer.clearModeStats = function clearModeStats(mode) {
    if (!storedStats[mode]) return false;
    storedStats[mode] = emptyModeStats(); save(); Trainer.renderStoredStats(); return true;
  };

  Trainer.initStatsControls = function initStatsControls() {
    const labels = { multiplication: 'умножения', addition: 'сложения', blackjack: 'blackjack', counting: 'счёта', payouts: 'выплат', poker: 'покера' };
    modes.forEach((mode) => {
      const button = $(`#reset${mode[0].toUpperCase() + mode.slice(1)}StatsBtn`);
      if (button) {
        button.addEventListener('click', () => {
          if (window.confirm(`Сбросить статистику ${labels[mode]}?`)) Trainer.clearModeStats(mode);
        });
      }
      const section = document.querySelector(`[data-stats-section="${mode}"]`);
      if (section) {
        const saved = Trainer.safeStorageGet?.(`roulette-trainer-stats-open-${mode}`, '1');
        section.open = saved !== '0';
        section.addEventListener('toggle', () => {
          Trainer.safeStorageSet?.(`roulette-trainer-stats-open-${mode}`, section.open ? '1' : '0');
        });
      }
    });
  };
})();
