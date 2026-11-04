import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import QuestionInput from '../components/QuestionInput';
import type { QuestionContext } from './election-questions';

const context: QuestionContext = { electionId: '26', votes: { א: { votes: 999, mandats: 0 }, ב: { votes: 1, mandats: 0 } }, names: { א: 'רשימה א', ב: 'רשימה ב' }, config: { algorithm: 'baderOffer', agreements: [], blockPercentage: .0325 } };

test('completion keeps one editable textbox, supports pointer, arrows, Escape and free Enter', () => {
  let renderer!: ReturnType<typeof create>; let value = ''; let focused = 0;
  const update = () => renderer.update(React.createElement(QuestionInput, { value, onChange: change, context, busy: false, disabled: false }));
  const change = (next: string) => { value = next; update(); };
  act(() => { renderer = create(React.createElement(QuestionInput, { value, onChange: change, context, busy: false, disabled: false }),
    { createNodeMock: element => element.type === 'input' ? { focus() { focused++; } } : { scrollIntoView() {} } }); });
  const input = () => renderer.root.findByType('input');
  const options = () => renderer.root.findAllByProps({ role: 'option' });
  const key = (key: string, composing = false) => {
    let prevented = false;
    act(() => input().props.onKeyDown({ key, nativeEvent: { isComposing: composing }, preventDefault() { prevented = true; } }));
    return prevented;
  };
  try {
    act(() => input().props.onFocus());
    assert.equal(options().length, 5);
    assert.equal(input().props['aria-expanded'], true);
    assert.equal(key('Enter'), false, 'Enter does not select an unhighlighted suggestion');
    assert.equal(key('ArrowDown'), true); assert.ok(input().props['aria-activedescendant']);
    assert.equal(key('Enter', true), false, 'IME composition is not intercepted');
    assert.equal(key('Enter'), true); assert.equal(value, 'כמה קולות חסרים ל');
    assert.equal(options().length, 2); assert.ok(focused);
    act(() => options()[1].props.onClick()); assert.equal(value, 'כמה קולות חסרים לרשימה ב');
    assert.equal(options()[0].findAllByType('span')[0].children[0], 'לעבור את אחוז החסימה');
    act(() => options()[0].props.onClick()); assert.equal(options().length, 0);
    assert.equal(key('Enter'), false, 'complete question submits normally');
    act(() => input().props.onChange({ target: { value: 'כמה קולות חסרים לרשימה א' } }));
    assert.equal(options()[0].findAllByType('span')[0].children[0], 'למנדט נוסף');
    key('Escape'); assert.equal(input().props['aria-expanded'], false);
    act(() => input().props.onFocus()); assert.equal(options().length, 1);
    const root = renderer.root.findByProps({ className: 'question-composer' });
    act(() => root.props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null }));
    assert.equal(input().props['aria-expanded'], false);
    act(() => input().props.onChange({ target: { value: 'טקסט חופשי' } }));
    assert.equal(options().length, 0); assert.equal(key('Enter'), false);
    act(() => renderer.update(React.createElement(QuestionInput, { value, onChange: change, context, busy: false, disabled: true })));
    assert.equal(input().props.disabled, true);
  } finally { act(() => renderer.unmount()); }
});
