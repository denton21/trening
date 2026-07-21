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

  const tabOrder = Object.keys(tabs);
  const LEAVE_MS = 210;
  let activeTab = 'multiplication';
  let switching = false;
  let switchTimer = null;
  const tabsEl = document.querySelector('.tabs');

  function clearSwitchTimer() {
    if (switchTimer) {
      window.clearTimeout(switchTimer);
      switchTimer = null;
    }
  }

  function moveIndicator(button) {
    if (!tabsEl || !button) {
      return;
    }
    const tabsRect = tabsEl.getBoundingClientRect();
    const btnRect = button.getBoundingClientRect();
    const x = btnRect.left - tabsRect.left + tabsEl.scrollLeft;
    tabsEl.style.setProperty('--tabs-indicator-x', `${Math.round(x)}px`);
    tabsEl.style.setProperty('--tabs-indicator-w', `${Math.round(btnRect.width)}px`);
  }

  function setButtons(name) {
    Object.entries(tabs).forEach(([key, tab]) => {
      const active = key === name;
      tab.button.classList.toggle('active', active);
      tab.button.setAttribute('aria-selected', String(active));
      tab.button.tabIndex = active ? 0 : -1;
    });
    moveIndicator(tabs[name].button);
  }

  function showPanel(name, animate) {
    const next = tabs[name];
    Object.entries(tabs).forEach(([key, tab]) => {
      const active = key === name;
      tab.panel.classList.toggle('hidden', !active);
      tab.panel.classList.remove('tab-enter', 'tab-leave');
      tab.panel.setAttribute('aria-hidden', String(!active));
    });

    if (animate) {
      void next.panel.offsetWidth;
      next.panel.classList.add('tab-enter');
      next.panel.addEventListener(
        'animationend',
        () => {
          next.panel.classList.remove('tab-enter');
        },
        { once: true }
      );
    }
  }

  function selectTab(name) {
    if (!tabs[name] || name === activeTab || switching) {
      return;
    }

    const prevName = activeTab;
    const prev = tabs[prevName];
    const next = tabs[name];

    switching = true;
    clearSwitchTimer();
    Object.values(tabs).forEach((tab) => tab.stop());
    setButtons(name);
    activeTab = name;

    prev.panel.classList.remove('tab-enter');
    prev.panel.classList.add('tab-leave');

    switchTimer = window.setTimeout(() => {
      prev.panel.classList.add('hidden');
      prev.panel.classList.remove('tab-leave');
      prev.panel.setAttribute('aria-hidden', 'true');

      next.panel.classList.remove('hidden', 'tab-leave');
      next.panel.setAttribute('aria-hidden', 'false');
      void next.panel.offsetWidth;
      next.panel.classList.add('tab-enter');

      // Ждём children stagger (~590ms), потом снимаем классы
      window.setTimeout(() => {
        next.panel.classList.remove('tab-enter');
        switching = false;
      }, 620);
    }, LEAVE_MS);
  }

  function initTabs() {
    tabOrder.forEach((name) => {
      const tab = tabs[name];
      tab.button.setAttribute('aria-controls', tab.panel.id);
      tab.panel.setAttribute('role', 'tabpanel');
      tab.panel.setAttribute('aria-labelledby', tab.button.id);
      tab.button.addEventListener('click', () => selectTab(name));
    });

    tabsEl?.addEventListener('keydown', (event) => {
      const currentIndex = tabOrder.indexOf(activeTab);
      if (currentIndex < 0) {
        return;
      }
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % tabOrder.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabOrder.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      selectTab(tabOrder[nextIndex]);
      tabs[tabOrder[nextIndex]].button.focus();
    });

    setButtons(activeTab);
    showPanel(activeTab, false);
    window.addEventListener('resize', () => moveIndicator(tabs[activeTab].button));
    // After fonts/layout settle
    window.requestAnimationFrame(() => moveIndicator(tabs[activeTab].button));
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
