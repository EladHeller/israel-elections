import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getElectionBlocs, parseBlocPreferences } from './bloc-preferences';
import { computeBlocMap, computeBlocTotals } from './analytics';

describe('election-specific bloc preferences', () => {
  it('does not reuse historical ballot-letter assignments for a different election', () => {
    const configurations = { '25': { blocks: { a: { label: 'A', color: 'blue', parties: ['ב'] } } } };
    assert.deepEqual(computeBlocMap(getElectionBlocs(configurations, '25')), { ב: 'a' });
    assert.deepEqual(computeBlocMap(getElectionBlocs(configurations, '26')), {});
    assert.deepEqual(computeBlocMap(getElectionBlocs(configurations, null)), {});
  });

  it('preserves explicit unassignment and separate preferences for each election', () => {
    const stored = parseBlocPreferences(JSON.stringify({
      '25': { assignments: { ב: 'gushA' }, labels: { gushA: '  ראשון  ' } },
      '26': { assignments: { ב: null, ג: 'gushB' }, labels: {} },
    }));
    assert.equal(stored['25'].assignments['ב'], 'gushA');
    assert.equal(stored['25'].labels.gushA, 'ראשון');
    assert.equal(stored['26'].assignments['ב'], null);
    const blocs = getElectionBlocs({}, '26');
    assert.deepEqual(computeBlocTotals({ ב: { votes: 100, mandats: 10 }, ג: { votes: 200, mandats: 20 } },
      blocs, stored['26'].assignments), { gushA: 0, gushB: 20 });
  });

  it('ignores invalid persisted data without breaking results', () => {
    for (const value of [null, 'broken', 'null', '[]', '42', '{"26":null}', '{"26":{"assignments":[],"labels":{}}}']) {
      assert.deepEqual(parseBlocPreferences(value), {});
    }
    assert.deepEqual(parseBlocPreferences('{"26":{"assignments":{"a":8,"b":null},"labels":{"gushA":42,"gushB":" "}}}'),
      { '26': { assignments: { b: null }, labels: {} } });
  });
});
