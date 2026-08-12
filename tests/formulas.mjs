import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(...rels) {
  const Trainer = {};
  const context = { window: { Trainer }, Trainer };
  vm.createContext(context);
  rels.forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context);
  });
  return context.Trainer;
}

const T = load('js/utils.js', 'js/formulas.js', 'js/payout-catalog.js', 'js/addition-bank.js', 'js/patterns.js');

assert.equal(T.blackjackPayout(5), 7.5);
assert.equal(T.blackjackPayout(10), 15);
assert.equal(T.blackjackPayout(100), 150);

assert.equal(T.computePokerPayout('bonus', 50, 10), 500);
assert.equal(T.computePokerPayout('texas', 55, 10), 660);
assert.equal(T.computePokerPayout('russian', 50, 20), 2000);

const streetPlay4 = T.computeUltimateParts(50, 1, 4);
assert.equal(streetPlay4.blind, 50);
assert.equal(streetPlay4.antePlay, 250);
assert.equal(streetPlay4.total, 300);
assert.equal(T.computePokerPayout('ultimate', 50, 1, 4), 300);

const pairPlay2 = T.computeUltimateParts(50, 0, 2);
assert.equal(pairPlay2.blind, 0);
assert.equal(pairPlay2.antePlay, 150);

assert.equal(T.cashPart(500, 5), 100);
assert.equal(T.colorLeftFromCash(240, 500, 5), 140);
assert.equal(T.colorLeftFromCash(780, 500, 2), 530);
assert.equal(T.colorLeftFromCash(595, 5500, 25), 375);
assert.equal(T.chipsCashFor(241, 50, 1), 191);
assert.equal(
  T.isValidChipsAnswer({ payout: 241, minChips: 50, maxChips: 50, color: 1 }, 50, 191),
  true
);
assert.equal(
  T.isValidChipsAnswer({ payout: 241, minChips: 50, maxChips: 50, color: 1 }, 40, 201),
  false
);

assert.equal(T.formatOdds({ mult: 35 }), '35 : 1');
assert.equal(T.formatOdds({ mult: 1.5 }), '3 : 2');
assert.equal(T.formatOdds({ mult: 0 }), 'Push');
assert.equal(T.formatOdds({ special: 'jackpot' }), 'Джекпот');
assert.equal(T.formatOdds({ special: 'jackpotPercent' }), 'Джекпот %');

const zeroSlots = T.winningSlotsForZero();
assert.equal(zeroSlots.length, 7);
assert.equal(T.payoutOf('straight'), 35);
assert.equal(T.payoutOf('split'), 17);
assert.equal(T.payoutOf('street'), 11);
assert.equal(T.payoutOf('trio'), 11);
assert.equal(T.payoutOf('corner'), 8);
assert.equal(T.payoutOf('sixline'), 5);
assert.equal(zeroSlots.reduce((sum, slot) => sum + T.payoutOf(slot.type), 0), 35 + 17 * 3 + 11 * 2 + 8);

const cell = T.winningSlotsForCell(1, 1, { withZero: true, includeZeroEdge: false });
assert.ok(cell.some((s) => s.type === 'straight'));
assert.ok(cell.some((s) => s.type === 'street'));

assert.ok(T.EURO_RED.has(1) && T.EURO_RED.has(36) && !T.EURO_RED.has(2));
assert.equal(T.EURO_ORDER.length, 37);
assert.equal(T.EURO_ORDER[0], 0);

const bank = T.additionBank;
assert.ok(Array.isArray(bank) && bank.length > 100);
const seen = new Set();
bank.forEach((item) => {
  assert.equal(item.a + item.b, item.answer, `${item.a}+${item.b}`);
  const key = `${item.a}+${item.b}`;
  assert.equal(seen.has(key), false, `duplicate ${key}`);
  seen.add(key);
});

assert.equal(T.escapeHtml('<x> & "y"'), '&lt;x&gt; &amp; &quot;y&quot;');
assert.equal(T.randInt(3, 3), 3);
assert.deepEqual(T.shuffle([1]).slice(), [1]);

console.log('Formula tests OK');
