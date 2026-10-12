import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canPreviewElectionDemo, electionDemo, electionDemoConfig } from './election-demo';
import { computeBlocTotals } from './analytics';
import { getResultChanges } from './live-results';
import blocs from '../data/blocs.json';
import manifests from '../data/elections-manifests.json';

describe('election-night demo', () => {
  it('is available only for the current election before real results exist', () => {
    assert.equal(canPreviewElectionDemo('26', 'listsFinal', true), true);
    assert.equal(canPreviewElectionDemo('26', 'voting', true), true);
    for (const phase of ['counting', 'final'] as const) {
      assert.equal(canPreviewElectionDemo('26', phase, true), false);
    }
    assert.equal(canPreviewElectionDemo('25', 'final', false), false);
    assert.equal(canPreviewElectionDemo('26', 'listsFinal', false), false);
    assert.equal(canPreviewElectionDemo('27', 'listsFinal', true), false);
    assert.equal(canPreviewElectionDemo(null, undefined, false), false);
  });

  it('has consistent synthetic snapshots with 120 seats and only registered lists', () => {
    for (const result of [electionDemo.current, electionDemo.previous]) {
      assert.equal(Object.values(result.realResults).reduce((sum, party) => sum + party.mandats, 0), 120);
      assert.deepEqual(Object.keys(result.voteData).sort(), manifests['26'].lists.map(list => list.ballotLetter).sort());
      assert.ok(!('time' in result));
    }
    const votes = Object.values(electionDemo.current.voteData).reduce((sum, party) => sum + party.votes, 0);
    assert.equal(electionDemoConfig.totalVotes! - votes, 23000);
    const changes = getResultChanges(electionDemo.previous, electionDemo.current, electionDemoConfig.blockPercentage);
    assert.ok(changes.some(change => change.delta !== 0));
    const totals = computeBlocTotals(electionDemo.current.realResults, blocs['26']);
    assert.ok(totals.gushB < 61 && totals.gushB + totals.gushC >= 61);
  });
});
