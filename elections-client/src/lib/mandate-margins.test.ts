import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import MandateMargins from '../components/MandateMargins';
import type { SeatRace } from './proximity';

const races: SeatRace[] = [
  { party: 'א', mandats: 7, gain: 45, lose: 10, loseCrossesThreshold: true },
  { party: 'ב', mandats: 5, gain: 20, lose: 60, loseCrossesThreshold: false },
  { party: 'ג', mandats: 108, gain: null, lose: null, loseCrossesThreshold: false },
];
const props = { races, limit: 10, getPartyName: (party: string) => `רשימה ${party}` };

test('mandate margins rank by the closest change or the chosen direction and keep a shared scale', () => {
  const renderer = create(React.createElement(MandateMargins, props));
  const rows = () => renderer.root.findByType('tbody').findAllByType('tr');
  const names = () => rows().map(row => row.findByType('th').findByType('strong').children.join(''));
  const readout = () => renderer.root.findByProps({ className: 'mandate-margin-readout' }).children.join('');
  const choose = (label: string) => act(() => {
    renderer.root.findAllByType('button').find(button => button.children.includes(label))!.props.onClick();
  });

  assert.deepEqual(names(), ['רשימה א', 'רשימה ב', 'רשימה ג']);
  assert.equal(readout(), '−10');
  assert.equal(rows()[0].findByProps({ className: 'mandate-threshold-loss' }).children.join(''), 'ירידה מתחת לאחוז החסימה');
  const distances = rows().flatMap(row => row.findAllByProps({ className: 'mandate-margin-bar' })
    .map(bar => Number.parseFloat(bar.props.style['--margin-width'])));
  assert.deepEqual(distances.map(Math.round), [75, 17, 33, 100]);
  assert.equal(rows()[2].findAllByProps({ className: 'mandate-margin-bar' }).length, 0);
  assert.deepEqual(rows()[2].findAllByType('td').map(cell => cell.findByType('bdi').children.join('')), ['—', '—']);
  assert.equal(renderer.root.findByType('tbody').findAllByType('button').length, 0);

  choose('לתוספת');
  assert.deepEqual(names(), ['רשימה ב', 'רשימה א', 'רשימה ג']);
  assert.equal(readout(), '+20');
  choose('לאובדן');
  assert.deepEqual(names(), ['רשימה א', 'רשימה ב', 'רשימה ג']);
  choose('הכי קרובות');
  renderer.update(React.createElement(MandateMargins, { ...props, races: [{ ...races[1], gain: 1 }, races[0]] }));
  assert.equal(readout(), '+1');
  renderer.update(React.createElement(MandateMargins, { ...props, races: [races[2]] }));
  assert.equal(renderer.root.findByProps({ className: 'mandate-margin-lead' }).findByType('p').children.join(''), 'אין מרחק מחושב בכיוון הזה.');
  renderer.update(React.createElement(MandateMargins, { ...props, races: [] }));
  assert.equal(renderer.root.findAllByType('table').length, 0);
  assert.equal(renderer.root.findByType('p').children.join(''), 'אין רשימות להצגה.');
  renderer.unmount();
});

test('simulator margin buttons apply the exact signed vote change and leave unavailable actions inert', () => {
  const changes: [string, number][] = [];
  const renderer = create(React.createElement(MandateMargins, { ...props,
    onVoteDelta: (party, delta) => changes.push([party, delta]),
  }));
  const row = renderer.root.findByType('tbody').findAllByType('tr')[0];
  row.findByProps({ 'aria-label': 'הוסף 45 קולות לרשימה א' }).props.onClick();
  row.findByProps({ 'aria-label': 'הפחת 10 קולות מרשימה א' }).props.onClick();
  assert.deepEqual(changes, [['א', 45], ['א', -10]]);
  assert.equal(renderer.root.findByType('tbody').findAllByType('tr')[2].findAllByType('button').length, 0);
  renderer.unmount();
});
