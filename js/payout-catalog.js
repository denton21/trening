window.Trainer = window.Trainer || {};

(function () {
  const threeCard = {
    ante: [
      ['Стрит', 1], ['Три одинаковых', 3], ['Стрит-флеш', 4], ['Мини-рояль', 10]
    ],
    pairPlus: [
      ['Пара', 1], ['Флеш', 4], ['Стрит', 5], ['Три одинаковых', 30], ['Стрит-флеш', 40], ['Мини-рояль', 50]
    ],
    /** 3+3: лучшая 5-карточная из 3 карт игрока + 3 дилера */
    plus3: [
      ['Три одинаковых', 5],
      ['Стрит', 10],
      ['Флеш', 15],
      ['Фул-хаус', 25],
      ['Каре', 50],
      ['Стрит-флеш', 200],
      ['Роял-флеш', 1000]
    ],
    jp: [
      ['Флеш', 2],
      ['Стрит', 10],
      ['Три одинаковых', 25],
      ['Стрит-флеш', 50],
      ['Стрит-флеш ♠', 100],
      ['Мини-рояль', 250],
      ['Мини-рояль ♠', 'jackpotPercent']
    ]
  };

  function tuplesToRows(tuples) {
    return (tuples || []).map(([hand, mult], index, list) => {
      if (mult === 'jackpotPercent') {
        return { hand, special: 'jackpotPercent' };
      }
      if (mult === 'jackpot') {
        return { hand, special: 'jackpot' };
      }
      return { hand, mult, top: index === list.length - 1 && typeof mult === 'number' && mult >= 10 };
    });
  }

  function trainRows(game) {
    const out = [];
    (game?.rows || []).forEach((row) => {
      if (row.deal != null && row.buy != null) {
        out.push({ hand: `${row.hand} · с раздачи`, mult: row.deal });
        out.push({ hand: `${row.hand} · с покупкой`, mult: row.buy });
        return;
      }
      if (typeof row.mult === 'number') {
        out.push({ hand: row.trainHand || row.hand, mult: row.mult });
      }
    });
    return out;
  }

  const roulette = {
    rows: [
      { hand: 'Straight up', numbers: '1', mult: 35 },
      { hand: 'Split', numbers: '2', mult: 17 },
      { hand: 'Street / Trio', numbers: '3', mult: 11 },
      { hand: 'Corner / First four', numbers: '4', mult: 8 },
      { hand: 'Six-line', numbers: '6', mult: 5 },
      { hand: 'Dozen / Column', numbers: '12', mult: 2 },
      { hand: 'Even chances', numbers: '18', mult: 1 }
    ]
  };

  /** Niu Niu: Bet / Double / SuperDouble. Только справка, не тренировка. */
  const niu = {
    columns: [
      { key: 'bet', merge: true },
      { key: 'double', merge: true },
      { key: 'super' }
    ],
    rows: [
      { hand: '4 of a Kind', bet: 1, double: 5, super: 15, top: true },
      { hand: '5 Pictures', bet: 1, double: 4, super: 12 },
      { hand: 'Niu 10', bet: 1, double: 3, super: 10 },
      { hand: 'Niu 9', bet: 1, double: 2, super: 9 },
      { hand: 'Niu 8', bet: 1, double: 2, super: 8 },
      { hand: 'Niu 7', bet: 1, double: 2, super: 7 },
      { hand: 'Niu 6', bet: 1, double: 1, super: 6 },
      { hand: 'Niu 5', bet: 1, double: 1, super: 5 },
      { hand: 'Niu 4', bet: 1, double: 1, super: 4 },
      { hand: 'Niu 3', bet: 1, double: 1, super: 3 },
      { hand: 'Niu 2', bet: 1, double: 1, super: 2 },
      { hand: 'Niu 1', bet: 1, double: 1, super: 1 },
      { hand: 'Нет комбинации', bet: 1, double: 1, super: 1 }
    ]
  };

  function countSpan(rows, index, key) {
    const value = rows[index][key];
    if (index > 0 && rows[index - 1][key] === value) {
      return 0;
    }
    let n = 1;
    while (index + n < rows.length && rows[index + n][key] === value) {
      n += 1;
    }
    return n;
  }

  const games = {
    jackpot: {
      id: 'jackpot',
      label: 'Джекпот-бонус',
      short: 'Джекпот',
      stake: 'jackpot',
      pay: 'bonus',
      rows: [
        { hand: 'Две пары', mult: 2 },
        { hand: 'Тройка', mult: 10 },
        { hand: 'Стрит', mult: 25 },
        { hand: 'Флеш', mult: 50 },
        { hand: 'Фул-хаус', mult: 100 },
        { hand: 'Каре', mult: 250 },
        { hand: 'Стрит-флеш', special: 'jackpot' },
        { hand: 'Роял-флеш', special: 'jackpot' }
      ]
    },
    sixcard: {
      id: 'sixcard',
      label: 'Шестикарточный',
      short: '6-карт',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Стрит', deal: 25, buy: 7 },
        { hand: 'Флеш', deal: 50, buy: 15 },
        { hand: 'Фул-хаус', deal: 100, buy: 30 },
        { hand: 'Каре', deal: 300, buy: 100 },
        { hand: 'Стрит-флеш', deal: 500, buy: 150 },
        { hand: 'Роял-флеш', deal: 1000, buy: 300, top: true }
      ]
    },
    texas: {
      id: 'texas',
      label: 'Техасский холдем',
      short: 'Техас',
      stake: 'std',
      pay: 'texas',
      rows: [
        { hand: 'Пара', mult: 1 },
        { hand: 'Две пары', mult: 1 },
        { hand: 'Тройка', mult: 1 },
        { hand: 'Стрит', mult: 1 },
        { hand: 'Флеш', mult: 2 },
        { hand: 'Фул-хаус', mult: 3 },
        { hand: 'Каре', mult: 10 },
        { hand: 'Стрит-флеш', mult: 20 },
        { hand: 'Роял-флеш', mult: 100, top: true }
      ]
    },
    aa: {
      id: 'aa',
      label: 'Бонус AA',
      short: 'AA',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Пара тузов', mult: 7 },
        { hand: 'Две пары', mult: 7 },
        { hand: 'Тройка', mult: 7 },
        { hand: 'Стрит', mult: 7 },
        { hand: 'Флеш', mult: 20 },
        { hand: 'Фул-хаус', mult: 30 },
        { hand: 'Каре', mult: 40 },
        { hand: 'Стрит-флеш', mult: 50 },
        { hand: 'Роял-флеш', mult: 100, top: true }
      ]
    },
    trips: {
      id: 'trips',
      label: 'Бонус Trips',
      short: 'Trips',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Тройка', mult: 3 },
        { hand: 'Стрит', mult: 4 },
        { hand: 'Флеш', mult: 7 },
        { hand: 'Фул-хаус', mult: 8 },
        { hand: 'Каре', mult: 30 },
        { hand: 'Стрит-флеш', mult: 40 },
        { hand: 'Роял-флеш', mult: 50, top: true }
      ]
    },
    ultimate: {
      id: 'ultimate',
      label: 'Ультимейт',
      short: 'Ультимейт',
      stake: 'std',
      pay: 'ultimate',
      playMults: [1, 2, 4],
      rows: [
        { hand: 'Пара', mult: 0 },
        { hand: 'Две пары', mult: 0 },
        { hand: 'Тройка', mult: 0 },
        { hand: 'Стрит', mult: 1 },
        { hand: 'Флеш', mult: 1.5 },
        { hand: 'Фул-хаус', mult: 3 },
        { hand: 'Каре', mult: 10 },
        { hand: 'Стрит-флеш', mult: 50 },
        { hand: 'Роял-флеш', mult: 500, top: true }
      ],
      refRows: [
        { hand: 'Роял-флеш', mult: 500, top: true },
        { hand: 'Стрит-флеш', mult: 50 },
        { hand: 'Каре', mult: 10 },
        { hand: 'Фул-хаус', mult: 3 },
        { hand: 'Флеш', mult: 1.5 },
        { hand: 'Стрит', mult: 1 },
        { hand: 'Меньше стрита', special: 'push' }
      ]
    },
    novo: {
      id: 'novo',
      label: 'Novo Poker',
      short: 'Novo',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Карты одного цвета', mult: 2 },
        { hand: 'Туз · король · дама', mult: 5 },
        { hand: 'Тройка', mult: 8 },
        { hand: 'Стрит', mult: 30 },
        { hand: 'Флеш', mult: 60 },
        { hand: 'Фул-хаус', mult: 100 },
        { hand: 'Пять картинок', mult: 120 },
        { hand: 'Каре', mult: 200, top: true }
      ]
    },
    russian: {
      id: 'russian',
      label: 'Русский покер',
      short: 'Рус. покер',
      stake: 'std',
      pay: 'russian',
      rows: [
        { hand: 'Тройка', mult: 3 },
        { hand: 'Стрит', mult: 4 },
        { hand: 'Флеш', mult: 5 },
        { hand: 'Фул-хаус', mult: 7 },
        { hand: 'Каре', mult: 20 },
        { hand: 'Стрит-флеш', mult: 50 },
        { hand: 'Роял-флеш', mult: 100, top: true }
      ],
      refRows: [
        { hand: 'Роял-флеш', mult: 100, top: true },
        { hand: 'Стрит-флеш', mult: 50 },
        { hand: 'Каре', mult: 20 },
        { hand: 'Фул-хаус', mult: 7 },
        { hand: 'Флеш', mult: 5 },
        { hand: 'Стрит', mult: 4 },
        { hand: 'Тройка', mult: 3 }
      ]
    },
    tcp_ante: {
      id: 'tcp_ante',
      label: '3-карт · Ante Bonus',
      short: '3к Ante',
      stake: 'std',
      pay: 'bonus',
      rows: tuplesToRows(threeCard.ante)
    },
    tcp_pair: {
      id: 'tcp_pair',
      label: '3-карт · Пара Плюс',
      short: '3к Pair+',
      stake: 'std',
      pay: 'bonus',
      rows: tuplesToRows(threeCard.pairPlus)
    },
    tcp_plus3: {
      id: 'tcp_plus3',
      label: '3-карт · 3+3',
      short: '3к 3+3',
      stake: 'std',
      pay: 'bonus',
      rows: tuplesToRows(threeCard.plus3)
    },
    tcp_jp: {
      id: 'tcp_jp',
      label: '3-карт · JP Bonus',
      short: '3к JP',
      stake: 'jackpot',
      pay: 'bonus',
      rows: tuplesToRows(threeCard.jp)
    },
    bj20: {
      id: 'bj20',
      label: 'BJ · бонус 20',
      short: 'BJ 20',
      stake: 'std',
      pay: 'bonus',
      rows: [
        { hand: 'Любые 20', mult: 5 },
        { hand: 'Одномастные 20', mult: 10 },
        { hand: 'Одинаковые 20', mult: 30 },
        { hand: 'Два крестовых короля (♣K + ♣K)', trainHand: 'Два крестовых короля', mult: 100, top: true }
      ]
    },
    bj_jackpot: {
      id: 'bj_jackpot',
      label: 'BJ · джекпот',
      short: 'BJ JP',
      stake: 'jackpot',
      pay: 'bonus',
      rows: [
        { hand: 'Блекджек', mult: 2 },
        { hand: 'Одномастный блекджек', mult: 10 },
        { hand: 'Дама + король одномастные', mult: 25 },
        { hand: 'Две семёрки', mult: 50 },
        { hand: 'Две одномастные семёрки', mult: 100 },
        { hand: 'Три семёрки', mult: 250 },
        { hand: 'Три одномастные семёрки', special: 'jackpot' }
      ]
    }
  };

  function resolveTable(key) {
    if (!key) {
      return null;
    }
    if (key === 'roulette') {
      return roulette;
    }
    if (key === 'niu') {
      return niu;
    }
    if (key.startsWith('threeCard.')) {
      const name = key.slice('threeCard.'.length);
      const tuples = threeCard[name];
      return tuples ? { rows: tuplesToRows(tuples) } : null;
    }
    return games[key] || null;
  }

  function fillPayoutTable(tbody, key, layout) {
    const source = resolveTable(key);
    if (!tbody || !source) {
      return false;
    }
    const formatOdds = Trainer.formatOdds || ((row) => String(row.mult ?? '—'));
    const rows = source.refRows || source.rows;
    tbody.replaceChildren();
    rows.forEach((row, index) => {
      const tr = document.createElement('tr');
      if (row.special === 'jackpot' || row.special === 'jackpotPercent') {
        tr.classList.add('is-jackpot');
      }
      if (row.top) {
        tr.classList.add('is-top');
      }
      const hand = document.createElement('td');
      hand.className = 'hand';
      hand.textContent = row.hand;
      tr.appendChild(hand);

      if (layout === 'roulette') {
        const nums = document.createElement('td');
        nums.textContent = String(row.numbers ?? '');
        tr.appendChild(nums);
      }

      if (layout === 'deal-buy') {
        const deal = document.createElement('td');
        deal.className = 'odds';
        deal.textContent = formatOdds({ mult: row.deal });
        const buy = document.createElement('td');
        buy.className = 'odds';
        buy.textContent = formatOdds({ mult: row.buy });
        tr.append(deal, buy);
      } else if (layout === 'cols' && source.columns) {
        source.columns.forEach((col) => {
          if (col.merge) {
            const span = countSpan(rows, index, col.key);
            if (!span) {
              return;
            }
            const td = document.createElement('td');
            td.className = 'odds';
            if (span > 1) {
              td.rowSpan = span;
            }
            td.textContent = formatOdds({ mult: row[col.key] });
            tr.appendChild(td);
            return;
          }
          const td = document.createElement('td');
          td.className = 'odds';
          td.textContent = formatOdds({ mult: row[col.key] });
          tr.appendChild(td);
        });
      } else {
        const odds = document.createElement('td');
        odds.className = 'odds';
        odds.textContent = formatOdds(row);
        tr.appendChild(odds);
      }
      tbody.appendChild(tr);
    });
    return true;
  }

  function fillPayoutTables(root = document) {
    root.querySelectorAll('[data-payout-table]').forEach((tbody) => {
      fillPayoutTable(tbody, tbody.getAttribute('data-payout-table'), tbody.getAttribute('data-payout-layout'));
    });
  }

  Trainer.payoutCatalog = {
    threeCard,
    roulette,
    niu,
    games
  };
  Trainer.trainRows = trainRows;
  Trainer.resolvePayoutTable = resolveTable;
  Trainer.fillPayoutTable = fillPayoutTable;
  Trainer.fillPayoutTables = fillPayoutTables;
})();
