window.Trainer = window.Trainer || {};

(function () {
  const KEY = 'roulette-trainer-settings-v1';

  const defaults = {
    theme: 'light',
    multiplication: {
      tables: [5],
      mode: 'all',
      multipliers: null,
      duration: 60
    },
    blackjack: {
      duration: 60
    },
    counting: {
      level: 'easy'
    },
    payouts: {
      color: 1,
      mode: 'cash',
      duration: 60
    },
    duel: {
      playerName: '',
      mode: 'multiplication',
      level: 'easy'
    }
  };

  function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object') {
      return base;
    }
    const out = Array.isArray(base) ? base.slice() : { ...base };
    Object.keys(patch).forEach((key) => {
      const value = patch[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        out[key] = deepMerge(base[key] && typeof base[key] === 'object' ? base[key] : {}, value);
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === 'object') {
        return deepMerge(defaults, raw);
      }
    } catch {
      // ignore
    }
    return deepMerge(defaults, {});
  }

  let settings = load();

  Trainer.getSettings = function getSettings() {
    return settings;
  };

  Trainer.saveSettings = function saveSettings(patch) {
    settings = deepMerge(settings, patch || {});
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // quota / private mode
    }
    return settings;
  };

  Trainer.applyTheme = function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', next === 'dark' ? '#070b14' : '#0d9488');
    });
    Trainer.saveSettings({ theme: next });
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', String(next === 'dark'));
      btn.textContent = next === 'dark' ? 'Светлая' : 'Тёмная';
      btn.title = next === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
    }
  };

  Trainer.initTheme = function initTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = settings.theme || (prefersDark ? 'dark' : 'light');
    Trainer.applyTheme(theme);

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        Trainer.applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }
  };
})();
