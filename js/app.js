window.Trainer = window.Trainer || {};

(function () {
  const { $ } = Trainer;

  const tabs = {
    multiplication: {
      panel: $('#multiplicationTab'),
      button: $('#multiplicationTabBtn'),
      stop: () => Trainer.stopMultiplication()
    },
    blackjack: {
      panel: $('#blackjackTab'),
      button: $('#blackjackTabBtn'),
      stop: () => Trainer.stopBlackjack()
    },
    counting: {
      panel: $('#countingTab'),
      button: $('#countingTabBtn'),
      stop: () => Trainer.stopCounting()
    },
    payouts: {
      panel: $('#payoutsTab'),
      button: $('#payoutsTabBtn'),
      stop: () => Trainer.stopPayouts()
    },
    duel: {
      panel: $('#duelTab'),
      button: $('#duelTabBtn'),
      stop: () => Trainer.stopDuel()
    }
  };

  function selectTab(name) {
    Object.values(tabs).forEach((tab) => tab.stop());

    Object.entries(tabs).forEach(([key, tab]) => {
      const active = key === name;
      tab.panel.classList.toggle('hidden', !active);
      tab.panel.classList.remove('tab-enter');
      tab.button.classList.toggle('active', active);
      tab.button.setAttribute('aria-selected', String(active));
      if (active) {
        void tab.panel.offsetWidth;
        tab.panel.classList.add('tab-enter');
      }
    });
  }

  function initTabs() {
    Object.entries(tabs).forEach(([name, tab]) => {
      tab.button.addEventListener('click', () => selectTab(name));
    });
  }

  Trainer.initMultiplication();
  Trainer.initBlackjack();
  Trainer.initCounting();
  Trainer.initPayouts();
  Trainer.initDuel();
  initTabs();
  Trainer.renderStoredStats();
  if (Trainer.initStatsControls) {
    Trainer.initStatsControls();
  }
})();
