window.Trainer = window.Trainer || {};

(function () {
  const { $, EURO_ORDER, EURO_RED, pick, showMessage } = Trainer;
  const namespace = 'http://www.w3.org/2000/svg';
  const outerRadius = 84;
  const innerRadius = 46;
  const centerY = 90;
  const left = 90;
  const right = 650;
  const clock = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  let stop;

  function straightCells(count, top) {
    const width = (right - left) / count;
    const y = top ? centerY - outerRadius : centerY + innerRadius;
    return Array.from({ length: count }, (_, index) => {
      const x = top ? left + index * width : right - (index + 1) * width;
      return `M ${x} ${y} h ${width} v ${outerRadius - innerRadius} h ${-width} Z`;
    });
  }

  function curvedCells(centerX, angle) {
    const step = Math.PI / 5;
    const point = (radius, a) => `${centerX + radius * Math.cos(a)} ${centerY + radius * Math.sin(a)}`;
    return Array.from({ length: 5 }, (_, index) => {
      const start = angle + index * step;
      const end = start + step;
      return [
        `M ${point(outerRadius, start)}`,
        `A ${outerRadius} ${outerRadius} 0 0 1 ${point(outerRadius, end)}`,
        `L ${point(innerRadius, end)}`,
        `A ${innerRadius} ${innerRadius} 0 0 0 ${point(innerRadius, start)} Z`
      ].join(' ');
    });
  }

  Trainer.initRouletteTrack = function initRouletteTrack() {
    const board = $('#rouletteTrackBoard');
    const target = $('#rouletteTrackTarget');
    const message = $('#rouletteTrackMessage');
    const start = $('#rouletteTrackStart');
    // With 14 cells on top, the middle of the right curve is number 26.
    const first = EURO_ORDER.indexOf(26) - 16;
    const numbers = [...EURO_ORDER.slice(first), ...EURO_ORDER.slice(0, first)];
    const paths = [
      ...straightCells(14, true),
      ...curvedCells(right, -Math.PI / 2),
      ...straightCells(13, false),
      ...curvedCells(left, Math.PI / 2)
    ];
    const cells = paths.map((d, index) => {
      const cell = document.createElementNS(namespace, 'path');
      const number = numbers[index];
      const color = number === 0 ? 'green' : EURO_RED.has(number) ? 'red' : 'black';
      cell.setAttribute('d', d);
      cell.setAttribute('class', `roulette-track-cell is-${color}`);
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', `Ячейка ${index + 1} по часовой стрелке`);
      cell.dataset.number = number;
      board.appendChild(cell);
      return cell;
    });
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
    stop = () => {
      if (expected === null) return;
      expected = null;
      target.textContent = '—';
      clearMark();
      showMessage(message, '');
      setActive(false);
    };
    setActive(false);
  };

  Trainer.stopRouletteTrack = () => stop?.();
})();
