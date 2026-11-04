import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes, useNavigate, useLocation, type NavigateFunction } from 'react-router-dom';
import ElectionQuestions from '../components/ElectionQuestions';
import ElectionSelector from '../components/ElectionSelector';
import QuestionShare from '../components/QuestionShare';
import { questionHref } from './question-link';
import configs from '../data/elections-config.json';
import type { QuestionAttempt } from './question-log';

const tick = () => new Promise(resolve => setImmediate(resolve));
const question = 'מה היה קורה אם רעם הייתה מקבלת 10000 פחות קולות';
const snapshot = { voteData: { ...Object.fromEntries(configs['26'].agreements.flat().map(id => [id, { votes: 0, mandats: 0 }])),
  מחל: { votes: 50000, mandats: 0 }, עם: { votes: 20000, mandats: 0 } }, realResults: {} };
const csv = 'שם ישוב,סמל ישוב,מספר קלפי,כשרים,מחל,עם\nירושלים,1,1,100,60,40';

test('question URLs wait for data, run once, handle query navigation and cancel superseded requests', async () => {
  const original = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document };
  const records: QuestionAttempt[] = []; let mode = 'normal'; let resultLoads = 0; const pending: (() => void)[] = [];
  let currentSearch = ''; let navigate!: NavigateFunction; let renderer!: ReturnType<typeof create>;
  const Navigation = () => { navigate = useNavigate(); currentSearch = useLocation().search; return null; };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: () => 1, clearInterval() {}, location: { origin: 'https://example.test' } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible', documentElement: { dataset: { theme: 'light' } }, addEventListener() {}, removeEventListener() {}, getElementById: () => ({ focus() {} }) } });
  globalThis.fetch = async (url, options) => {
    const path = String(url);
    if (path === '/api/questions') { records.push(JSON.parse(String(options!.body))); return new Response('', { status: 201 }); }
    if (path.endsWith('/26/allResults.json')) resultLoads++;
    if (mode === 'data' && path.endsWith('/26/allResults.json')) await new Promise<void>(resolve => pending.push(resolve));
    if (path.endsWith('.csv')) {
      if (mode === 'places') await new Promise<void>(resolve => pending.push(resolve));
      return new Response(csv);
    }
    return new Response(JSON.stringify(path.endsWith('election-config.json') ? {} : snapshot));
  };
  const settle = async () => { await act(async () => {
    for (let i = 0; i < 100; i++) {
      await tick();
      if (!renderer.root.findByProps({ className: 'question-response' }).props['aria-busy']) { await tick(); break; }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }); };
  const mount = async (path: string) => {
    await act(async () => renderer?.unmount()); records.length = 0;
    await act(async () => { renderer = create(React.createElement(MemoryRouter, { initialEntries: [path] },
      React.createElement(Navigation), React.createElement(Routes, {},
        React.createElement(Route, { path: '/questions/:electionId', element: React.createElement(ElectionQuestions) }),
        React.createElement(Route, { path: '/questions', element: React.createElement(ElectionQuestions) })))); await tick(); });
    if (mode === 'normal') await settle();
  };
  const input = () => renderer.root.findByProps({ id: 'election-question' });
  try {
    mode = 'data'; await mount(questionHref('26', question));
    assert.equal(input().props.value, question); assert.equal(records.length, 0);
    mode = 'normal'; await act(async () => { pending.splice(0).forEach(release => release()); await tick(); }); await settle();
    assert.equal(records.length, 1); assert.equal(records[0].outcome, 'answered');
    assert.ok(renderer.root.findAllByType('a').some(link => String(link.props.href).includes('/simulator/26#scenario=')));
    await settle(); assert.equal(records.length, 1);
    await act(async () => { navigate(questionHref('26', 'כמה קולות קיבלה הליכוד')); await tick(); }); await settle();
    assert.equal(records.length, 2); assert.equal(records.at(-1)!.question, 'כמה קולות קיבלה הליכוד');
    await mount(questionHref('26', 'שאלה שאינה נתמכת'));
    assert.equal(records[0].outcome, 'unsupported');
    await act(async () => { navigate(questionHref('26', 'א'.repeat(601))); await tick(); }); await settle();
    assert.equal(records.length, 1); assert.equal(input().props.value.length, 600);
    assert.match(JSON.stringify(renderer.toJSON()), /השאלה בקישור ארוכה מדי/);
    await mount('/questions/26?q=%20%20'); assert.equal(records.length, 0);
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await tick(); });
    assert.equal(records.length, 0, 'blank submission leaves the URL and answer alone');
    const loadsBeforeSubmissions = resultLoads;
    await act(async () => input().props.onChange({ target: { value: 'כמה קולות קיבלה הליכוד' } }));
    assert.equal(new URLSearchParams(currentSearch).get('q'), '  ', 'editing does not alter the submitted URL');
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await tick(); }); await settle();
    assert.equal(new URLSearchParams(currentSearch).get('q'), 'כמה קולות קיבלה הליכוד');
    assert.equal(records.length, 1, 'new submission executes only once');
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await tick(); }); await settle();
    assert.equal(records.length, 2, 'explicit repeated submission recalculates once');
    await act(async () => { navigate(-1); await tick(); }); await settle();
    assert.equal(input().props.value, '  '); assert.equal(records.length, 2);
    await act(async () => { navigate(1); await tick(); }); await settle();
    assert.equal(records.length, 3); assert.equal(input().props.value, 'כמה קולות קיבלה הליכוד');
    assert.equal(resultLoads, loadsBeforeSubmissions, 'question navigation retains loaded election results');
    await mount(questionHref('26', 'א'.repeat(601)));
    assert.equal(input().props.value.length, 600); assert.equal(records.length, 0);
    assert.match(JSON.stringify(renderer.toJSON()), /השאלה בקישור ארוכה מדי/);
    await act(async () => input().props.onChange({ target: { value: 'כמה קולות קיבלה הליכוד' } }));
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await tick(); }); await settle();
    assert.equal(records.length, 1);
    await mount(questionHref('999', question)); assert.equal(records.length, 0);
    await mount('/questions?' + new URLSearchParams({ q: question })); assert.equal(records.length, 0);
    await act(async () => { renderer.root.findByType(ElectionSelector).props.onChange('26'); await tick(); }); await settle();
    assert.equal(records.length, 1); assert.equal(records[0].question, question);
    mode = 'data'; await mount(questionHref('26', question));
    await act(async () => input().props.onChange({ target: { value: 'כמה קולות קיבלה הליכוד' } }));
    mode = 'normal'; await act(async () => { pending.splice(0).forEach(release => release()); await tick(); }); await settle();
    assert.equal(records.length, 0, 'editing before data arrival cancels automatic submission');
    mode = 'places'; await mount(questionHref('26', 'מי ניצחה בירושלים'));
    mode = 'normal'; await act(async () => { navigate(questionHref('26', 'כמה קולות קיבלה הליכוד')); await tick(); }); await settle();
    await act(async () => { pending.splice(0).forEach(release => release()); await tick(); });
    assert.ok(records.some(record => record.outcome === 'cancelled'));
    assert.match(JSON.stringify(renderer.toJSON()), /הליכוד/);
  } finally {
    await act(async () => renderer?.unmount()); globalThis.fetch = original.fetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: original.window });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: original.document });
  }
});

test('sharing encodes Hebrew and punctuation, copies the current question and provides a clipboard fallback', async () => {
  const original = { navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), window: globalThis.window };
  let copied = ''; let fail = false; let selected = false; let renderer!: ReturnType<typeof create>;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'https://example.test' } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { async writeText(text: string) { if (fail) throw new Error('denied'); copied = text; } } } });
  const props = { election: '26', question: '  מה אם רע"ם תקבל 10,000 פחות קולות? & #  ', disabled: false };
  try {
    act(() => { renderer = create(React.createElement(QuestionShare, props)); });
    await act(async () => { renderer.root.findByType('button').props.onClick(); await tick(); });
    const url = new URL(copied);
    assert.equal(url.pathname, '/questions/26'); assert.equal(url.searchParams.get('q'), props.question.trim()); assert.equal(url.hash, '');
    assert.match(JSON.stringify(renderer.toJSON()), /הקישור הועתק/);
    fail = true;
    await act(async () => { renderer.root.findByType('button').props.onClick(); await tick(); });
    const field = renderer.root.findByType('input'); assert.equal(field.props.value, copied);
    act(() => field.props.onFocus({ target: { select() { selected = true; } } })); assert.equal(selected, true);
    act(() => renderer.update(React.createElement(QuestionShare, { ...props, question: 'שאלה חדשה' })));
    assert.equal(renderer.root.findAllByProps({ role: 'status' }).length, 0);
    act(() => renderer.update(React.createElement(QuestionShare, { ...props, question: ' ' })));
    assert.equal(renderer.root.findByType('button').props.disabled, true);
    assert.match(questionHref('../26', question), /%2F/);
  } finally {
    act(() => renderer?.unmount());
    if (original.navigator) Object.defineProperty(globalThis, 'navigator', original.navigator); else Reflect.deleteProperty(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: original.window });
  }
});
