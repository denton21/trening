window.Trainer = window.Trainer || {};

(function () {
  const EURO_NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

  const ODDS = Object.freeze({
    straight: 35,
    split: 17,
    street: 11,
    trio: 11,
    corner: 8,
    sixline: 5,
    dozen: 2,
    column: 2,
    red: 1,
    black: 1,
    even: 1,
    odd: 1,
    low: 1,
    high: 1
  });

  function sortNumbers(numbers) {
    return numbers.slice().sort((a, b) => a - b);
  }

  function makeBet(type, numbers, label) {
    const sorted = sortNumbers(numbers);
    return {
      key: `${type}:${sorted.join('-')}`,
      type,
      numbers: sorted,
      label,
      odds: ODDS[type]
    };
  }

  function colorOf(number) {
    if (number === 0) return 'green';
    return RED.has(number) ? 'red' : 'black';
  }

  function outsideWins(type, number) {
    if (number === 0) return false;
    if (type === 'red') return RED.has(number);
    if (type === 'black') return !RED.has(number);
    if (type === 'even') return number % 2 === 0;
    if (type === 'odd') return number % 2 === 1;
    if (type === 'low') return number >= 1 && number <= 18;
    if (type === 'high') return number >= 19 && number <= 36;
    return false;
  }

  function wins(bet, result) {
    if (!Number.isInteger(result) || result < 0 || result > 36) return false;
    if (['red', 'black', 'even', 'odd', 'low', 'high'].includes(bet.type)) {
      return outsideWins(bet.type, result);
    }
    return bet.numbers.includes(result);
  }

  function calculate(bets, result) {
    const entries = [];
    let totalStake = 0;
    let netPayout = 0;
    let returnedStake = 0;

    bets.forEach((bet) => {
      const amount = Number(bet.amount) || 0;
      if (amount <= 0) return;
      totalStake += amount;
      const isWin = wins(bet, result);
      const profit = isWin ? amount * bet.odds : 0;
      const returned = isWin ? amount : 0;
      netPayout += profit;
      returnedStake += returned;
      entries.push({ ...bet, amount, isWin, profit, returned });
    });

    return {
      result,
      entries,
      totalStake,
      netPayout,
      returnedStake,
      totalReturn: netPayout + returnedStake,
      winningCount: entries.filter((entry) => entry.isWin).length
    };
  }

  function runSelfTest() {
    const tests = [
      { bet: makeBet('straight', [17], '17'), result: 17, amount: 5, expected: 175 },
      { bet: makeBet('split', [16, 17], '16/17'), result: 17, amount: 5, expected: 85 },
      { bet: makeBet('street', [16, 17, 18], '16-17-18'), result: 17, amount: 5, expected: 55 },
      { bet: makeBet('corner', [16, 17, 19, 20], '16/17/19/20'), result: 17, amount: 5, expected: 40 },
      { bet: makeBet('sixline', [16, 17, 18, 19, 20, 21], '16-21'), result: 17, amount: 5, expected: 25 },
      { bet: makeBet('dozen', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], '1st 12'), result: 7, amount: 5, expected: 10 },
      { bet: makeBet('red', [], 'Red'), result: 18, amount: 5, expected: 5 },
      { bet: makeBet('red', [], 'Red'), result: 0, amount: 5, expected: 0 },
      { bet: makeBet('split', [0, 1], '0/1'), result: 0, amount: 5, expected: 85 },
      { bet: makeBet('trio', [0, 1, 2], '0-1-2'), result: 2, amount: 5, expected: 55 },
      { bet: makeBet('corner', [0, 1, 2, 3], '0/1/2/3'), result: 3, amount: 5, expected: 40 }
    ];

    return tests.every((test) => calculate([{ ...test.bet, amount: test.amount }], test.result).netPayout === test.expected);
  }

  Trainer.Roulette3DRules = Object.freeze({
    EURO_NUMBERS,
    RED,
    ODDS,
    colorOf,
    makeBet,
    wins,
    calculate,
    runSelfTest
  });
})();
