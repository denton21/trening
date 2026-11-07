window.Trainer = window.Trainer || {};

(function () {
  const { $, pick, randInt, showMessage, flashTask, keepAnswerFocus } = Trainer;
  const denomination = 5;
  const maxAmount = 5000;
  const series = [
    { name: 'Voisins', units: 9 },
    { name: 'Orphelins', units: 5 },
    { name: 'Tiers', units: 6 },
    { name: 'Zero Spiel', units: 4 }
  ];

  Trainer.initSeriesPayouts = function initSeriesPayouts() {
    const task = $('#seriesPayoutsTask');
    const question = $('#seriesPayoutsQuestion');
    const form = $('#seriesPayoutsForm');
    const stakeInput = $('#seriesPayoutsStake');
    const changeInput = $('#seriesPayoutsChange');
    const submit = $('#seriesPayoutsSubmit');
    const message = $('#seriesPayoutsMessage');
    let expectedStake;
    let expectedChange;
    let reviewing = false;

    function nextQuestion() {
      const { name, units } = pick(series);
      const minimum = units * denomination;
      const remainder = randInt(0, 1) ? randInt(1, units - 1) * denomination : 0;
      const amount = randInt(1, Math.floor((maxAmount - remainder) / minimum)) * minimum + remainder;
      expectedStake = Math.floor(amount / minimum) * denomination;
      expectedChange = amount - expectedStake * units;
      question.textContent = `${name} · $${amount}`;
      form.reset();
      reviewing = false;
      stakeInput.readOnly = changeInput.readOnly = false;
      submit.textContent = 'Проверить';
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (reviewing) {
        nextQuestion();
        showMessage(message, '');
        keepAnswerFocus(stakeInput);
        return;
      }

      const correct = stakeInput.valueAsNumber === expectedStake && Number(changeInput.value) === expectedChange;
      flashTask(task, correct);
      if (correct) {
        nextQuestion();
        showMessage(message, 'Верно', 'good');
        keepAnswerFocus(stakeInput);
      } else {
        reviewing = true;
        stakeInput.readOnly = changeInput.readOnly = true;
        submit.textContent = 'Дальше';
        const change = expectedChange ? `сдача $${expectedChange}` : 'без сдачи';
        showMessage(message, `Играет по $${expectedStake}, ${change}.`, 'bad');
        submit.focus({ preventScroll: true });
      }
    });

    nextQuestion();
  };
})();
