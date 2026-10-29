import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PartyResearch from '../components/PartyResearch';
import AppHeader from '../components/AppHeader';
import PartyRow from '../components/PartyRow';
import partyNames from '../data/party-names.json';

const csv = 'שם ישוב,סמל ישוב,כשרים,מחל,אמת\nגדול,1,100,60,40\nקטן,2,10,9,1\n';
const text = (renderer: ReturnType<typeof create>) => {
  const flatten = (node: any): string => typeof node === 'string' ? node : Array.isArray(node) ? node.map(flatten).join('') : flatten(node?.children ?? []);
  return flatten(renderer.toJSON());
};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('research route loads official CSV, selects a party, filters and refreshes with retry', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const names = partyNames['26'] as Record<string, string>;
  const originalName = names['אמת'];
  delete names['אמת'];
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
    assert.match(text(renderer), /קובץ נתוני היישובים עודכן/);
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
    assert.doesNotMatch(text(renderer), /קובץ נתוני היישובים עודכן/);
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
    names['אמת'] = originalName;
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
  assert.match(renderer.root.findByProps({ role: 'group' }).props.className, /view-switcher-four-options/);
  renderer.update(React.createElement(AppHeader, { ...props, showSimulator: false }));
  assert.equal(renderer.root.findByProps({ role: 'group' }).props.className, 'view-switcher');
  renderer.update(React.createElement(AppHeader, { ...props, currentElection: '14' }));
  assert.doesNotMatch(text(renderer), /מחקר מפלגות/);
  assert.equal(renderer.root.findByProps({ role: 'group' }).props.className, 'view-switcher');
  renderer.unmount();
});

test('research paginates every locality, resets on list changes, handles empty filters and navigates away', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { clearInterval() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: {} } } });
  const many = 'שם ישוב,סמל ישוב,כשרים,מחל,חדש\n' + Array.from({ length: 80 }, (_, index) => `יישוב ${index},${index + 1},100,${index + 1},1`).join('\n');
  globalThis.fetch = async () => new Response(many, { headers: { 'last-modified': 'invalid' } });
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(React.createElement(MemoryRouter, { initialEntries: ['/research/25?party=invalid'] }, React.createElement(Routes, {},
        React.createElement(Route, { path: '/research/:electionId', element: React.createElement(PartyResearch) }),
        React.createElement(Route, { path: '/summary', element: React.createElement('p', {}, 'Summary destination') }),
        React.createElement(Route, { path: '/results/:electionId', element: React.createElement('p', {}, 'Results destination') }))));
      await tick();
    });
    const rows = (index = 0) => renderer.root.findAllByType('tbody')[index].findAllByType('tr');
    const more = (order = 'מספר קולות') => renderer.root.findAllByType('button').find(button => button.props['aria-label'] === `הצגת יישובים נוספים לפי ${order}`)!;
    assert.equal(rows().length, 20); assert.equal(rows(1).length, 20);
    assert.match(more().props.className, /ghost/);
    assert.match(more('אחוז התמיכה').props.className, /ghost/);
    for (const button of [more(), more('אחוז התמיכה')]) {
      assert.equal(button.parent!.findAllByType('table').length, 1, 'each control belongs to its ranking');
    }
    await act(async () => more().props.onClick()); assert.equal(rows().length, 70); assert.equal(rows(1).length, 20);
    await act(async () => more('אחוז התמיכה').props.onClick()); assert.equal(rows(1).length, 70); assert.equal(rows().length, 70);
    await act(async () => more().props.onClick()); assert.equal(rows().length, 80); assert.equal(more(), undefined);
    assert.ok(more('אחוז התמיכה'));
    await act(async () => more('אחוז התמיכה').props.onClick()); assert.equal(rows(1).length, 80); assert.equal(more('אחוז התמיכה'), undefined);
    await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: 'חדש' } }));
    assert.equal(rows().length, 20); assert.equal(rows(1).length, 20); assert.match(text(renderer), /חדש/);
    await act(async () => renderer.root.findByProps({ type: 'number' }).props.onChange({ target: { value: '101' } }));
    assert.match(text(renderer), /אין יישובים התואמים/); assert.equal(more(), undefined); assert.equal(more('אחוז התמיכה'), undefined);
    await act(async () => renderer.root.findByProps({ type: 'number' }).props.onChange({ target: { value: '' } })); assert.equal(rows().length, 20);
    await act(async () => renderer.root.findByType(AppHeader).props.setCurrentElection('14'));
    assert.match(text(renderer), /Results destination/);
    await act(async () => renderer.unmount());
    await act(async () => {
      renderer = create(React.createElement(MemoryRouter, { initialEntries: ['/research/25'] }, React.createElement(Routes, {},
        React.createElement(Route, { path: '/research/:electionId', element: React.createElement(PartyResearch) }),
        React.createElement(Route, { path: '/summary', element: React.createElement('p', {}, 'Summary destination') }))));
      await tick();
    });
    await act(async () => renderer.root.findByType(AppHeader).props.setViewMode('summary'));
    assert.match(text(renderer), /Summary destination/);
  } finally {
    await act(async () => renderer?.unmount()); globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  }
});

test('research pauses hidden polling, deduplicates slow requests and ignores late success or failure after navigation', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let refresh = () => {};
  const document = { documentElement: { dataset: {} }, visibilityState: 'visible' };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: (callback: () => void) => { refresh = callback; return 1; }, clearInterval() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  let renderer!: ReturnType<typeof create>;
  try {
    for (const outcome of ['success', 'failure', 'late-body']) {
      let deferred = false;
      let calls = 0;
      let resolve!: (response: Response) => void;
      let reject!: (error: Error) => void;
      let finishBody!: (body: string) => void;
      let signal: AbortSignal | null | undefined;
      globalThis.fetch = async (_url, options) => {
        calls++; signal = options?.signal;
        if (!deferred) return new Response(csv);
        if (outcome === 'late-body') return { ok: true, headers: new Headers(), text: () => new Promise<string>(done => { finishBody = done; }) } as Response;
        return new Promise<Response>((done, fail) => { resolve = done; reject = fail; });
      };
      await act(async () => {
        renderer = create(React.createElement(MemoryRouter, { initialEntries: ['/research/26'] }, React.createElement(Routes, {}, React.createElement(Route, { path: '/research/:electionId', element: React.createElement(PartyResearch) }))));
        await tick();
      });
      const before = calls;
      document.visibilityState = 'hidden';
      await act(async () => { refresh(); await tick(); }); assert.equal(calls, before);
      document.visibilityState = 'visible'; deferred = true;
      await act(async () => { refresh(); await tick(); refresh(); }); assert.equal(calls, before + 1);
      await act(async () => renderer.unmount()); assert.equal(signal?.aborted, true);
      await act(async () => {
        if (outcome === 'failure') reject(new Error('cancelled'));
        else if (outcome === 'late-body') finishBody(csv);
        else resolve(new Response(csv));
        await tick();
      });
    }
  } finally {
    await act(async () => renderer?.unmount()); globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  }
});
