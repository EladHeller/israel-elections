import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LIVE_RESULTS_REFRESH_INTERVAL_MS,
  resultSnapshotsDiffer,
  shouldRefreshLiveResults,
} from './live-results';
import type { ElectionResultsPayload } from '../types';

const snapshot = (): ElectionResultsPayload => ({
  time: '2026-07-19T12:00:00.000Z',
  voteData: { a: { votes: 100, mandats: 1 } },
  realResults: { a: { votes: 100, mandats: 1 } },
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
  });
});
