import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { questionEntities, replaceQuestionEntity } from './question-entities';
import { numberReplacement, type QuestionNumber } from './question-number';
import QuestionNumberChip from '../components/QuestionNumberChip';
import type { QuestionContext } from './election-questions';

const context: QuestionContext = { electionId: '26', votes: { א: { votes: 10000, mandats: 100 }, ב: { votes: 2000, mandats: 20 } },
  names: { א: 'הליכוד', ב: 'רשימה ב' }, config: { blockPercentage: .0325, algorithm: 'baderOffer', agreements: [] } };
const counts: QuestionNumber = { percent: false, suffix: '', min: 0, max: Number.MAX_SAFE_INTEGER, positive: false, label: 'מספר קולות' };
const percent: QuestionNumber = { ...counts, percent: true, suffix: '%', max: 100, label: 'אחוז' };

test('number chips preserve thousands/percent spans and exclude digits inside a list name', () => {
  const input = 'מה היה קורה אם הליכוד הייתה מקבלת 10,000 פחות קולות';
  const numbers = questionEntities(input, context).filter(entity => entity.kind === 'number');
  assert.equal(numbers.length, 1); assert.equal(numbers[0].label, '10,000'); assert.equal(numbers[0].numeric!.min, 1);
  assert.equal(replaceQuestionEntity(input, numbers[0], '5,000', context), 'מה היה קורה אם הליכוד הייתה מקבלת 5,000 פחות קולות');
  const transfer = questionEntities('מה היה קורה אם הליכוד מקבלת 50% מהקולות של רשימה ב', context).find(entity => entity.kind === 'number')!;
  assert.equal(transfer.numeric!.positive, true); assert.equal(transfer.numeric!.suffix, '%');
  assert.equal(questionEntities('מה היה קורה אם אחוז החסימה היה 2.5 אחוזים', context).find(entity => entity.kind === 'number')!.numeric!.percent, true);
  const ranking = questionEntities('באילו 5 יישובים היה הכי צמוד עם לפחות 1,000 קולות כשרים', context).filter(entity => entity.kind === 'number');
  assert.equal(ranking[0].numeric!.max, 100); assert.equal(ranking[1].numeric!.label, 'מינימום קולות');
  assert.equal(questionEntities('בכמה קולות עלתה הליכוד לעומת הכנסת 25', context).find(entity => entity.kind === 'number')!.numeric!.max, 25);
  assert.equal(questionEntities('כמה קולות קיבלה רשימה 2026', { ...context, names: { א: 'רשימה 2026', ב: 'רשימה ב' } }).filter(entity => entity.kind === 'number').length, 0);
  assert.ok(questionEntities('שאלה על 42', { ...context, electionId: undefined }).some(entity => entity.kind === 'number'));
  assert.equal(questionEntities('שאלה על 42', context).find(entity => entity.kind === 'number')!.numeric!.min, 0);
});

test('numeric edits validate integer counts, decimal percentages, range limits and positive transfers', () => {
  assert.deepEqual(numberReplacement('5,000', counts), { text: '5,000' });
  assert.deepEqual(numberReplacement('2.5', percent), { text: '2.5%' });
  assert.deepEqual(numberReplacement('0', percent), { text: '0%' });
  for (const text of ['-1', '5,00', '1e3', 'abc']) assert.ok('error' in numberReplacement(text, counts));
  for (const text of ['1.5', '9007199254740992', '9'.repeat(400)]) assert.ok('error' in numberReplacement(text, counts));
  assert.ok('error' in numberReplacement('0', { ...percent, positive: true }));
  assert.ok('error' in numberReplacement('101', percent));
  assert.ok('error' in numberReplacement('0', { ...counts, min: 1, max: 100 }));
  assert.ok('error' in numberReplacement('101', { ...counts, min: 1, max: 100 }));
});

test('number editor saves from Enter without submitting, validates, cancels, and closes on focus loss or outside click', () => {
  const original = globalThis.document; let listener!: (event: unknown) => void; const changes: string[] = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener(_name: string, callback: typeof listener) { listener = callback; }, removeEventListener() {} } });
  let renderer!: ReturnType<typeof create>; let selected = false;
  act(() => { renderer = create(React.createElement(QuestionNumberChip, { value: '50%', config: percent, onChange: value => changes.push(value) }),
    { createNodeMock: () => ({ focus() {}, contains(target: unknown) { return target === 'inside'; } }) }); });
  const trigger = () => renderer.root.findByProps({ className: 'election-selector-trigger' });
  const open = () => act(() => trigger().props.onClick());
  const type = (value: string) => act(() => renderer.root.findByType('input').props.onChange({ target: { value } }));
  const key = (key: string, composing = false) => { let prevented = false; act(() => renderer.root.findByProps({ role: 'dialog' }).props.onKeyDown({ key, nativeEvent: { isComposing: composing }, preventDefault() { prevented = true; }, stopPropagation() {} })); return prevented; };
  try {
    open(); assert.equal(renderer.root.findByType('input').props.inputMode, 'decimal');
    act(() => renderer.root.findByType('input').props.onFocus({ target: { select() { selected = true; } } })); assert.equal(selected, true);
    type('101'); assert.equal(key('Enter'), true); assert.equal(changes.length, 0); assert.ok(renderer.root.findByProps({ role: 'alert' }));
    type('25'); assert.equal(key('Enter', true), false); assert.equal(key('Enter'), true); assert.deepEqual(changes, ['25%']);
    open(); type('30'); act(() => renderer.root.findAllByType('button').find(button => button.children.includes('ביטול'))!.props.onClick()); assert.equal(changes.length, 1);
    open(); key('Escape'); assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
    open(); open(); assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
    open(); act(() => listener({ target: 'inside' })); assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1);
    act(() => listener({ target: 'outside' })); assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
    open(); const root = renderer.root.findByProps({ className: 'searchable-select-control question-entity-chip question-number-chip' });
    act(() => root.props.onBlur({ currentTarget: { contains: () => true }, relatedTarget: 'inside' }));
    act(() => root.props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null }));
    open(); type('10'); act(() => renderer.root.findAllByType('button').find(button => button.children.includes('שמירה'))!.props.onClick());
    act(() => renderer.update(React.createElement(QuestionNumberChip, { value: '10,000', config: counts, onChange: value => changes.push(value) })));
    open(); assert.equal(renderer.root.findByType('input').props.inputMode, 'numeric');
  } finally { act(() => renderer.unmount()); Object.defineProperty(globalThis, 'document', { configurable: true, value: original }); }
});
