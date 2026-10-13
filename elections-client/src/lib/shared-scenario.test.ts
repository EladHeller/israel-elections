import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSharedScenario, decodeSharedScenario, validateSharedScenario, type SharedScenario } from './shared-scenario';
import { computeScenarioResults } from './scenario';

const snapshot: SharedScenario = {
  version: 1, election: '25', demo: true,
  base: {
    voteData: { א: { votes: 1000, mandats: 0, name: 'מפלגה ראשונה' }, ב: { votes: 2000, mandats: 0 } },
    config: { algorithm: 'baderOffer', blockPercentage: 0.0325, agreements: [['א', 'ב']], totalVotes: 3100, turnoutPercentage: 70 },
  },
  scenario: {
    voteData: { א: { votes: 1900, mandats: 0 }, ב: { votes: 1700, mandats: 0 } },
    config: { algorithm: 'ceilRound', blockPercentage: 0.01, agreements: [] },
  },
};

test('compressed sharing preserves Hebrew, votes, configurations, base statistics and demo identity', async () => {
  const token = await encodeSharedScenario(snapshot);
  assert.match(token, /^[\w-]+$/);
  assert.ok(token.length < JSON.stringify(snapshot).length);
  const restored = await decodeSharedScenario(token, '25');
  assert.deepEqual(restored, snapshot);
  assert.deepEqual(computeScenarioResults(restored.scenario.voteData, restored.scenario.config),
    computeScenarioResults(snapshot.scenario.voteData, snapshot.scenario.config));
  assert.deepEqual(await decodeSharedScenario(await encodeSharedScenario(restored), '25'), snapshot);
});

test('restored snapshots do not depend on subsequently changed source data', async () => {
  const source = structuredClone(snapshot);
  const token = await encodeSharedScenario(source);
  source.base.voteData.א.votes = 999999;
  source.scenario.config.agreements.push(['א', 'ב']);
  assert.deepEqual(await decodeSharedScenario(token, '25'), snapshot);
});

test('rejects corrupt links, unsupported versions, wrong election and unsafe values', async () => {
  for (const token of ['', 'invalid!!!', 'abcd', 'a'.repeat(24001)]) {
    await assert.rejects(decodeSharedScenario(token, '25'));
  }
  await assert.rejects(decodeSharedScenario(await encodeSharedScenario(snapshot), '24'));
  const cases: unknown[] = [null, { ...snapshot, version: 2 }, { ...snapshot, demo: 'yes' }];
  for (const mutate of [
    (s: SharedScenario) => { s.scenario.voteData.א.votes = -1; },
    (s: SharedScenario) => { s.scenario.voteData.א.votes = Infinity; },
    (s: SharedScenario) => { s.scenario.voteData.א.votes = 1.1; },
    (s: SharedScenario) => { s.scenario.config.blockPercentage = NaN; },
    (s: SharedScenario) => { s.scenario.config.blockPercentage = 2; },
    (s: SharedScenario) => { s.scenario.config.agreements = [['א', 'א']]; },
    (s: SharedScenario) => { s.scenario.config.agreements = [['א', 'ג']]; },
    (s: SharedScenario) => { delete s.scenario.voteData.ב; },
    (s: SharedScenario) => { s.base.config.totalVotes = -1; },
    (s: SharedScenario) => { s.base.config.turnoutPercentage = 101; },
    (s: SharedScenario) => { s.base.voteData = JSON.parse('{"__proto__":{"votes":1}}'); },
  ]) { const value = structuredClone(snapshot); mutate(value); cases.push(value); }
  for (const value of cases) assert.throws(() => validateSharedScenario(value, '25'));
});

test('decompression is bounded to avoid oversized payloads', async () => {
  const stream = new Blob(['x'.repeat(100001)]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  await assert.rejects(decodeSharedScenario(token, '25'));
});
