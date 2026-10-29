import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import ElectionSelector from '../components/ElectionSelector';
import AppHeader from '../components/AppHeader';
import PartyRow from '../components/PartyRow';
import ThemeToggle from '../components/ThemeToggle';

const key = (name: string) => ({ key: name, preventDefault() {} });

test('election selector supports keyboard, pointer, focus, wrapping and disabled states', async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let frame = () => {};
  const listeners = new Map<string, (event: unknown) => void>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { requestAnimationFrame: (callback: () => void) => { frame = callback; return 1; }, cancelAnimationFrame() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener: (name: string, callback: (event: unknown) => void) => listeners.set(name, callback), removeEventListener: (name: string) => listeners.delete(name) } });
  const selected: string[] = [];
  const focused: string[] = [];
  const inside = {};
  const props = { value: '25', elections: ['26', '25', '24'], onChange: (election: string) => selected.push(election) };
  let renderer!: ReturnType<typeof create>;
  const trigger = () => renderer.root.findByProps({ className: 'election-selector-trigger' });
  const options = () => renderer.root.findAllByProps({ role: 'option' });
  const active = () => options().find(option => option.props.tabIndex === 0)!.children[0];
  const press = async (name: string, index = 0) => act(async () => options()[index].props.onKeyDown(key(name)));
  try {
    await act(async () => { renderer = create(React.createElement(ElectionSelector, props), { createNodeMock: element => element.type === 'div' ? { contains: (target: unknown) => target === inside } : { focus: () => focused.push(String((element.props as { role?: string }).role || 'trigger')) } }); });
    await act(async () => trigger().props.onClick());
    frame(); assert.deepEqual(focused, ['option']);
    assert.equal(options()[1].props.tabIndex, 0);
    await press('ArrowUp'); assert.equal(options()[2].props.tabIndex, 0);
    await press('ArrowDown', 2); assert.equal(options()[0].props.tabIndex, 0);
    await press('End'); assert.equal(options()[2].props.tabIndex, 0);
    await press('Home'); assert.equal(options()[0].props.tabIndex, 0);
    await press('Enter'); assert.ok(active());
    await act(async () => options()[1].props.onFocus()); assert.equal(options()[1].props.tabIndex, 0);
    await act(async () => options()[2].props.onClick());
    assert.deepEqual(selected, ['24']); assert.equal(options().length, 0); assert.ok(focused.includes('trigger'));
    await act(async () => trigger().props.onKeyDown(key('ArrowUp'))); assert.equal(options()[2].props.tabIndex, 0);
    await press('Escape'); assert.equal(options().length, 0);
    await act(async () => trigger().props.onKeyDown(key('ArrowDown'))); assert.equal(options()[1].props.tabIndex, 0);
    await act(async () => trigger().props.onKeyDown(key('Enter'))); assert.equal(options().length, 3);
    await act(async () => listeners.get('pointerdown')!({ target: inside })); assert.equal(options().length, 3);
    await act(async () => listeners.get('pointerdown')!({ target: {} })); assert.equal(options().length, 0);
    await act(async () => trigger().props.onClick());
    await act(async () => trigger().props.onClick()); assert.equal(options().length, 0);
    await act(async () => trigger().props.onClick());
    const root = renderer.root.findByProps({ className: 'election-control' });
    await act(async () => root.props.onBlur({ currentTarget: { contains: () => true }, relatedTarget: inside })); assert.equal(options().length, 3);
    await act(async () => root.props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null })); assert.equal(options().length, 0);
    await act(async () => trigger().props.onClick());
    await act(async () => renderer.update(React.createElement(ElectionSelector, { ...props, disabled: true }))); assert.equal(options().length, 0); assert.equal(trigger().props.disabled, true);
    await act(async () => renderer.update(React.createElement(ElectionSelector, { ...props, value: null, elections: [] }))); assert.equal(trigger().props.disabled, true);
    assert.match(JSON.stringify(renderer.toJSON()), /בחירת כנסת/);
  } finally {
    await act(async () => renderer?.unmount());
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  }
});

test('theme toggles remain usable when storage fails and preserve the selected theme when storage succeeds', async () => {
  const originals = [Object.getOwnPropertyDescriptor(globalThis, 'document'), Object.getOwnPropertyDescriptor(globalThis, 'localStorage')];
  const dataset = { theme: 'dark' };
  const stored: string[] = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset } } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem: (_key: string, value: string) => stored.push(value) } });
  const renderer = create(React.createElement(ThemeToggle));
  try {
    assert.equal(renderer.root.findByType('button').props['aria-checked'], true);
    await act(async () => renderer.root.findByType('button').props.onClick()); assert.equal(dataset.theme, 'light'); assert.deepEqual(stored, ['light']);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem: () => { throw new Error('disabled'); } } });
    await act(async () => renderer.root.findByType('button').props.onClick()); assert.equal(dataset.theme, 'dark');
  } finally {
    renderer.unmount();
    for (const [index, name] of ['document', 'localStorage'].entries()) {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
    }
  }
});

test('header retains navigation, status and action content in research and summary modes', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: {} } } });
  const chosen: string[] = [];
  const props = { statusText: 'status', statusAction: 'timestamp', actions: 'share', resultsOverview: 'overview', showSimulator: false, isEdited: true, currentElection: '25', setCurrentElection: () => {}, availableElections: ['25'], viewMode: 'summary' as const, setViewMode: (mode: string) => chosen.push(mode) };
  const renderer = create(React.createElement(AppHeader, props));
  try {
    const markup = JSON.stringify(renderer.toJSON());
    for (const value of ['status', 'timestamp', 'share', 'overview', 'נתונים נערכו']) assert.ok(markup.includes(value));
    assert.ok(!markup.includes('סימולטור'));
    assert.equal(renderer.root.findByType(ElectionSelector).props.disabled, true);
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('מחקר מפלגות'))!.props.onClick());
    assert.deepEqual(chosen, ['research']);
  } finally {
    renderer.unmount();
    if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('party rows retain historical and counting data with or without research links', () => {
  const base = { name: 'List', seats: 30, votes: 100 };
  const renderer = create(React.createElement(MemoryRouter, {}, React.createElement(PartyRow, { ...base, ballotLetter: 'א', bar: { width: 50, color: 'red' } })));
  assert.equal(renderer.root.findAllByType('a').length, 0);
  assert.match(JSON.stringify(renderer.toJSON()), /אותיות בקלפי: א/);
  renderer.update(React.createElement(MemoryRouter, {}, React.createElement(PartyRow, { ...base, electionNight: true, percentage: '25%', researchHref: '/research/25?party=א' })));
  assert.equal(renderer.root.findByType('a').props.href, '/research/25?party=א');
  assert.match(JSON.stringify(renderer.toJSON()), /25%/);
  renderer.update(React.createElement(MemoryRouter, {}, React.createElement(PartyRow, { ...base, electionNight: true })));
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /25%/);
  renderer.unmount();
});
