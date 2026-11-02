import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ElectionQuestions from '../components/ElectionQuestions';
import ElectionSelector from '../components/ElectionSelector';
import manifests from '../data/elections-manifests.json';
import partyNames from '../data/party-names.json';

const tick = () => new Promise(resolve => setImmediate(resolve));
const snapshot = { time: '2026-11-02T10:00:00Z', voteData: { מחל: { votes: 500, mandats: 0 }, ך: { votes: 100, mandats: 0 } }, realResults: {} };
const csv = 'סמל ישוב,שם ישוב,מספר קלפי,כשרים,מחל,ך\n1,מקום,1,100,80,20';

test('question page requires election selection, confirms structured interpretation, calculates locally and loads geographic data on demand', async () => {
  const originals = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 1, clearInterval() {}, localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false }) } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible', documentElement: { dataset: { theme: "light" }, setAttribute() {} }, addEventListener() {}, removeEventListener() {} } });
  const requests: string[] = [];
  let mode = 'ok';
  let pending: (() => void) | undefined;
  globalThis.fetch = async url => {
    const path = String(url); requests.push(path);
    if (path.endsWith('.csv')) {
      if (mode === 'pending') await new Promise<void>(resolve => { pending = resolve; });
      if (mode === 'fail') return new Response('', { status: 404 });
      if (mode === 'bad') return new Response('<html>missing</html>');
      if (mode === 'throw') throw 'offline';
      return new Response(mode === 'empty' ? csv.split('\n')[0] : csv);
    }
    if (mode === 'results-fail') throw new Error('offline');
    return new Response(JSON.stringify(path.includes('election-config') ? {} : snapshot));
  };
  let renderer!: ReturnType<typeof create>;
  const text = () => JSON.stringify(renderer.toJSON());
  const mount = async (path: string) => {
    await act(async () => { renderer?.unmount(); });
    await act(async () => {
      renderer = create(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(Routes, {},
        React.createElement(Route, { path: '/questions', element: React.createElement(ElectionQuestions) }),
        React.createElement(Route, { path: '/questions/:electionId', element: React.createElement(ElectionQuestions) }))));
      await tick();
    });
  };
  const ask = async (value: string) => {
    await act(async () => renderer.root.findByType('textarea').props.onChange({ target: { value } }));
    await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  };
  const calculate = () => renderer.root.findAllByType('button').find(button => button.children.includes('חישוב התשובה'))!;
  try {
    await mount('/questions');
    assert.equal(requests.length, 0);
    await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    await act(async () => renderer.root.findByType(ElectionSelector).props.onChange('26'));
    assert.ok(requests.every(path => !path.endsWith('.csv')));
    await ask('מה היה קורה אם לא היה אחוז חסימה');
    assert.match(text(), /כך הבנתי/);
    assert.ok(!text().includes('תרחיש מחושב'));
    const recalculate = calculate().props.onClick;
    await act(async () => { recalculate(); await tick(); });
    assert.match(text(), /תרחיש מחושב/);
    assert.ok(requests.every(path => !path.endsWith('.csv')));
    await ask('מי ינצח?'); assert.match(text(), /לא הצלחתי/);
    // A retained handler must safely ignore a new, unsupported interpretation.
    const staleCalculate = calculate;
    assert.equal(staleCalculate(), undefined);
    const example = renderer.root.findAllByType('button').find(button => button.children.includes('באיזה יישוב הליכוד קיבלה הכי הרבה קולות?'))!;
    await act(async () => example.props.onClick());
    assert.equal(renderer.root.findByType('textarea').props.value, 'באיזה יישוב הליכוד קיבלה הכי הרבה קולות?');
    await ask('באיזה יישוב הליכוד קיבלה הכי הרבה קולות');
    await act(async () => { calculate().props.onClick(); await tick(); });
    assert.match(text(), /מקום/);
    assert.equal(requests.at(-1), '/data/26/elections.csv');
    for (const failure of ['fail', 'bad', 'throw', 'empty']) {
      mode = failure;
      await ask('באיזה קלפי הליכוד קיבלה הכי הרבה קולות');
      await act(async () => { calculate().props.onClick(); await tick(); });
      assert.equal(requests.at(-1), '/data/26/polling-stations.csv');
      assert.match(text(), failure === 'empty' ? /לא נמצאו/ : failure === 'throw' ? /החישוב נכשל/ : failure === 'bad' ? /קלפיות|תקינים/ : /לא ניתן לטעון/);
    }
    mode = 'pending';
    await ask('באיזה יישוב הליכוד קיבלה הכי הרבה קולות');
    await act(async () => { calculate().props.onClick(); await tick(); });
    assert.match(text(), /מחשב…/);
    await act(async () => { renderer.root.findByType(ElectionSelector).props.onChange('14'); await tick(); });
    await act(async () => { pending?.(); await tick(); });
    assert.ok(!text().includes('מקום'));
    mode = 'ok';
    await ask('באיזה יישוב מחל קיבלה הכי הרבה קולות');
    await act(async () => { calculate().props.onClick(); await tick(); });
    assert.match(text(), /אין נתוני מקומות/);
    await mount('/questions/999'); assert.match(text(), /אינה קיימת/);
    mode = 'results-fail';
    await mount('/questions/25'); assert.match(text(), /טעינת נתוני הבחירות נכשלה/);
    mode = 'ok';
    const originalManifest = manifests['26'];
    const originalName = partyNames['26']['מחל'];
    try {
      delete (partyNames['26'] as Record<string, string>)['מחל'];
      await mount('/questions/26');
      await ask('כמה קולות קיבלה מחל');
      assert.match(text(), /כך הבנתי/);
      manifests['26'] = { ...originalManifest, phase: 'voting' };
      await mount('/questions/26'); assert.match(text(), /אין עדיין תוצאות/);
    } finally { manifests['26'] = originalManifest; partyNames['26']['מחל'] = originalName; }
  } finally {
    await act(async () => renderer?.unmount());
    globalThis.fetch = originals.fetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originals.window });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originals.document });
  }
});
