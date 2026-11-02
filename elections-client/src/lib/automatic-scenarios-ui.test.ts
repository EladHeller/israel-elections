import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AutomaticScenarios from '../components/AutomaticScenarios';
import PartyResearch from '../components/PartyResearch';
import { decodeSharedScenario } from './shared-scenario';
import { useBlocPreferences } from '../hooks/use-bloc-preferences';
import type { AnalysisInput, AutomaticScenario, ScenarioAnalysis } from './automatic-scenarios';

const input: AnalysisInput = {
  voteData: { a: { votes: 500, mandats: 0 }, b: { votes: 500, mandats: 0 } },
  config: { algorithm: 'baderOffer', blockPercentage: 0.0325, agreements: [] },
  blocs: { blocks: { right: { label: 'ימין', color: 'blue', parties: ['a'] }, left: { label: 'שמאל', color: 'red', parties: ['b'] } } },
};
const scenario: AutomaticScenario = { party: 'a', delta: 9, distance: 0.009, relativeDistance: 0.018,
  seatDeltas: { a: 1, b: -1 }, blocDeltas: { right: 1, left: -1 }, goals: ['majority:right:gain', 'transfer:left:right', 'party:gain'] };
const tick = () => new Promise(resolve => setImmediate(resolve));
function Location() { const location = useLocation(); return React.createElement('output', {}, location.pathname + location.hash); }
function text(renderer: ReturnType<typeof create>): string {
  const flatten = (value: any): string => typeof value === 'string' ? value : Array.isArray(value) ? value.map(flatten).join('') : flatten(value?.children || []);
  return flatten(renderer.toJSON());
}
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage!: (event: any) => void;
  onerror!: (event: any) => void;
  stopped = false;
  payload: any;
  constructor() { FakeWorker.instances.push(this); }
  postMessage(payload: any) { this.payload = payload; }
  terminate() { this.stopped = true; }
  deliver(analysis: ScenarioAnalysis) { this.onmessage({ data: { analysis } }); }
}

test('scenario cards open a complete frozen snapshot, handle failures, retry and cancel stale workers', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  let renderer!: ReturnType<typeof create>;
  t.after(async () => { await act(async () => renderer?.unmount()); if (previous) Object.defineProperty(globalThis, 'Worker', previous); else delete (globalThis as any).Worker; });
  const element = (props = {}) => React.createElement(MemoryRouter, {}, React.createElement(AutomaticScenarios, {
    ...input, election: '25', getPartyName: key => key === 'a' ? 'רשימה א' : 'רשימה ב', ...props,
  }), React.createElement(Location));
  await act(async () => { renderer = create(element()); });
  assert.match(text(renderer), /מחשב תרחישים/);
  const worker = FakeWorker.instances.at(-1)!;
  assert.deepEqual(worker.payload.voteData, input.voteData);
  const analysis = { votes: [scenario, { ...scenario, delta: -9, goals: ['party:lose'], blocDeltas: {} },
    { ...scenario, party: undefined, goals: [], blocDeltas: {} }],
  thresholds: [{ ...scenario, party: undefined, delta: 0, threshold: 0, goals: [] },
    { ...scenario, party: undefined, delta: 0, threshold: 0.03, goals: ['majority:right+left:lose'] }] };
  await act(async () => worker.deliver(analysis));
  assert.equal(renderer.root.findAllByType('article').length, 5);
  assert.match(text(renderer), /יצירת רוב לימין/);
  assert.match(text(renderer), /ביטול רוב לימין \+ שמאל/);
  assert.match(text(renderer), /תוספת מנדט/);
  assert.match(text(renderer), /אובדן מנדט/);
  const open = (index: number) => renderer.root.findAllByType('article')[index].findByType('button').props.onClick();
  await act(async () => { await open(0); });
  const location = renderer.root.findByType('output').children.join('');
  assert.ok(location.startsWith('/simulator/25#scenario='));
  const snapshot = await decodeSharedScenario(location.split('#scenario=')[1], '25');
  assert.equal(snapshot.scenario.voteData.a.votes, 509);
  assert.equal(snapshot.base.voteData.a.votes, 500);
  assert.equal(snapshot.base.voteData.a.name, 'רשימה א');
  assert.deepEqual(snapshot.scenario.voteData.b, snapshot.base.voteData.b);
  await act(async () => { await open(4); });
  const thresholdSnapshot = await decodeSharedScenario(renderer.root.findByType('output').children.join('').split('#scenario=')[1], '25');
  assert.equal(thresholdSnapshot.scenario.config.blockPercentage, 0.03);
  assert.deepEqual(thresholdSnapshot.scenario.voteData, thresholdSnapshot.base.voteData);
  await act(async () => renderer.update(element({ election: 'invalid', party: 'a', counting: true, demo: true })));
  assert.equal(worker.stopped, true);
  await act(async () => worker.deliver({ votes: [], thresholds: [] }));
  assert.match(text(renderer), /מחשב תרחישים/);
  const updated = FakeWorker.instances.at(-1)!;
  await act(async () => updated.deliver(analysis));
  assert.match(text(renderer), /מתעדכנים עם הספירה/);
  await act(async () => { await open(0); });
  assert.match(text(renderer), /פתיחת התרחיש נכשלה/);
  await act(async () => updated.deliver({ votes: [], thresholds: [] }));
  assert.match(text(renderer), /לא נמצאו/);
  let prevented = false;
  await act(async () => updated.onerror({ preventDefault() { prevented = true; } }));
  assert.equal(prevented, true);
  assert.match(text(renderer), /חישוב התרחישים נכשל/);
  await act(async () => renderer.root.findAllByType('button').find(node => node.children.includes('ניסיון נוסף'))!.props.onClick());
  assert.equal(updated.stopped, true);
  await act(async () => updated.onerror({ preventDefault() {} }));
  const retry = FakeWorker.instances.at(-1)!;
  await act(async () => retry.deliver({ votes: [{ ...scenario, goals: ['majority:missing:gain'] }], thresholds: [] }));
  assert.match(text(renderer), /missing/);
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: class { constructor() { throw new Error('Unavailable'); } } });
  await act(async () => renderer.update(element({ party: 'b' })));
  assert.match(text(renderer), /חישוב התרחישים נכשל/);
});

test('research loads national results for selected-list scenarios and retains local rankings', async t => {
  const descriptors = ['Worker', 'fetch', 'window', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { clearInterval() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: {} } } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { return null; } } });
  globalThis.fetch = async url => new Response(String(url).endsWith('.json')
    ? JSON.stringify({ voteData: input.voteData, realResults: { a: { votes: 500, mandats: 60 }, b: { votes: 500, mandats: 60 } } })
    : 'שם ישוב,סמל ישוב,כשרים,a,b\nעיר,1,1000,500,500');
  let renderer!: ReturnType<typeof create>;
  t.after(async () => { await act(async () => renderer?.unmount()); for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; } });
  const { Route, Routes } = await import('react-router-dom');
  await act(async () => { renderer = create(React.createElement(MemoryRouter, { initialEntries: ['/research/25?party=a'] },
    React.createElement(Routes, {}, React.createElement(Route, { path: '/research/:electionId', element: React.createElement(PartyResearch) })))); await tick(); });
  assert.equal(FakeWorker.instances.at(-1)!.payload.party, 'a');
  assert.equal(renderer.root.findAllByType('table').length, 2);
  await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: 'b' } }));
  assert.equal(FakeWorker.instances.at(-1)!.payload.party, 'b');
});

test('research bloc preferences honor custom assignments and labels and recover from storage failures', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let raw: string | null = JSON.stringify({ '25': { assignments: { a: 'left', b: null, unknown: 'missing' }, labels: { right: 'Custom' } } });
  let fail = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { if (fail) throw Error('read'); return raw; }, setItem(_key: string, value: string) { if (fail) throw Error('write'); raw = value; } } });
  let preferences!: ReturnType<typeof useBlocPreferences>;
  function Probe({ election }: { election: string | null }) { preferences = useBlocPreferences(election, input.blocs); return null; }
  let renderer!: ReturnType<typeof create>;
  t.after(async () => { await act(async () => renderer?.unmount()); if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete (globalThis as any).localStorage; });
  await act(async () => { renderer = create(React.createElement(Probe, { election: '25' })); });
  assert.equal(preferences.partyToBloc.a, 'left');
  assert.equal(preferences.partyToBloc.b, null);
  assert.equal(preferences.blocs.blocks.right.label, 'Custom');
  assert.equal(preferences.partyToBloc.unknown, undefined);
  await act(async () => preferences.renameBloc('left', 'Changed'));
  assert.equal(preferences.blocs.blocks.left.label, 'Changed');
  await act(async () => preferences.assignParty('a', 'right'));
  assert.equal(preferences.partyToBloc.a, 'right');
  fail = true;
  await act(async () => preferences.assignParty('a', null));
  assert.equal(preferences.saveFailed, true);
  fail = false;
  await act(async () => preferences.reset());
  assert.equal(preferences.customized, false);
  await act(async () => preferences.assignParty('b', 'right'));
  await act(async () => preferences.reset());
  await act(async () => preferences.renameBloc('right', 'Fresh'));
  await act(async () => preferences.assignParty('b', 'right'));
  await act(async () => preferences.renameBloc('right', 'Again'));
  await act(async () => renderer.update(React.createElement(Probe, { election: null })));
  await act(async () => preferences.reset());
  await act(async () => renderer.unmount());
  fail = true;
  await act(async () => { renderer = create(React.createElement(Probe, { election: '25' })); });
  assert.equal(preferences.customized, false);
});

test('worker posts results and reports malformed input without crashing', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const messages: any[] = [];
  const worker = { onmessage: (_event: any) => {}, postMessage: (value: any) => messages.push(value) };
  Object.defineProperty(globalThis, 'self', { configurable: true, value: worker });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'self', descriptor); else delete (globalThis as any).self; });
  await import('../workers/automatic-scenarios.worker');
  worker.onmessage({ data: input });
  assert.ok(messages[0].analysis);
  worker.onmessage({ data: null });
  assert.deepEqual(messages[1], { error: true });
});
