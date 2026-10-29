import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PartyResearch from '../components/PartyResearch';

const tick = () => new Promise(resolve => setImmediate(resolve));
const cities = 'שם ישוב,סמל ישוב,כשרים,מחל,אמת\nעיר,1,500,300,200';
const stations = 'שם ישוב,סמל ישוב,מספר קלפי,פיצול,כשרים,מחל,אמת\n' + Array.from({ length: 80 }, (_, i) => `עיר,1,${i + 1},${i === 0 ? 1 : 0},100,${i + 1},${99 - i}`).join('\n');
function Location() { return React.createElement('output', {}, useLocation().search); }
const content = (renderer: ReturnType<typeof create>) => {
  const flatten = (node: any): string => typeof node === 'string' ? node : Array.isArray(node) ? node.map(flatten).join('') : flatten(node?.children ?? []);
  return flatten(renderer.toJSON());
};

function setup(t: any) {
  const intervals = new Set<() => void>();
  const document = { documentElement: { dataset: {} }, visibilityState: 'visible' };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setInterval: (callback: () => void) => { intervals.add(callback); return callback; }, clearInterval: (callback: () => void) => intervals.delete(callback) } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  const previousFetch = globalThis.fetch;
  let renderer: ReturnType<typeof create>;
  t.after(async () => {
    await act(async () => renderer?.unmount());
    globalThis.fetch = previousFetch;
    for (const [key, descriptor] of [['window', previousWindow], ['document', previousDocument]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key];
    }
  });
  return {
    intervals, document,
    async render(url: string) {
      await act(async () => {
        renderer = create(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Routes, {},
          React.createElement(Route, { path: '/research/:electionId', element: React.createElement(React.Fragment, {}, React.createElement(PartyResearch), React.createElement(Location)) }))));
        await tick();
      });
      return renderer!;
    },
  };
}

for (const election of ['19', '26']) test(`station research selects, paginates, filters and preserves share links for election ${election}`, async t => {
  const state = setup(t);
  const requests: string[] = [];
  globalThis.fetch = async (url, options) => {
    requests.push(`${options?.method ?? 'GET'} ${url}`);
    return new Response(String(url).includes('polling-stations') || election === '19' ? (election === '26' ? stations.replace('מספר קלפי', 'קלפי') : stations) : cities, { headers: { 'content-type': 'text/csv', 'last-modified': 'Wed, 28 Oct 2026 20:00:00 GMT' } });
  };
  const renderer = await state.render(`/research/${election}?party=אמת&level=stations`);
  const button = (label: string) => renderer.root.findAllByType('button').find(node => node.children.includes(label))!;
  const rows = (index: number) => renderer.root.findAllByType('tbody')[index].findAllByType('tr');
  assert.equal(button('לפי קלפיות').props['aria-pressed'], true);
  assert.equal(rows(0).length, 20);
  assert.equal(renderer.root.findAllByType('thead')[0].findAllByType('th').length, 5);
  assert.match(content(renderer), /פיצול 1/);
  assert.match(content(renderer), /בכל קלפי/);
  assert.equal(renderer.root.findByType('select').props.value, 'אמת');
  if (election === '26') assert.ok(requests.includes('GET /data/26/polling-stations.csv'));
  else assert.ok(requests.every(request => request === 'GET /data/19/elections.csv'));
  const more = renderer.root.findByProps({ 'aria-label': 'הצגת קלפיות נוספות לפי מספר קולות' });
  await act(async () => more.props.onClick());
  assert.equal(rows(0).length, 70);
  assert.equal(rows(1).length, 20);
  await act(async () => renderer.root.findByProps({ 'aria-label': 'הצגת קלפיות נוספות לפי אחוז התמיכה' }).props.onClick());
  assert.equal(rows(1).length, 70);
  await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: 'מחל' } }));
  assert.equal(rows(0).length, 20);
  assert.match(renderer.root.findByType('output').children.join(''), /level=stations/);
  assert.match(renderer.root.findByType('output').children.join(''), /party=/);
  await act(async () => renderer.root.findByProps({ type: 'number' }).props.onChange({ target: { value: '101' } }));
  assert.match(content(renderer), /אין קלפיות התואמות לסינון/);
  await act(async () => { button('לפי יישובים').props.onClick(); await tick(); });
  assert.equal(renderer.root.findByProps({ type: 'number' }).props.value, 0);
  assert.doesNotMatch(renderer.root.findByType('output').children.join(''), /level=/);
  assert.equal(renderer.root.findByType('select').props.value, 'מחל');
  assert.equal(rows(0).length, 1);
  assert.equal(renderer.root.findAllByType('thead')[0].findAllByType('th').length, 4);
  await act(async () => { button('לפי קלפיות').props.onClick(); await tick(); });
  assert.equal(rows(0).length, 20);
});

for (const unavailable of ['missing', 'html', 'network']) test(`optional station archive does not expose an unusable toggle (${unavailable})`, async t => {
  const state = setup(t);
  globalThis.fetch = async (_url, options) => {
    if (options?.method === 'HEAD') {
      if (unavailable === 'network') throw new Error('Offline');
      return new Response(null, { status: unavailable === 'missing' ? 404 : 200, headers: { 'content-type': 'text/html' } });
    }
    return new Response(cities);
  };
  const renderer = await state.render('/research/25?level=stations&party=מחל');
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'יחידת המחקר' }).length, 0);
  assert.equal(renderer.root.findAllByType('table').length, 2);
  assert.match(content(renderer), /בכל יישוב/);
});

test('station counting refresh preserves data on failure and discovers a newly published archive', async t => {
  const state = setup(t);
  let exists = false;
  let fail = false;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (options?.method === 'HEAD') return new Response(null, { status: exists ? 200 : 404, headers: { 'content-type': 'text/csv' } });
    return new Response(String(url).includes('polling-stations') ? stations : cities, { status: fail ? 503 : 200 });
  };
  const renderer = await state.render('/research/26?level=stations');
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'יחידת המחקר' }).length, 0);
  const before = calls;
  state.document.visibilityState = 'hidden';
  await act(async () => { for (const refresh of [...state.intervals]) refresh(); await tick(); });
  assert.equal(calls, before);
  state.document.visibilityState = 'visible'; exists = true;
  await act(async () => { for (const refresh of [...state.intervals]) refresh(); await tick(); });
  assert.match(content(renderer), /בכל קלפי/);
  fail = true; exists = false;
  await act(async () => { for (const refresh of [...state.intervals]) refresh(); await tick(); });
  assert.match(content(renderer), /מוצגים הנתונים האחרונים/);
  assert.equal(renderer.root.findAllByType('table').length, 2);
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'יחידת המחקר' }).length, 1);
  fail = false;
  await act(async () => { renderer.root.findAllByType('button').find(button => button.children.includes('ניסיון נוסף'))!.props.onClick(); await tick(); });
  assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0);
});

test('availability checks deduplicate in-flight probes and ignore responses after unmount', async t => {
  const state = setup(t);
  let complete!: (response: Response) => void;
  let signal: AbortSignal;
  let probes = 0;
  globalThis.fetch = async (_url, options) => {
    if (options?.method !== 'HEAD') return new Response(cities);
    probes++; signal = options.signal as AbortSignal;
    return new Promise<Response>(resolve => { complete = resolve; });
  };
  const renderer = await state.render('/research/26');
  const initialProbes = probes;
  await act(async () => { for (const refresh of [...state.intervals]) refresh(); await tick(); });
  assert.equal(probes, initialProbes);
  await act(async () => renderer.unmount());
  assert.equal(signal!.aborted, true);
  await act(async () => { complete(new Response(null, { headers: { 'content-type': 'text/csv' } })); await tick(); });
});
