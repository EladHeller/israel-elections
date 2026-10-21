import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeBlocOverview } from './bloc-overview';
import { computeBlocMap, computeBlocTotals } from './analytics';
import configs from '../data/blocs.json';
import { getElectionBlocs } from './bloc-preferences';

describe('complementary bloc overview', () => {
  const blocs = configs['26'];

  it('shows the Arab parties once, supplementing the center-left without absorbing their seats', () => {
    const rows = computeBlocOverview(blocs, { gushA: 59, gushB: 50, gushC: 11 });
    assert.deepEqual(rows.map((row) => row.key), ['gushA', 'gushB']);
    assert.equal(rows[0].combinedSeats, 59);
    assert.equal(rows[1].ownSeats, 50);
    assert.equal(rows[1].combinedSeats, 61);
    assert.deepEqual(rows[1].complementaryKeys, ['gushC']);
    assert.equal(rows[1].majorityText, 'יש רוב חוסם לגוש השמאל־מרכז בהסתמכות על המפלגות הערביות');
  });

  it('gives an independent majority precedence and never calls 60 a majority', () => {
    assert.equal(computeBlocOverview(blocs, { gushB: 61, gushC: 10 })[1].majorityText,
      'יש רוב לגוש השמאל־מרכז');
    assert.equal(computeBlocOverview(blocs, { gushB: 50, gushC: 10 })[1].majorityText,
      'עוד 1 לרוב חוסם');
    assert.equal(computeBlocOverview(blocs, { gushA: 61 })[0].majorityText, 'יש רוב לגוש הימין');
  });

  it('respects moving and unassigning parties rather than counting their original affiliation', () => {
    const results = { רק: { votes: 100, mandats: 50 }, עם: { votes: 30, mandats: 11 } };
    const assignments = computeBlocMap(blocs);
    const moved = computeBlocOverview(blocs, computeBlocTotals(results, blocs, { ...assignments, עם: 'gushB' }))[1];
    assert.equal(moved.ownSeats, 61);
    assert.equal(moved.combinedSeats, 61);
    assert.equal(moved.majorityText, 'יש רוב לגוש השמאל־מרכז');
    const unassigned = computeBlocOverview(blocs, computeBlocTotals(results, blocs, { ...assignments, עם: null }))[1];
    assert.equal(unassigned.combinedSeats, 50);
    assert.equal(unassigned.majorityText, 'עוד 11 לרוב חוסם');
  });

  it('keeps unconfigured elections independent and uses custom labels in majority messages', () => {
    const historical = computeBlocOverview(getElectionBlocs(configs, '20'), {});
    assert.equal(historical.length, 2);
    assert.ok(historical.every((row) => row.complementaryKeys.length === 0));
    const renamed = { ...blocs, blocks: { ...blocs.blocks, gushB: { ...blocs.blocks.gushB, label: 'מחנה א' } } };
    assert.equal(computeBlocOverview(renamed, { gushB: 60, gushC: 1 })[1].majorityText,
      'יש רוב חוסם למחנה א בהסתמכות על המפלגות הערביות');
  });
});
