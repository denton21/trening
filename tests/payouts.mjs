import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/payout-catalog.js', import.meta.url), 'utf8');
const context = { window: {}, Trainer: {} };
vm.createContext(context);
vm.runInContext(source, context);
const catalog = context.Trainer.payoutCatalog.threeCard;
assert.deepEqual(Array.from(catalog.ante, (row) => row[1]), [1, 3, 4, 10]);
assert.deepEqual(Array.from(catalog.pairPlus, (row) => row[1]), [1, 4, 5, 30, 40, 50]);
assert.deepEqual(Array.from(catalog.plus3, (row) => row[1]), [5, 10, 15, 25, 50, 200, 1000]);
assert.equal(catalog.jp.at(-1)[1], 'jackpotPercent');
console.log('Payout catalog tests OK');
