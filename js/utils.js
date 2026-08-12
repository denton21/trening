window.Trainer = window.Trainer || {};

Trainer.safeStorageGet = function safeStorageGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
};

Trainer.safeStorageSet = function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

Trainer.safeStorageRemove = function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

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
  const wasActive = button.classList.contains('active');
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
  if (active && !wasActive) {
    button.classList.remove('is-picked');
    void button.offsetWidth;
    button.classList.add('is-picked');
  }
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

Trainer.escapeHtml = function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

Trainer.randInt = function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
};

Trainer.shuffle = function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

Trainer.pick = function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
};
