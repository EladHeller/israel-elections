import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { useQuestionPlaces } from '../hooks/use-question-places';
const csv = 'שם ישוב,סמל ישוב,מספר קלפי,פיצול,כשרים,א\nירושלים,1,1,0,100,100\nירושלים,1,2,0,100,100\nתל אביב-יפו,2,7,0,100,100';
const tick = () => new Promise(resolve => setImmediate(resolve));

test('names load only for supported elections, stations load on demand, stale requests abort and failures retry', async () => {
  const original = globalThis.fetch; const requests: string[] = []; let fail = false; let delay = false;
  let release!: () => void; const signals: AbortSignal[] = []; let state!: ReturnType<typeof useQuestionPlaces>;
  const Harness = ({ election, stations = false }: { election?: string; stations?: boolean }) => { state = useQuestionPlaces(election, stations); return null; };
  globalThis.fetch = async (url, options) => {
    requests.push(String(url)); signals.push(options!.signal as AbortSignal);
    if (delay) await new Promise<void>(resolve => { release = resolve; });
    return new Response(fail ? '' : csv, { status: fail ? 500 : 200 });
  };
  let renderer!: ReturnType<typeof create>;
  const show = async (election?: string, stations = false) => { await act(async () => {
    const view = React.createElement(Harness, { election, stations });
    if (renderer) renderer.update(view); else renderer = create(view);
    await tick();
  }); };
  try {
    await show(); await show('1'); assert.equal(requests.length, 0);
    await show('26'); assert.equal(state.localities.length, 2); assert.equal(state.stations.length, 0);
    await show('26', true); assert.equal(state.stations.length, 3); assert.equal(requests.length, 2);
    fail = true; await show('25'); assert.equal(state.error, true);
    fail = false; await act(async () => { state.retry(); await tick(); }); assert.equal(state.error, false);
    delay = true; await show('24'); assert.equal(state.loading, true); assert.equal(state.localities.length, 0);
    await show('1'); assert.equal(signals.at(-1)!.aborted, true);
    await act(async () => { release(); await tick(); }); assert.equal(state.localities.length, 0);
    delay = false; await show('26', true); assert.equal(state.localities.length, 2);
  } finally { await act(async () => renderer?.unmount()); globalThis.fetch = original; }
});
