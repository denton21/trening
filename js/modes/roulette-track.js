window.Trainer = window.Trainer || {};

(function () {
  const { $, EURO_ORDER, EURO_RED, pick, shuffle, formatTime, showMessage } = Trainer;
  const namespace = 'http://www.w3.org/2000/svg';
  const outerRadius = 84;
  const innerRadius = 46;
  const labelRadius = (outerRadius + innerRadius) / 2;
  const centerY = 90;
  const left = 90;
  const right = 650;
  const top = centerY - innerRadius;
  const bottom = centerY + innerRadius;
  const orphelinsStart = left + (right - left) * 5 / 17;
  const orphelinsEnd = left + (right - left) * 10 / 17;
  const zeroStart = right - (right - left) * 2.6 / 17;
  const clock = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  let stop;

  function straightCells(count, from, to, y) {
    const width = (to - from) / count;
    return Array.from({ length: count }, (_, index) => {
      const x = from + index * width;
      return {
        d: `M ${x} ${y} h ${width} v ${outerRadius - innerRadius} h ${-width} Z`,
        labelX: x + width / 2,
        labelY: y + (outerRadius - innerRadius) / 2
      };
    });
  }

  function curvedCells(centerX, angle, count) {
    const step = Math.PI / count;
    const point = (radius, a) => `${centerX + radius * Math.cos(a)} ${centerY + radius * Math.sin(a)}`;
    return Array.from({ length: count }, (_, index) => {
      const start = angle + index * step;
      const end = start + step;
      const middle = (start + end) / 2;
      return {
        d: [
          `M ${point(outerRadius, start)}`,
          `A ${outerRadius} ${outerRadius} 0 0 1 ${point(outerRadius, end)}`,
          `L ${point(innerRadius, end)}`,
          `A ${innerRadius} ${innerRadius} 0 0 0 ${point(innerRadius, start)} Z`
        ].join(' '),
        labelX: centerX + labelRadius * Math.cos(middle),
        labelY: centerY + labelRadius * Math.sin(middle)
      };
    });
  }

  function drawSeries(board) {
    const background = document.createElementNS(namespace, 'path');
    background.setAttribute('class', 'roulette-track-series-background');
    background.setAttribute('d', [
      `M ${left} ${top} H ${right}`,
      `A ${innerRadius} ${innerRadius} 0 0 1 ${right} ${bottom} H ${left}`,
      `A ${innerRadius} ${innerRadius} 0 0 1 ${left} ${top} Z`
    ].join(' '));

    const boundaries = document.createElementNS(namespace, 'path');
    boundaries.setAttribute('class', 'roulette-track-series-boundaries');
    boundaries.setAttribute('d', [
      `M ${orphelinsStart} ${top} V ${bottom}`,
      `M ${orphelinsEnd} ${top} V ${bottom}`,
      `M ${zeroStart} ${top} A ${innerRadius} ${innerRadius} 0 0 0 ${zeroStart} ${bottom}`
    ].join(' '));
    board.append(background, boundaries);

    const labels = [
      ['SERIE 5/8', (left + orphelinsStart) / 2],
      ['ORPHELINS', (orphelinsStart + orphelinsEnd) / 2],
      ['SERIE 0/2/3', (orphelinsEnd + zeroStart - innerRadius) / 2],
      ['0-SPIEL', (zeroStart + right) / 2]
    ];
    for (const [name, x] of labels) {
      const label = document.createElementNS(namespace, 'text');
      label.setAttribute('class', 'roulette-track-series-label');
      label.setAttribute('x', x);
      label.setAttribute('y', centerY);
      label.textContent = name;
      board.appendChild(label);
    }
  }

  function initTrackTest(upperNumbers, setTestMode) {
    const mode = $('#rouletteTrackTestMode');
    const panel = $('#rouletteTrackTest');
    const start = $('#rouletteTrackTestStart');
    const answers = $('#rouletteTrackTestAnswers');
    const upperButton = answers.querySelector('[data-side="upper"]');
    const number = $('#rouletteTrackTestNumber');
    const progress = $('#rouletteTrackTestProgress');
    const time = $('#rouletteTrackTestTime');
    const result = $('#rouletteTrackTestResult');
    const pool = EURO_ORDER.filter((value) => value !== 0);
    let questions = [];
    let answered = 0;
    let correct = 0;
    let startedAt;
    let timer = null;

    function updateTime() {
      time.textContent = formatTime(Math.floor((performance.now() - startedAt) / 1000));
    }

    function showNumber(value) {
      number.textContent = value ?? '—';
      number.classList.toggle('is-red', value != null && EURO_RED.has(value));
      number.classList.toggle('is-black', value != null && !EURO_RED.has(value));
    }

    function endRun() {
      clearInterval(timer);
      timer = null;
      answers.classList.add('hidden');
      start.classList.remove('hidden');
      showNumber(null);
    }

    function reset() {
      if (timer === null) return;
      endRun();
      time.textContent = formatTime(0);
      progress.textContent = `0 / ${pool.length}`;
      showMessage(result, '');
    }

    mode.addEventListener('click', () => {
      const active = !panel.classList.toggle('hidden');
      mode.setAttribute('aria-pressed', String(active));
      mode.textContent = active ? 'Вернуться к треку' : 'Тест по всем числам';
      reset();
      setTestMode(active);
    });

    start.addEventListener('click', () => {
      if (timer !== null) return;
      questions = shuffle(pool);
      answered = 0;
      correct = 0;
      progress.textContent = `0 / ${questions.length}`;
      showMessage(result, '');
      start.classList.add('hidden');
      answers.classList.remove('hidden');
      showNumber(questions[0]);
      startedAt = performance.now();
      updateTime();
      timer = setInterval(updateTime, 250);
      upperButton.focus();
    });

    answers.addEventListener('click', (event) => {
      const side = event.target.closest('[data-side]')?.dataset.side;
      if (timer === null || !side) return;

      const upper = upperNumbers.has(questions[answered]);
      const hit = upper === (side === 'upper');
      if (hit) correct += 1;
      answered += 1;
      progress.textContent = `${answered} / ${questions.length}`;

      if (answered === questions.length) {
        updateTime();
        endRun();
        showMessage(result, `Верно ${correct} из ${questions.length} · ${time.textContent}`, 'good');
        start.focus();
        return;
      }

      showMessage(result, hit ? 'Верно' : upper ? 'Правильный ответ — верхний' : 'Правильный ответ — нижний', hit ? 'good' : 'bad');
      showNumber(questions[answered]);
    });

    return reset;
  }

  Trainer.initRouletteTrack = function initRouletteTrack() {
    const board = $('#rouletteTrackBoard');
    const target = $('#rouletteTrackTarget');
    const message = $('#rouletteTrackMessage');
    const start = $('#rouletteTrackStart');
    const showNumbers = $('#rouletteTrackShowNumbers');
    const trainer = $('#rouletteTrackTab');
    const hint = $('#rouletteTrackHint');
    // The reference starts at 10; the right curve reads 3, 26, 0.
    const first = EURO_ORDER.indexOf(10);
    const numbers = [...EURO_ORDER.slice(first), ...EURO_ORDER.slice(0, first)];
    const paths = [
      ...straightCells(17, left, right, centerY - outerRadius),
      ...curvedCells(right, -Math.PI / 2, 3),
      ...straightCells(7, right, orphelinsEnd, bottom),
      ...straightCells(3, orphelinsEnd, orphelinsStart, bottom),
      ...straightCells(5, orphelinsStart, left, bottom),
      ...curvedCells(left, Math.PI / 2, 2)
    ];
    drawSeries(board);
    const numberLabels = document.createElementNS(namespace, 'g');
    numberLabels.setAttribute('aria-hidden', 'true');
    const cells = paths.map(({ d, labelX, labelY }, index) => {
      const cell = document.createElementNS(namespace, 'path');
      const number = numbers[index];
      const color = number === 0 ? 'green' : EURO_RED.has(number) ? 'red' : 'black';
      cell.setAttribute('d', d);
      cell.setAttribute('class', `roulette-track-cell is-${color}`);
      cell.setAttribute('role', 'button');
      cell.dataset.number = number;
      board.appendChild(cell);

      const label = document.createElementNS(namespace, 'text');
      label.setAttribute('class', 'roulette-track-number-label');
      label.setAttribute('x', labelX);
      label.setAttribute('y', labelY);
      label.textContent = String(number);
      numberLabels.appendChild(label);
      return cell;
    });
    board.appendChild(numberLabels);

    function updateNumberVisibility() {
      numberLabels.classList.toggle('hidden', !showNumbers.checked);
      cells.forEach((cell, index) => {
        const label = showNumbers.checked
          ? `Число ${numbers[index]}`
          : `Ячейка ${index + 1} по часовой стрелке`;
        cell.setAttribute('aria-label', label);
      });
    }

    showNumbers.addEventListener('change', updateNumberVisibility);
    updateNumberVisibility();

    let expected = null;
    let startedAt = 0;
    let markedCell;

    function clearMark() {
      markedCell?.classList.remove('is-hit', 'is-miss');
    }

    function nextTarget() {
      expected = pick(EURO_ORDER.filter((number) => number !== expected));
      target.textContent = String(expected);
      startedAt = performance.now();
    }

    function setActive(active) {
      board.setAttribute('aria-disabled', String(!active));
      cells.forEach((cell) => cell.setAttribute('tabindex', active ? '0' : '-1'));
      start.textContent = active ? 'Заново' : 'Начать';
    }

    function guess(cell) {
      if (expected === null || !cell.matches('.roulette-track-cell')) return;
      clearMark();
      markedCell = cell;
      if (Number(cell.dataset.number) !== expected) {
        cell.classList.add('is-miss');
        showMessage(message, 'Промах. Попробуй ещё раз.', 'bad');
        return;
      }
      cell.classList.add('is-hit');
      const seconds = (performance.now() - startedAt) / 1000;
      showMessage(message, `Верно · ${clock.format(seconds)} с`, 'good');
      nextTarget();
    }

    start.addEventListener('click', () => {
      clearMark();
      showMessage(message, '');
      nextTarget();
      setActive(true);
    });
    board.addEventListener('click', (event) => guess(event.target));
    board.addEventListener('keydown', (event) => {
      if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        guess(event.target);
      }
    });
    function stopPractice() {
      if (expected === null) return;
      expected = null;
      target.textContent = '—';
      clearMark();
      showMessage(message, '');
      setActive(false);
    }

    const upperNumbers = new Set(numbers.filter((number, index) => (
      number === 26 || paths[index].labelY < centerY
    )));
    const practiceControls = [hint, showNumbers.parentElement, start, target.parentElement, board, message];
    const stopTest = initTrackTest(upperNumbers, (active) => {
      stopPractice();
      trainer.classList.toggle('is-testing', active);
      practiceControls.forEach((element) => element.classList.toggle('hidden', active));
    });
    stop = () => {
      stopPractice();
      stopTest();
    };
    setActive(false);
  };

  Trainer.stopRouletteTrack = () => stop?.();
})();
