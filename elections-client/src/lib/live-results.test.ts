import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LIVE_RESULTS_REFRESH_INTERVAL_MS,
  resultSnapshotsDiffer,
  shouldRefreshLiveResults,
  getResultChanges,
} from './live-results';
import type { ElectionResultsPayload } from '../types';

const snapshot = (): ElectionResultsPayload => ({
  time: '2026-07-19T12:00:00.000Z',
  voteData: { a: { votes: 100, mandats: 1 } },
  realResults: { a: { votes: 100, mandats: 1 } },
});

describe('latest update summary', () => {
  const result = (votes: number, seats: number, otherVotes = 900): ElectionResultsPayload => ({
    voteData: { a: { votes, mandats: seats }, b: { votes: otherVotes, mandats: 120 - seats } },
    realResults: { a: { votes, mandats: seats }, b: { votes: otherVotes, mandats: 120 - seats } },
  });

  it('reports mandate transfers in both directions', () => {
    assert.deepEqual(getResultChanges(result(100, 12), result(110, 13), 0.0325), [
      { party: 'a', seats: 13, delta: 1, threshold: null },
      { party: 'b', seats: 107, delta: -1, threshold: null },
    ]);
  });

  it('detects threshold crossings using the total of each snapshot', () => {
    const changes = getResultChanges(result(100, 12), result(100, 0, 3900), 0.0325);
    assert.equal(changes[0].party, 'a');
    assert.equal(changes[0].threshold, 'left');
    assert.equal(getResultChanges(result(100, 0, 3900), result(100, 12), 0.0325)[0].threshold, 'entered');
  });

  it('does not invent an event for a timestamp or vote-only update', () => {
    assert.deepEqual(getResultChanges(result(100, 12), { ...result(101, 12), time: '2026-10-11T12:00:00Z' }, 0.0325), []);
  });

  it('handles disappearing parties and zero-vote snapshots', () => {
    const empty = { voteData: {}, realResults: {} };
    assert.deepEqual(getResultChanges(empty, empty, 0.0325), []);
    assert.equal(getResultChanges(result(100, 12), empty, 0.0325)[0].threshold, 'left');
    assert.equal(getResultChanges(empty, result(100, 12), 0)[0].threshold, null);
  });
});

describe('live result refresh', () => {
  it('refreshes counting results while the page is visible', () => {
    assert.equal(shouldRefreshLiveResults('counting', 'visible'), true);
    assert.equal(shouldRefreshLiveResults('counting', 'hidden'), false);
  });

  it('does not poll outside the counting phase', () => {
    assert.equal(shouldRefreshLiveResults('voting', 'visible'), false);
    assert.equal(shouldRefreshLiveResults('final', 'visible'), false);
  });

  it('uses a conservative refresh interval', () => {
    assert.equal(LIVE_RESULTS_REFRESH_INTERVAL_MS, 30_000);
  });

  it('detects a new result snapshot', () => {
    assert.equal(resultSnapshotsDiffer(snapshot(), snapshot()), false);

    const withNewTime = snapshot();
    withNewTime.time = '2026-07-19T12:01:00.000Z';
    assert.equal(resultSnapshotsDiffer(snapshot(), withNewTime), true);

    const withNewVotes = snapshot();
    withNewVotes.voteData.a.votes = 101;
    assert.equal(resultSnapshotsDiffer(snapshot(), withNewVotes), true);

    const withNewSeats = snapshot();
    withNewSeats.realResults.a.mandats = 2;
    assert.equal(resultSnapshotsDiffer(snapshot(), withNewSeats), true);
    assert.equal(resultSnapshotsDiffer(snapshot(), { ...snapshot(), countedVotes: 110 }), true);
    assert.equal(resultSnapshotsDiffer({ ...snapshot(), countedVotes: 110 }, { ...snapshot(), countedVotes: 110 }), false);
  });
});
