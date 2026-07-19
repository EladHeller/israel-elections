import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LIVE_RESULTS_REFRESH_INTERVAL_MS,
  shouldRefreshLiveResults,
} from './live-results';

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
});
