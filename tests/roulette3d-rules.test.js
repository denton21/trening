const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = { window: { Trainer: {} } };
context.Trainer = context.window.Trainer;
vm.runInNewContext(fs.readFileSync('js/roulette3d-rules.js', 'utf8'), context);

const rules = context.window.Trainer.Roulette3DRules;
assert.ok(rules.runSelfTest(), 'built-in roulette rules self-test failed');

function bet(type, numbers, label, amount) {
  return { ...rules.makeBet(type, numbers, label), amount };
}

let result = rules.calculate([bet('straight', [17], '17', 5)], 17);
assert.deepStrictEqual(
  { netPayout: result.netPayout, returnedStake: result.returnedStake, totalReturn: result.totalReturn },
  { netPayout: 175, returnedStake: 5, totalReturn: 180 }
);

result = rules.calculate(
  [
    bet('straight', [17], '17', 5),
    bet('split', [16, 17], '16/17', 5),
    bet('red', [], 'red', 1),
    bet('black', [], 'black', 1)
  ],
  17
);
assert.strictEqual(result.netPayout, 261);
assert.strictEqual(result.returnedStake, 11);
assert.strictEqual(result.totalReturn, 272);

result = rules.calculate(
  [
    bet('red', [], 'red', 5),
    bet('split', [0, 1], '0/1', 5),
    bet('trio', [0, 1, 2], '0-1-2', 5),
    bet('corner', [0, 1, 2, 3], '0/1/2/3', 5),
    bet('low', [], '1-18', 5)
  ],
  0
);
assert.strictEqual(result.netPayout, 180);
assert.strictEqual(result.returnedStake, 15);
assert.strictEqual(result.totalReturn, 195);

console.log('roulette3d rules tests passed');
