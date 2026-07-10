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
