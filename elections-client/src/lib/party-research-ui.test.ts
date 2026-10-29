import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PartyResearch from '../components/PartyResearch';
import AppHeader from '../components/AppHeader';
import PartyRow from '../components/PartyRow';

const csv = 'שם ישוב,סמל ישוב,כשרים,מחל,אמת\nגדול,1,100,60,40\nקטן,2,10,9,1\n';
const text = (renderer: ReturnType<typeof create>) => JSON.stringify(renderer.toJSON());
const tick = () => new Promise(resolve => setImmediate(resolve));

test('research route loads official CSV, selects a party, filters and refreshes with retry', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let refresh = () => {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: (callback: () => void) => { refresh = callback; return 1; }, clearInterval: () => {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: {} }, visibilityState: 'visible' } });
  let fail = false;
  let empty = false;
  let requestedUrl = '';
  globalThis.fetch = async url => {
    requestedUrl = String(url);
    return new Response(empty ? 'שם ישוב,כשרים,מחל\n' : csv, { status: fail ? 503 : 200, headers: { 'last-modified': 'Wed, 28 Oct 2026 20:00:00 GMT' } });
  };
  let renderer!: ReturnType<typeof create>;
  const render = async (election: string) => {
    await act(async () => {
      renderer = create(React.createElement(MemoryRouter, { initialEntries: [`/research/${election}?party=אמת`] },
        React.createElement(Routes, {}, React.createElement(Route, { path: '/research/:electionId', element: React.createElement(PartyResearch) }))));
      await tick();
    });
  };
  try {
    await render('26');
    assert.equal(requestedUrl, '/data/26/elections.csv');
    assert.match(text(renderer), /הספירה נמשכת/);
    assert.equal(renderer.root.findAllByType('table').length, 2);
    assert.equal(renderer.root.findAllByType('select')[0].props.value, 'אמת');
    await act(async () => { renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'מחל' } }); });
    assert.equal(renderer.root.findAllByType('select')[0].props.value, 'מחל');
    await act(async () => { renderer.root.findByProps({ type: 'number' }).props.onChange({ target: { value: '50' } }); });
    assert.equal(renderer.root.findAllByType('tbody')[0].findAllByType('tr').length, 1);
    fail = true;
    await act(async () => { refresh(); await tick(); });
    assert.match(text(renderer), /מוצגים הנתונים האחרונים/);
    assert.equal(renderer.root.findAllByType('table').length, 2);
    fail = false;
    await act(async () => { renderer.root.findAllByType('button').find(button => button.children.includes('ניסיון נוסף'))!.props.onClick(); await tick(); });
    assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0);
    await act(async () => { renderer.root.findByType(AppHeader).props.setViewMode('research'); });
    await act(async () => { renderer.root.findByType(AppHeader).props.setCurrentElection('25'); await tick(); });
    assert.equal(requestedUrl, '/data/25/elections.csv');
    await act(async () => renderer.unmount());
    fail = true;
    await render('25');
    assert.match(text(renderer), /טעינת נתוני היישובים נכשלה/);
    assert.equal(renderer.root.findAllByType('table').length, 0);
    await act(async () => renderer.unmount());
    fail = false; empty = true;
    await render('25');
    assert.match(text(renderer), /טרם פורסמו/);
    await act(async () => renderer.unmount());
    await render('14');
    assert.match(text(renderer), /אינם זמינים/);
    assert.equal(renderer.root.findAllByType('button').filter(button => button.children.includes('מחקר מפלגות')).length, 0);
  } finally {
    await act(async () => renderer?.unmount());
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  }
});

test('party result names link directly to the selected party research', () => {
  const renderer = create(React.createElement(MemoryRouter, {}, React.createElement(PartyRow, {
    name: 'הליכוד', seats: 30, votes: 100, researchHref: '/research/25?party=מחל',
  })));
  assert.equal(renderer.root.findByType('a').props.href, '/research/25?party=מחל');
  renderer.unmount();
});

test('header exposes research only for supported elections', () => {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: {} } } });
  const props = { statusText: '', showSimulator: true, isEdited: false, currentElection: '25', setCurrentElection: () => {}, availableElections: ['25', '14'], viewMode: 'results' as const, setViewMode: () => {} };
  const renderer = create(React.createElement(AppHeader, props));
  assert.match(text(renderer), /מחקר מפלגות/);
  renderer.update(React.createElement(AppHeader, { ...props, currentElection: '14' }));
  assert.doesNotMatch(text(renderer), /מחקר מפלגות/);
  renderer.unmount();
});
