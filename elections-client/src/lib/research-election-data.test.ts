import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { useElectionData, type UseElectionDataResult } from '../hooks/use-election-data';

const tick = () => new Promise(resolve => setImmediate(resolve));
test('election hook supports metadata-only research and retains the last official snapshot on refresh failures', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let refresh = () => {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: (callback: () => void) => { refresh = callback; return 1; }, clearInterval: () => {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} } });
  let calls = 0;
  let fail = false;
  let votes = 100;
  let value!: UseElectionDataResult;
  const current = () => value;
  globalThis.fetch = async url => {
    calls++;
    if (fail) throw new Error('offline');
    return new Response(JSON.stringify(String(url).includes('election-config') ? {} : { voteData: { מחל: { votes, mandats: 120 } }, realResults: { מחל: { votes, mandats: 120 } }, countedVotes: votes }));
  };
  function Probe({ election, load = false }: { election?: string; load?: boolean }) {
    value = useElectionData(election, load);
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  const mount = async (election: string | undefined, load = false) => {
    await act(async () => { renderer = create(React.createElement(Probe, { election, load })); await tick(); });
  };
  try {
    await mount('26');
    assert.equal(current().currentElection, '26');
    assert.equal(current().results, null);
    assert.equal(calls, 0, 'research must not download the nationwide results');
    await act(async () => renderer.unmount());
    await mount('26', true);
    assert.equal(current().results?.voteData['מחל'].votes, 100);
    votes = 110;
    await act(async () => { refresh(); await tick(); });
    assert.equal(current().results?.voteData['מחל'].votes, 110);
    assert.equal(current().previousResults?.voteData['מחל'].votes, 100);
    fail = true;
    await act(async () => { refresh(); await tick(); });
    assert.ok(current().refreshError);
    assert.equal(current().results?.voteData['מחל'].votes, 110);
    await act(async () => renderer.unmount());
    await mount('25', true);
    assert.equal(current().error, 'offline');
    await act(async () => renderer.unmount());
    fail = false;
    await mount('14', true);
    assert.ok(current().results);
    await act(async () => renderer.unmount());
    await mount(undefined);
    assert.ok(current().currentElection);
    await act(async () => renderer.unmount());
    await mount('missing');
    assert.equal(current().currentElection, null);
  } finally {
    await act(async () => renderer?.unmount());
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  }
});
