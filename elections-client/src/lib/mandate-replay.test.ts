import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import MandateReplay from '../components/MandateReplay';
import { calcVotesResults } from './calc';
import { buildCalcSteps } from './calcSteps';
import { buildMandateReplay } from './mandate-replay';
import type { ElectionConfig, VoteData } from '../types';

const votes = (totals: Record<string, number>): VoteData =>
  Object.fromEntries(Object.entries(totals).map(([party, votes]) => [party, { votes, mandats: 0 }]));

const config = { blockPercentage: .01, algorithm: 'baderOffer', agreements: [['a', 'b']] } satisfies ElectionConfig;

test('replay allocates each surplus seat once and ends at the simulator result', () => {
  const data = votes({ a: 360, b: 640, c: 1000 });
  for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
    const steps = buildCalcSteps(data, { ...config, algorithm });
    const frames = buildMandateReplay(steps);
    const awards = frames.filter(frame => frame.award);
    assert.deepEqual(frames.map(frame => frame.chapter),
      ['threshold', 'quota', 'whole', 'agreements', 'surplus', 'split', 'result']);
    assert.equal(frames[2].seatOwners.length, 119);
    assert.equal(awards.length, 1);
    assert.equal(awards[0].seatOwners.length, 120);
    assert.equal(awards[0].award?.winner.party, algorithm === 'baderOffer' ? 'a+b' : 'c');
    assert.equal(awards[0].seatOwners.at(-1), awards[0].award?.winner.party);
    assert.deepEqual(awards[0].seatOwners.slice(0, -1), frames[3].seatOwners);

    const last = frames.at(-1)!;
    const expected = calcVotesResults(data, config.blockPercentage, config.agreements, algorithm).realResults;
    for (const [party, { mandats }] of Object.entries(expected)) {
      assert.equal(last.seatOwners.filter(owner => owner === party).length, mandats);
    }
    assert.equal(last.seatOwners.at(-1), algorithm === 'baderOffer' ? 'b' : 'c');
  }
});

test('replay preserves whole seats, the order of repeated awards, and zero qualifying lists', () => {
  const data = votes({ a: 109, b: 234, c: 387, d: 321, e: 98, f: 2 });
  for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
    const options = { ...config, algorithm, agreements: [] };
    const steps = buildCalcSteps(data, options);
    const frames = buildMandateReplay(steps);
    const awards = frames.filter(frame => frame.award);
    assert.ok(awards.length > 1);
    assert.equal(awards.length, steps.remainingMandats);
    for (const [index, frame] of awards.entries()) {
      assert.equal(frame.seatOwners.length, steps.totalWhole + index + 1);
      assert.deepEqual(frame.seatOwners.slice(0, -1), (awards[index - 1] ?? frames[2]).seatOwners);
    }
    assert.deepEqual(buildMandateReplay(buildCalcSteps(data, { ...options, blockPercentage: 1 })), [
      { chapter: 'threshold', allocation: [], seatOwners: [] },
    ]);
  }

  const zeroSeatMember = buildCalcSteps(votes({ a: 1, b: 100, c: 999 }), { ...config, blockPercentage: 0 });
  const memberFrames = buildMandateReplay(zeroSeatMember);
  assert.equal(memberFrames.find(frame => frame.award?.winner.party === 'a+b')?.seatOwners.at(-1), 'a+b');
  assert.equal(memberFrames.at(-1)?.seatOwners[zeroSeatMember.totalWhole], 'b');
  assert.equal(memberFrames.at(-1)?.seatOwners.includes('a'), false);

  const onlyGroup = buildCalcSteps(votes({ a: 360, b: 640 }), config);
  const award = buildMandateReplay(onlyGroup).find(frame => frame.award)?.award;
  assert.equal(award?.winner.party, 'a+b');
  assert.equal(award?.runnerUp, undefined);
});

test('replay can pause, seek, resume, replay and close', async () => {
  const callbacks = new Map<number, () => void>();
  let timer = 0;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setTimeout: (fn: () => void) => { callbacks.set(++timer, fn); return timer; },
    clearTimeout: (id: number) => callbacks.delete(id),
  } });
  const steps = buildCalcSteps(votes({ a: 360, b: 640, c: 1000 }), config);
  let renderer!: ReturnType<typeof create>;
  let focused = false;
  const view = (data = steps) => React.createElement(MandateReplay, { steps: data, getPartyName: party => party });
  const click = (text: string) => act(async () => {
    const button = renderer.root.findAllByType('button').find(node => JSON.stringify(node.children.map(child =>
      typeof child === 'string' ? child : child.children)).includes(text))!;
    button.props.onClick();
  });
  const seek = (index: number) => act(async () => renderer.root.findByType('input').props.onChange({ target: { value: String(index) } }));
  const current = () => renderer.root.findByType('input').props.value;
  const advance = () => act(async () => callbacks.get(timer)!());
  try {
    await act(async () => { renderer = create(view(), { createNodeMock: () => ({ focus: () => { focused = true; } }) }); });
    await click('הפעלת ההדמיה');
    assert.equal(focused, true);
    assert.equal(callbacks.size, 1);
    await advance();
    assert.equal(current(), 1);
    await click('השהיה');
    assert.equal(callbacks.size, 0);
    await click('הבא');
    assert.equal(current(), 2);
    await click('הקודם');
    assert.equal(current(), 1);
    await seek(4);
    assert.equal(renderer.root.findAllByProps({ className: 'is-awarded' }).length, 1);
    await click('המשך');
    await advance();
    assert.equal(current(), 5);
    await advance();
    assert.equal(current(), 6);
    assert.equal(callbacks.size, 0);
    await click('מההתחלה');
    assert.equal(current(), 0);
    await click('סגירת ההדמיה');
    assert.equal(callbacks.size, 0);

    const tie = buildCalcSteps(votes({ a: 500, b: 500, c: 500, d: 1 }), { ...config, agreements: [], blockPercentage: 0 });
    await act(async () => renderer.update(view(tie)));
    await click('הפעלת ההדמיה');
    await seek(3);
    assert.match(JSON.stringify(renderer.toJSON()), /המודדים שווים/);
    await click('סגירת ההדמיה');

    const belowThreshold = buildCalcSteps(votes({ a: 400, b: 500, c: 1 }), config);
    await act(async () => renderer.update(view(belowThreshold)));
    await click('הפעלת ההדמיה');
    assert.match(JSON.stringify(renderer.toJSON()), /מתחת לסף/);
    assert.equal(renderer.root.findAllByType('li').length, 2);
    await click('סגירת ההדמיה');

    const oneCandidate = buildCalcSteps(votes({ a: 360, b: 640 }), config);
    await act(async () => renderer.update(view(oneCandidate)));
    await click('הפעלת ההדמיה');
    assert.equal(renderer.root.findAllByType('li').length, 1);
    await seek(4);
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /הבא בתור/);
    await click('סגירת ההדמיה');

    const largestRemainders = buildCalcSteps(votes({ a: 360, b: 640, c: 1000 }), { ...config, algorithm: 'ceilRound', agreements: [['a', 'b'], ['a', 'missing']] });
    await act(async () => renderer.update(view(largestRemainders)));
    await click('הפעלת ההדמיה');
    await seek(3);
    assert.match(JSON.stringify(renderer.toJSON()), /ההסכם בוטל בגלל אחוז החסימה/);
    await seek(4);
    assert.match(JSON.stringify(renderer.toJSON()), /שארית הקולות הגבוהה ביותר/);
    await click('סגירת ההדמיה');

    const none = buildCalcSteps(votes({ a: 360, b: 640 }), { ...config, blockPercentage: .9 });
    await act(async () => renderer.update(view(none)));
    await click('הפעלת ההדמיה');
    assert.equal(renderer.root.findByType('input').props.disabled, true);
    assert.match(JSON.stringify(renderer.toJSON()), /אף רשימה לא עברה/);
    assert.equal(callbacks.size, 0);
  } finally {
    await act(async () => renderer?.unmount());
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
