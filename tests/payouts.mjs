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

const T = load('js/formulas.js', 'js/payout-catalog.js');
const catalog = T.payoutCatalog;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.deepEqual(Array.from(catalog.threeCard.ante, (row) => row[1]), [1, 3, 4, 10]);
assert.deepEqual(Array.from(catalog.threeCard.pairPlus, (row) => row[1]), [1, 4, 5, 30, 40, 50]);
assert.deepEqual(Array.from(catalog.threeCard.plus3, (row) => row[1]), [5, 10, 15, 25, 50, 200, 1000]);
assert.equal(catalog.jp ? catalog.jp.at(-1)[1] : catalog.threeCard.jp.at(-1)[1], 'jackpotPercent');

const games = catalog.games;
const expectedIds = [
  'jackpot', 'sixcard', 'texas', 'aa', 'trips', 'ultimate', 'novo', 'russian',
  'tcp_ante', 'tcp_pair', 'tcp_plus3', 'tcp_jp', 'bj20', 'bj_jackpot'
];
assert.deepEqual(Object.keys(games), expectedIds);

Object.values(games).forEach((game) => {
  assert.equal(game.id, game.id);
  assert.ok(game.label && game.short && game.pay && game.stake);
  const rows = T.trainRows(game);
  assert.ok(rows.length > 0, `${game.id} has no training rows`);
  rows.forEach((row) => {
    assert.equal(typeof row.hand, 'string');
    assert.equal(typeof row.mult, 'number');
  });
});

const six = T.trainRows(games.sixcard);
assert.ok(six.some((row) => row.hand === 'Стрит · с раздачи' && row.mult === 25));
assert.ok(six.some((row) => row.hand === 'Стрит · с покупкой' && row.mult === 7));
assert.ok(!T.trainRows(games.jackpot).some((row) => row.hand === 'Роял-флеш'));
assert.ok(T.trainRows(games.ultimate).some((row) => row.hand === 'Пара' && row.mult === 0));

const tableKeys = [...html.matchAll(/data-payout-table="([^"]+)"/g)].map((m) => m[1]);
assert.ok(tableKeys.length >= 14, `expected payout tables in HTML, got ${tableKeys.length}`);
tableKeys.forEach((key) => {
  assert.ok(T.resolvePayoutTable(key), `missing catalog table ${key}`);
});

assert.equal(T.formatOdds(games.ultimate.refRows.find((r) => r.hand === 'Флеш')), '3 : 2');
assert.equal(T.formatOdds(games.ultimate.refRows.find((r) => r.hand === 'Меньше стрита')), 'Push');
assert.equal(T.computePokerPayout('texas', 55, games.texas.rows.find((r) => r.hand === 'Каре').mult), 660);

const niu = catalog.niu;
assert.equal(niu.rows.length, 13);
assert.equal(niu.rows[0].hand, '4 of a Kind');
assert.equal(niu.rows[0].super, 15);
assert.equal(niu.rows[1].double, 4);
assert.equal(niu.rows[2].double, 3);
assert.equal(niu.rows[3].double, 2);
assert.equal(niu.rows[6].double, 1);
assert.equal(niu.rows[6].super, 6);
assert.equal(niu.rows[11].hand, 'Niu 1');
assert.equal(niu.rows[12].hand, 'Нет комбинации');
assert.equal(niu.rows[12].bet, 1);
assert.equal(niu.rows[12].super, 1);
assert.ok(!games.niu, 'Niu Niu is reference-only');

console.log(`Payout catalog tests OK: ${expectedIds.length} games, ${tableKeys.length} reference tables`);
