import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import React from 'react';
import { create, act } from 'react-test-renderer';
import configs from '../data/elections-config.json';
import manifests from '../data/elections-manifests.json';
import names from '../data/party-names.json';
import type { ElectionManifest } from '../types';
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
    return new Response(JSON.stringify(String(url).includes('election-config') ? { '26': { totalVotes: 1000 } } : { voteData: { מחל: { votes, mandats: 120 } }, realResults: { מחל: { votes, mandats: 120 } }, countedVotes: votes }));
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
    assert.equal(current().countingTotalVotes, 1000);
    const same = current().results;
    await act(async () => { refresh(); await tick(); });
    assert.equal(current().results, same);
    globalThis.fetch = async url => new Response(JSON.stringify(String(url).includes('election-config') ? {} : { voteData: { מחל: { votes, mandats: 120 } }, realResults: { מחל: { votes, mandats: 120 } }, countedVotes: votes }));
    await act(async () => { refresh(); await tick(); });
    assert.match(current().refreshError ?? '', /אומדן המצביעים/);
    globalThis.fetch = async url => { calls++; if (fail) throw new Error('offline'); return new Response(JSON.stringify(String(url).includes('election-config') ? { '26': { totalVotes: 1000 } } : { voteData: { מחל: { votes, mandats: 120 } }, realResults: { מחל: { votes, mandats: 120 } }, countedVotes: votes })); };
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

test('election metadata falls back safely when optional historical configuration and names are absent', async () => {
  const config = configs as Record<string, unknown>;
  const manifest = manifests as Record<string, ElectionManifest>;
  const partyNames = names as Record<string, unknown>;
  const original = { config: config['25'], manifest: manifest['25'], names: partyNames['25'], phase: manifest['26'].phase };
  let result!: UseElectionDataResult;
  const fetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ voteData: {}, realResults: {} })); };
  function Probe({ election }: { election: string }) { result = useElectionData(election); return null; }
  let renderer!: ReturnType<typeof create>;
  try {
    delete config['25']; delete manifest['25']; delete partyNames['25'];
    await act(async () => { renderer = create(React.createElement(Probe, { election: '25' })); await tick(); });
    assert.equal(result.electionConfig.blockPercentage, 0.0325);
    assert.deepEqual(result.partyNames, {});
    assert.equal(result.electionManifest?.phase, 'final');
    await act(async () => renderer.unmount());
    manifest['26'].phase = 'listsFinal'; calls = 0;
    await act(async () => { renderer = create(React.createElement(Probe, { election: '26' })); await tick(); });
    assert.equal(result.results, null); assert.equal(calls, 0);
  } finally {
    await act(async () => renderer?.unmount()); globalThis.fetch = fetch;
    config['25'] = original.config; manifest['25'] = original.manifest; partyNames['25'] = original.names; manifest['26'].phase = original.phase;
  }
});

test('official data refresh ignores hidden tabs, overlapping requests and requests completed after unmount', async () => {
  const fetch = globalThis.fetch;
  const window = globalThis.window;
  const document = globalThis.document;
  const dom = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  let refresh = () => {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: (callback: () => void) => { refresh = callback; return 1; }, clearInterval() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom });
  let renderer!: ReturnType<typeof create>;
  let result!: UseElectionDataResult;
  function Probe() { result = useElectionData('26'); return null; }
  try {
    for (const fail of [false, true]) {
      let pending = false;
      let calls = 0;
      let done!: (value: Response) => void;
      let reject!: (error: Error) => void;
      globalThis.fetch = async url => {
        if (String(url).includes('election-config')) return new Response(JSON.stringify({ '26': { totalVotes: 1000 } }));
        calls++;
        if (pending) return new Promise<Response>((resolve, fail) => { done = resolve; reject = fail; });
        return new Response(JSON.stringify({ voteData: {}, realResults: {} }));
      };
      await act(async () => { renderer = create(React.createElement(Probe)); await tick(); });
      assert.equal(result.countingTotalVotes, 1000);
      dom.visibilityState = 'hidden';
      await act(async () => { refresh(); await tick(); }); assert.equal(calls, 1);
      dom.visibilityState = 'visible'; pending = true;
      await act(async () => { refresh(); await tick(); refresh(); }); assert.equal(calls, 2);
      await act(async () => renderer.unmount());
      await act(async () => { if (fail) reject(new Error('offline')); else done(new Response(JSON.stringify({ voteData: {}, realResults: {} }))); await tick(); });
    }
  } finally {
    await act(async () => renderer?.unmount()); globalThis.fetch = fetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  }
});


test('a metadata discovery failure is exposed as an error instead of leaving the screen loading forever', async () => {
  let result!: UseElectionDataResult;
  const keys = Object.keys;
  const failure = mock.method(Object, 'keys', (object: object) => {
    if (object === manifests) throw new Error('Metadata unavailable');
    return keys(object);
  });
  function Probe() { result = useElectionData('25', false); return null; }
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => { renderer = create(React.createElement(Probe)); await tick(); });
    assert.equal(result.error, 'Metadata unavailable');
    assert.equal(result.currentElection, null);
  } finally { failure.mock.restore(); await act(async () => renderer?.unmount()); }
});
