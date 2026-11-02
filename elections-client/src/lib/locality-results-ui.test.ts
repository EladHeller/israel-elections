import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import LocalityResults from '../components/LocalityResults';
import LocalitySelector from '../components/LocalitySelector';
import PartyResearch from '../components/PartyResearch';
import AppHeader from '../components/AppHeader';
import { localityHref } from './locality-results';
import { parsePollingStations } from './party-research';
import manifests from '../data/elections-manifests.json';

const cities = 'שם ישוב,סמל ישוב,כשרים,מחל,אמת,חדש\nירושלים,3000,1000,600,390,10\nיישוב קטן,2,100,20,79,1';
const stations = 'שם ישוב,סמל ישוב,מספר קלפי,פיצול,כשרים,מחל,אמת,חדש\nירושלים,3000,12,1,100,10,89,1\nירושלים,3000,12,2,900,590,301,9\nיישוב קטן,2,1,0,100,20,79,1';
const empty = 'שם ישוב,סמל ישוב,כשרים,מחל,אמת';
const tick = () => new Promise(resolve => setImmediate(resolve));
const text = (renderer: ReturnType<typeof create>) => JSON.stringify(renderer.toJSON());
let go: ReturnType<typeof useNavigate>;
function Location() { go = useNavigate(); return React.createElement('output', {}, useLocation().pathname + useLocation().search); }

function setup(t: any) {
  const originalFetch = globalThis.fetch;
  const originals = [Object.getOwnPropertyDescriptor(globalThis, 'window'), Object.getOwnPropertyDescriptor(globalThis, 'document')];
  const intervals = new Set<() => void>();
  const pointers = new Set<(event: any) => void>();
  const document = { documentElement: { dataset: {} }, visibilityState: 'visible', addEventListener(_name: string, fn: (event: any) => void) { pointers.add(fn); }, removeEventListener(_name: string, fn: (event: any) => void) { pointers.delete(fn); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: (fn: () => void) => { intervals.add(fn); return fn; }, clearInterval: (fn: () => void) => intervals.delete(fn) } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  let renderer!: ReturnType<typeof create>;
  let missing = false;
  let fail = false;
  let body = cities;
  let stationBody = stations;
  let modified = 'Wed, 28 Oct 2026 20:00:00 GMT';
  const calls: string[] = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    if (String(url).includes('polling-stations')) return new Response(stationBody, { status: missing ? 404 : 200, headers: { 'content-type': 'text/csv' } });
    if (fail) throw new Error('offline');
    return new Response(body, { headers: { 'last-modified': modified, 'content-type': 'text/csv' } });
  };
  t.after(async () => {
    await act(async () => renderer?.unmount());
    globalThis.fetch = originalFetch;
    ['window', 'document'].forEach((key, index) => {
      if (originals[index]) Object.defineProperty(globalThis, key, originals[index]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  });
  return {
    calls, intervals, document, pointers,
    setMissing(value: boolean) { missing = value; }, setFail(value: boolean) { fail = value; },
    setBody(value: string) { body = value; }, setStations(value: string) { stationBody = value; }, setModified(value: string) { modified = value; },
    async render(url: string, createNodeMock: (element: any) => any = () => null) {
      await act(async () => {
        renderer = create(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(React.Fragment, {},
          React.createElement(Routes, {},
            React.createElement(Route, { path: '/localities/:electionId', element: React.createElement(LocalityResults) }),
            React.createElement(Route, { path: '/research/:electionId', element: React.createElement(PartyResearch) }),
            React.createElement(Route, { path: '/results/:electionId', element: React.createElement('p', {}, 'Results') }),
            React.createElement(Route, { path: '/summary', element: React.createElement('p', {}, 'Summary') })),
          React.createElement(Location))), { createNodeMock });
        await tick();
      });
      return renderer;
    },
    async visit(url: string) { await act(async () => { go(url); await tick(); }); },
  };
}

const change = async (renderer: ReturnType<typeof create>, value: string, label: string) => {
  if (label === 'יישוב') {
    await act(async () => { renderer.root.findByType(LocalitySelector).props.onChange(value); await tick(); });
    return;
  }
  const control = renderer.root.findAllByType('label').find(node => node.children.includes(label))!;
  await act(async () => { control.findByType('select').props.onChange({ target: { value } }); await tick(); });
};

test('locality page contains votes, percentages, local seats and configured blocs together; links round-trip to the exact split station', async t => {
  const state = setup(t);
  const renderer = await state.render('/localities/25?locality=3000');
  assert.match(text(renderer), /ירושלים/);
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'חלוקת גושים' }).length, 1);
  assert.equal(renderer.root.findAllByType('table').length, 1);
  const rows = () => renderer.root.findByType('tbody').findAllByType('tr');
  assert.equal(rows().length, 3);
  assert.equal(rows()[0].findAllByType('td')[0].children[0], '600');
  assert.equal(rows()[0].findAllByType('td')[1].children[0], '60');
  assert.equal(rows()[2].findAllByType('td')[2].children[0], '0');
  const seats = rows().reduce((sum, row) => sum + Number(row.findAllByType('td')[2].children[0]), 0);
  assert.equal(seats, 120);
  assert.doesNotMatch(text(renderer), /קובץ הנתונים עודכן/);
  assert.ok(renderer.root.findAllByType('a').some(link => link.props.href === '/research/25?party=%D7%9E%D7%97%D7%9C'));
  const station = parsePollingStations(stations)[0];
  await change(renderer, station.id, 'קלפי');
  assert.match(text(renderer), /קלפי 12 \(פיצול 1\)/);
  assert.equal(rows()[0].findAllByType('td')[0].children[0], '89');
  assert.ok(renderer.root.findAllByType('a').every(link => !link.props.href.includes('/research/') || link.props.href.endsWith('level=stations')));
  const output = renderer.root.findByType('output').children.join('');
  assert.equal(output, localityHref('25', station));
  const researchLink = renderer.root.findAllByType('a').find(link => link.props.href.includes('party=%D7%90%D7%9E%D7%AA'))!;
  await state.visit(researchLink.props.href);
  assert.match(text(renderer), /מחקר מפלגות/);
  const researchRow = renderer.root.findAllByType('tr').find(row => row.findAllByType('a').some(link => link.props.href === localityHref('25', station)))!;
  await act(async () => researchRow.props.onClick({ defaultPrevented: true }));
  assert.match(text(renderer), /מחקר מפלגות/);
  await act(async () => { researchRow.props.onClick({ defaultPrevented: false }); await tick(); });
  assert.match(text(renderer), /קלפי 12 \(פיצול 1\)/);
  await change(renderer, '', 'קלפי');
  assert.equal(renderer.root.findByType('output').children.join(''), '/localities/25?locality=3000');
  await change(renderer, '2', 'יישוב');
  assert.equal(renderer.root.findAllByType('select').length, 0, 'single-station localities hide the station selector');
  await change(renderer, '', 'יישוב');
  assert.equal(renderer.root.findAllByType('table').length, 0);
  await state.visit('/localities/25?locality=3000');
  await act(async () => renderer.root.findByType(LocalitySelector).findByType('button').props.onClick());
  await act(async () => renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: 'אינו קיים' } }));
  assert.match(text(renderer), /לא נמצאו/);
  assert.match(text(renderer), /ירושלים/, 'selected locality stays visible in the trigger during filtering');
  await act(async () => renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: 'ירושלים' } }));
  await act(async () => { renderer.root.findByType(AppHeader).props.setCurrentElection('14'); await tick(); });
  assert.match(text(renderer), /Results/);
});

test('missing station data is optional, direct invalid links never show another location, and unconfigured blocs are absent', async t => {
  const state = setup(t);
  state.setMissing(true);
  const renderer = await state.render('/localities/20?locality=3000');
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'חלוקת גושים' }).length, 0);
  assert.equal(renderer.root.findAllByType('select').length, 0);
  await state.visit('/localities/20?locality=3000&station=missing');
  assert.match(text(renderer), /הקלפי שבקישור אינה זמינה/);
  assert.equal(renderer.root.findAllByType('table').length, 0);
  assert.ok(renderer.root.findAllByType('a').some(link => link.props.href === '/localities/20?locality=3000'));
  await state.visit('/localities/20?locality=missing');
  assert.match(text(renderer), /היישוב שבקישור אינו זמין/);
  await act(async () => { renderer.root.findByType(AppHeader).props.setCurrentElection('25'); await tick(); });
  assert.equal(renderer.root.findByType('output').children.join(''), '/localities/25');
  await act(async () => { renderer.root.findByType(AppHeader).props.setViewMode('research'); await tick(); });
  const row = renderer.root.findAllByType('tr').find(row => row.findAllByType('a').length)!;
  assert.equal(row.findByType('a').props.href.startsWith('/localities/25?locality='), true);
  await state.visit('/localities/25');
  await act(async () => { renderer.root.findByType(AppHeader).props.setViewMode('summary'); await tick(); });
  assert.match(text(renderer), /Summary/);
  await state.visit('/localities/14');
  assert.match(text(renderer), /אינם זמינים/);
  assert.ok(!renderer.root.findAllByType('button').some(button => button.children.includes('יישובים')));
});

test('embedded historical station files are aggregated and single station deep links remain addressable', async t => {
  const state = setup(t);
  state.setBody(stations);
  const row = parsePollingStations(stations)[2];
  const renderer = await state.render(localityHref('19', row));
  assert.equal(state.calls.filter(url => url.includes('polling-stations')).length, 0);
  assert.equal(renderer.root.findAllByType('select').length, 0);
  assert.match(text(renderer), /קלפי 1/);
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'חלוקת גושים' }).length, 0);
  await state.visit('/localities/19?locality=3000');
  assert.match(text(renderer), /1,000/);
  assert.equal(renderer.root.findAllByType('select').length, 1);
});

test('loading errors can be retried, empty files are explicit, and counting refresh keeps the last valid snapshot', async t => {
  const state = setup(t);
  state.setFail(true);
  const renderer = await state.render('/localities/26?locality=3000');
  assert.match(text(renderer), /טעינת נתוני היישובים נכשלה/);
  const retry = () => renderer.root.findAllByType('button').find(button => button.children.includes('ניסיון נוסף'))!;
  state.setFail(false);
  await act(async () => { retry().props.onClick(); await tick(); });
  assert.equal(renderer.root.findAllByType('table').length, 1);
  assert.match(text(renderer), /הספירה נמשכת/);
  assert.match(text(renderer), /קובץ הנתונים עודכן/);
  state.setFail(true);
  await act(async () => { for (const refresh of state.intervals) refresh(); await tick(); });
  assert.match(text(renderer), /מוצגים הנתונים האחרונים/);
  assert.equal(renderer.root.findAllByType('table').length, 1);
  state.setFail(false); state.setMissing(true); state.setModified('invalid');
  await act(async () => { for (const refresh of state.intervals) refresh(); await tick(); });
  assert.equal(renderer.root.findAllByType('select').length, 1, 'a transient missing optional file retains previous stations');
  assert.doesNotMatch(text(renderer), /קובץ הנתונים עודכן/);
  const before = state.calls.length;
  state.document.visibilityState = 'hidden';
  await act(async () => { for (const refresh of state.intervals) refresh(); await tick(); });
  assert.equal(state.calls.length, before);
  state.document.visibilityState = 'visible';
  state.setBody(empty); state.setModified('');
  await act(async () => { for (const refresh of state.intervals) refresh(); await tick(); });
  assert.match(text(renderer), /טרם פורסמו/);
});

test('slow requests deduplicate, unmount aborts late responses and optional malformed CSV stays hidden', async t => {
  const state = setup(t);
  state.setStations('not a CSV');
  const renderer = await state.render('/localities/26?locality=3000');
  assert.equal(renderer.root.findAllByType('select').length, 0);
  const pending: ((value: Response) => void)[] = [];
  let signal: AbortSignal | null | undefined;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++; signal = options?.signal;
    return new Promise<Response>(resolve => { pending.push(resolve); });
  };
  await act(async () => { for (const refresh of state.intervals) refresh(); await tick(); });
  const before = calls;
  await act(async () => { for (const refresh of state.intervals) refresh(); await tick(); });
  assert.equal(calls, before);
  await act(async () => renderer.unmount());
  assert.equal(signal?.aborted, true);
  await act(async () => { pending.forEach(finish => finish(new Response(cities))); await tick(); });
});

test('equal local vote totals sort consistently and unassigned seat winners are explicit', async t => {
  const state = setup(t);
  manifests['26'].lists.push({ ballotLetter: 'ניסיון', name: 'שם מתוך הרשימות' });
  t.after(() => { manifests['26'].lists.pop(); });
  state.setBody('שם ישוב,סמל ישוב,כשרים,ניסיון,חדש,מחל\nעיר,3000,1000,400,400,200');
  const renderer = await state.render('/localities/26?locality=3000');
  assert.match(text(renderer), /שם מתוך הרשימות/);
  assert.match(text(renderer), /ללא שיוך לגוש/);
  const rows = renderer.root.findByType('tbody').findAllByType('tr');
  assert.equal(rows[0].findAllByType('td')[0].children[0], '400');
  assert.equal(rows[1].findAllByType('td')[0].children[0], '400');
});


test('locality dropdown filters inside the popup and supports keyboard and pointer selection', async t => {
  const state = setup(t);
  const renderer = await state.render('/localities/25?locality=3000');
  const selector = () => renderer.root.findByType(LocalitySelector);
  const trigger = () => selector().findAllByType('button')[0];
  const key = async (value: string) => act(async () => {
    selector().findByProps({ role: 'combobox' }).props.onKeyDown({ key: value, preventDefault() {}, stopPropagation() {} }); await tick();
  });
  assert.equal(renderer.root.findAllByProps({ type: 'search' }).length, 0);
  await act(async () => trigger().props.onClick());
  assert.equal(selector().findAllByProps({ role: 'option' }).length, 2);
  await act(async () => selector().findByProps({ role: 'combobox' }).props.onChange({ target: { value: 'קטן' } }));
  assert.equal(selector().findAllByProps({ role: 'option' }).length, 1);
  await key('ArrowDown'); await key('ArrowUp'); await key('Enter');
  assert.match(renderer.root.findByType('output').children.join(''), /locality=2/);
  assert.equal(renderer.root.findAllByProps({ role: 'combobox' }).length, 0);
  await act(async () => trigger().props.onKeyDown({ key: 'ArrowUp', preventDefault() {} }));
  await act(async () => selector().findAllByProps({ role: 'option' })[1].props.onClick());
  assert.match(renderer.root.findByType('output').children.join(''), /locality=3000/);
  await act(async () => trigger().props.onClick());
  await key('Escape');
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
  await act(async () => trigger().props.onClick());
  await act(async () => trigger().props.onClick());
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
});


test('locality dropdown dismisses on outside click or focus loss and preserves search focus when clicking options', async t => {
  const state = setup(t);
  const inside = {};
  let focusCount = 0;
  let scrollCount = 0;
  const renderer = await state.render('/localities/25', () => ({ contains: (node: unknown) => node === inside, focus: () => focusCount++, scrollIntoView: () => scrollCount++ }));
  const selector = () => renderer.root.findByType(LocalitySelector);
  const trigger = () => selector().findAllByType('button')[0];
  const open = async () => act(async () => trigger().props.onClick());
  await open();
  await act(async () => { for (const listener of state.pointers) listener({ target: inside }); });
  assert.equal(selector().findAllByProps({ role: 'dialog' }).length, 1);
  await act(async () => { for (const listener of state.pointers) listener({ target: {} }); });
  assert.equal(selector().findAllByProps({ role: 'dialog' }).length, 0);
  await open();
  const root = selector().findByProps({ className: 'locality-selector-control' });
  await act(async () => root.props.onBlur({ currentTarget: { contains: () => true }, relatedTarget: inside }));
  assert.equal(selector().findAllByProps({ role: 'dialog' }).length, 1);
  let prevented = false;
  selector().findAllByProps({ role: 'option' })[0].props.onMouseDown({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  await act(async () => root.props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null }));
  assert.equal(selector().findAllByProps({ role: 'dialog' }).length, 0);
  await act(async () => trigger().props.onKeyDown({ key: 'ArrowDown', preventDefault() {} }));
  await act(async () => selector().findByProps({ role: 'combobox' }).props.onKeyDown({ key: 'Enter', preventDefault() {} }));
  assert.ok(focusCount > 0);
  assert.ok(scrollCount > 0);
});
