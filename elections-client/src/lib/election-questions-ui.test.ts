import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ElectionQuestions from '../components/ElectionQuestions';
import QuestionAnswer from '../components/QuestionAnswer';
import ElectionSelector from '../components/ElectionSelector';
import manifests from '../data/elections-manifests.json';
import partyNames from '../data/party-names.json';
import type { QuestionAttempt } from './question-log';

const tick = () => new Promise(resolve => setImmediate(resolve));
const snapshot = { time: '2026-11-02T10:00:00Z', voteData: { מחל: { votes: 500, mandats: 0 }, ך: { votes: 100, mandats: 0 } }, realResults: {} };
const csv = 'סמל ישוב,שם ישוב,מספר קלפי,כשרים,מחל,ך\n1,מקום,1,100,80,20';
test('Enter submits directly, renders prose, records outcomes and ignores stale requests', async () => {
  const originals = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document };
  let focused = false;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 1, clearInterval() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible', documentElement: { dataset: { theme: 'light' } }, addEventListener() {}, removeEventListener() {}, getElementById: () => ({ focus() { focused = true; } }) } });
  const requests: string[] = [];
  const records: QuestionAttempt[] = [];
  let mode = 'ok'; let saveFails = false; let pending: (() => void) | undefined;
  globalThis.fetch = async (url, options) => {
    const path = String(url); requests.push(path);
    if (path === '/api/questions') { records.push(JSON.parse(String(options!.body))); return new Response('', { status: saveFails ? 503 : 201 }); }
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
        React.createElement(Route, { path: '/questions/:electionId', element: React.createElement(ElectionQuestions) })))); await tick();
    });
  };
  const input = () => renderer.root.findByProps({ id: 'election-question' });
  const ask = async (value: string) => {
    await act(async () => input().props.onChange({ target: { value } }));
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await tick(); });
  };
  try {
    await mount('/questions'); assert.equal(requests.length, 0);
    await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    await act(async () => renderer.root.findByType(ElectionSelector).props.onChange('26'));
    await ask(''); assert.equal(records.length, 0);
    await ask('מה היה קורה אם לא היה אחוז חסימה');
    assert.equal(records.at(-1)!.outcome, 'answered'); assert.ok(renderer.root.findByType(QuestionAnswer));
    assert.equal(renderer.root.findAllByType('table').length, 0); assert.equal(renderer.root.findAllByType('textarea').length, 0);
    assert.ok(!text().includes('פענוח השאלה') && !text().includes('חישוב התשובה'));
    await ask('מי ינצח?'); assert.match(text(), /לא הצלחתי/); assert.equal(records.at(-1)!.outcome, 'unsupported');
    await ask('כמה קולות היו חסרים לליכוד כדי לקבל מנדט נוסף בתוצאות האמת?');
    assert.match(text(), /הייתה צריכה עוד/); assert.equal(records.at(-1)!.outcome, 'answered');
    await ask('כמה קולות צריכים לרדת לליכוד כדי שתאבד מנדט?');
    assert.match(text(), /צריכה לאבד/); assert.equal(records.at(-1)!.outcome, 'answered');
    await ask('באילו קלפיות רשימה שלא עברה את אחוז החסימה קיבלה רוב הקולות');
    assert.match(text(), /לא נמצאו/); assert.equal(records.at(-1)!.outcome, 'empty');
    assert.ok(requests.includes('/data/26/polling-stations.csv'));
    await ask('באילו יישובים רשימה שלא עברה את אחוז החסימה קיבלה הכי הרבה קולות');
    assert.match(text(), /לא נמצאו/); assert.ok(requests.includes('/data/26/elections.csv'));
    const example = renderer.root.findAllByType('button').find(button => button.children.includes('באיזה יישוב הליכוד קיבלה הכי הרבה קולות?'))!;
    await act(async () => example.props.onClick()); assert.equal(focused, true);
    assert.equal(input().props.value, 'באיזה יישוב הליכוד קיבלה הכי הרבה קולות?');
    await ask(input().props.value); assert.match(text(), /מקום/); assert.ok(requests.includes('/data/26/elections.csv'));
    for (const failure of ['fail', 'bad', 'throw', 'empty']) {
      mode = failure; await ask('באיזה קלפי הליכוד קיבלה הכי הרבה קולות');
      assert.ok(requests.includes('/data/26/polling-stations.csv'));
      assert.match(text(), failure === 'empty' ? /לא נמצאו/ : failure === 'throw' ? /החישוב נכשל/ : failure === 'bad' ? /קלפיות|תקינים/ : /לא הצלחתי לטעון/);
      assert.equal(records.at(-1)!.outcome, failure === 'empty' ? 'empty' : 'failed');
    }
    mode = 'pending'; await ask('באיזה יישוב הליכוד קיבלה הכי הרבה קולות'); assert.match(text(), /מחשב…/);
    await act(async () => { renderer.root.findByType(ElectionSelector).props.onChange('14'); await tick(); });
    await act(async () => { pending?.(); await tick(); });
    assert.equal(records.at(-1)!.outcome, 'cancelled'); assert.ok(!text().includes('מקום'));
    mode = 'ok'; await ask('באיזה יישוב מחל קיבלה הכי הרבה קולות'); assert.match(text(), /אין נתוני מקומות/);
    saveFails = true; await ask('כמה קולות קיבלה מחל'); assert.match(text(), /שמירת השאלה נכשלה/); assert.ok(renderer.root.findByType(QuestionAnswer)); saveFails = false;
    await mount('/questions/999'); assert.match(text(), /אינה קיימת/);
    mode = 'results-fail'; await mount('/questions/25'); assert.match(text(), /טעינת נתוני הבחירות נכשלה/); mode = 'ok';
    const originalManifest = manifests['26']; const originalName = partyNames['26']['מחל'];
    try {
      delete (partyNames['26'] as Record<string, string>)['מחל']; await mount('/questions/26'); await ask('כמה קולות קיבלה מחל'); assert.ok(renderer.root.findByType(QuestionAnswer));
      manifests['26'] = { ...originalManifest, phase: 'voting' }; await mount('/questions/26'); assert.match(text(), /אין עדיין תוצאות/);
    } finally { manifests['26'] = originalManifest; partyNames['26']['מחל'] = originalName; }
  } finally {
    await act(async () => renderer?.unmount()); globalThis.fetch = originals.fetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originals.window }); Object.defineProperty(globalThis, 'document', { configurable: true, value: originals.document });
  }
});

test('prose includes explicit green gains and red losses without unchanged seat clutter', () => {
  let renderer!: ReturnType<typeof create>;
  const show = (kind: 'scenario' | 'rank' | 'gap' | 'seat-gap' | 'seat-loss' | 'below-threshold-winners' | 'results', rows: (string | number)[][]) => {
    renderer?.unmount(); renderer = create(React.createElement(QuestionAnswer, { kind, answer: { rows, note: '', columns: [] } })); return JSON.stringify(renderer.toJSON());
  };
  try {
    assert.match(show('scenario', [['א', 10, 11, 1], ['ב', 12, 10, -2], ['ג', 1, 1, 0], ['ד', 1, 0, -1], ['ה', 10, 12, 2]]), /מקבלת.*מנדט אחד/);
    assert.equal(renderer.root.findAllByProps({ className: 'question-seat-change is-gain' }).length, 2); assert.equal(renderer.root.findAllByProps({ className: 'question-seat-change is-loss' }).length, 2);
    assert.match(show('scenario', [['א', 1, 1, 0]]), /ללא שינוי/); assert.match(show('results', [['א', 1234, '20%', 24], ['ב', '12,345', '30%', 36]]), /1,234/);
    assert.match(show('rank', [['יישוב', 80, '80%']]), /הכשרים במקום/); assert.match(show('gap', [['א', 0]]), /כבר מגיעה/); assert.match(show('gap', [['א', 10]]), /צריכה עוד/);
    assert.match(show('rank', []), /לא נמצאו/); assert.equal(renderer.root.findAllByType('table').length, 0);
    assert.match(show('seat-gap', [['הציונות הדתית וזהות', 1234, 8]]), /1,234.*מעבר ל־.*8/);
    assert.match(show('seat-gap', [['א', '—', 120]]), /לא נמצאה.*בטווח החיפוש/);
    assert.match(show('seat-loss', [['א', 1234, 8]]), /צריכה לאבד.*1,234/);
    assert.match(show('seat-loss', [['א', '—', 0]]), /אין הפחתת קולות/);
    assert.match(show('below-threshold-winners', [['מקום — קלפי 1', 'עמך ישראל', 45, '45.00%', 'תיקו במקום הראשון']]), /עמך ישראל.*45.*תיקו במקום הראשון/);
  } finally { renderer.unmount(); }
});
