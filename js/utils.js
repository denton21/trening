window.Trainer = window.Trainer || {};

Trainer.tableOptions = [5, 8, 11, 17, 35];
Trainer.allMultipliers = Array.from({ length: 20 }, (_, index) => index + 1);

Trainer.$ = function $(selector, root = document) {
  return root.querySelector(selector);
};

Trainer.$$ = function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
};

Trainer.formatTime = function formatTime(seconds) {
  if (seconds === null) {
    return '∞';
  }
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

Trainer.setPressed = function setPressed(button, active) {
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
};

Trainer.makeButton = function makeButton(text, active, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `choice${active ? ' active' : ''}`;
  button.textContent = text;
  button.setAttribute('aria-pressed', String(active));
  button.addEventListener('click', onClick);
  return button;
};
