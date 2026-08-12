window.Trainer = window.Trainer || {};

(function () {
  function roundPay(n) {
    return Math.round(n * 1000) / 1000;
  }

  function formatMoney(n) {
    if (Number.isInteger(n)) {
      return String(n);
    }
    return String(Math.round(n * 100) / 100)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*[1-9])0+$/, '$1');
  }

  function blackjackPayout(bet) {
    return roundPay(Number(bet) * 1.5);
  }

  /**
   * Ultimate: Blind = Ante×mult (0 = push ниже стрита);
   * Ante+Play 1:1 = Ante + Play, Play = playMult×Ante.
   */
  function computeUltimateParts(stake, mult, playMult) {
    const k = playMult || 1;
    const blind = roundPay(stake * mult);
    const antePlay = roundPay(stake + stake * k);
    return {
      blind,
      antePlay,
      total: roundPay(blind + antePlay)
    };
  }

  /**
   * pay:
   *  - bonus    — только ставка × коэф
   *  - texas    — анте по коэф + бет 1:1 (бет = 2×анте)
   *  - russian  — бет = 2×ante; выплата = бет × коэф
   *  - ultimate — Ante 1:1 + Play 1:1 + Blind×коэф
   */
  function computePokerPayout(pay, stake, mult, playMult) {
    if (pay === 'russian') {
      return roundPay(stake * 2 * mult);
    }
    if (pay === 'texas') {
      return roundPay(stake * mult + stake * 2);
    }
    if (pay === 'ultimate') {
      return computeUltimateParts(stake, mult, playMult).total;
    }
    return roundPay(stake * mult);
  }

  function cashPart(through, color) {
    return through / color;
  }

  function colorLeftFromCash(payout, through, color) {
    return payout - cashPart(through, color);
  }

  function chipsCashFor(payout, chips, color) {
    return (payout - chips) * color;
  }

  function isValidChipsAnswer(question, chips, cash) {
    if (!Number.isInteger(chips) || !Number.isInteger(cash)) {
      return false;
    }
    if (chips <= 0 || chips >= question.payout) {
      return false;
    }
    if (chips < question.minChips || chips > question.maxChips) {
      return false;
    }
    if (cash < 0) {
      return false;
    }
    return cash === chipsCashFor(question.payout, chips, question.color);
  }

  function formatOdds(row) {
    if (!row) {
      return '—';
    }
    if (row.special === 'jackpot') {
      return 'Джекпот';
    }
    if (row.special === 'jackpotPercent') {
      return 'Джекпот %';
    }
    if (row.special === 'push' || row.mult === 0) {
      return 'Push';
    }
    if (row.mult === 1.5) {
      return '3 : 2';
    }
    if (typeof row.mult === 'number') {
      return `${row.mult} : 1`;
    }
    return String(row.odds || '—');
  }

  Trainer.roundPay = roundPay;
  Trainer.formatMoney = formatMoney;
  Trainer.blackjackPayout = blackjackPayout;
  Trainer.computeUltimateParts = computeUltimateParts;
  Trainer.computePokerPayout = computePokerPayout;
  Trainer.cashPart = cashPart;
  Trainer.colorLeftFromCash = colorLeftFromCash;
  Trainer.chipsCashFor = chipsCashFor;
  Trainer.isValidChipsAnswer = isValidChipsAnswer;
  Trainer.formatOdds = formatOdds;
})();
