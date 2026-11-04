import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import QuestionInput from '../components/QuestionInput';
import SearchableSelect from '../components/SearchableSelect';
import QuestionNumberChip from '../components/QuestionNumberChip';
import type { QuestionContext } from './election-questions';

import { createQuestionCompletions } from './question-completions';

const context: QuestionContext = { electionId: '26', votes: { א: { votes: 999, mandats: 0 }, ב: { votes: 1, mandats: 0 } }, names: { א: 'רשימה א', ב: 'רשימה ב' }, config: { algorithm: 'baderOffer', agreements: [], blockPercentage: .0325 } };

test('completion keeps one editable textbox, supports pointer, arrows, Escape and free Enter', () => {
  let renderer!: ReturnType<typeof create>; let value = ''; let focused = 0;
  const update = () => renderer.update(React.createElement(QuestionInput, { value, onChange: change, context, busy: false, disabled: false }));
  const change = (next: string) => { value = next; update(); };
  act(() => { renderer = create(React.createElement(QuestionInput, { value, onChange: change, context, busy: false, disabled: false }),
    { createNodeMock: element => element.type === 'input' ? { focus() { focused++; } } : { scrollIntoView() {} } }); });
  const rootCount = createQuestionCompletions(context)('').options.length;
  const input = () => renderer.root.findByType('input');
  const options = () => renderer.root.findAllByProps({ role: 'option' });
  const key = (key: string, composing = false) => {
    let prevented = false;
    act(() => input().props.onKeyDown({ key, nativeEvent: { isComposing: composing }, preventDefault() { prevented = true; } }));
    return prevented;
  };
  try {
    act(() => input().props.onFocus());
    assert.equal(options().length, rootCount);
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

test('dropdown toggle, focus, pointer selection and submit preserve native form behavior', () => {
  let renderer!: ReturnType<typeof create>;
  let value = ''; let focused = 0; let prevented = false;
  const change = (next: string) => { value = next; render(); };
  const render = (extra: { context?: QuestionContext; busy?: boolean; disabled?: boolean } = {}) => renderer.update(
    React.createElement(QuestionInput, { value, onChange: change, context, busy: false, disabled: false, ...extra }));
  act(() => { renderer = create(React.createElement(QuestionInput, { value, onChange: change, context, busy: false, disabled: false }),
    { createNodeMock: element => element.type === 'input' ? { focus() { focused++; } } : { scrollIntoView() {} } }); });
  const rootCount = createQuestionCompletions(context)('').options.length;
  const input = () => renderer.root.findByType('input');
  const toggle = () => renderer.root.findByProps({ className: 'ui-button ui-button-quiet question-suggest-toggle' });
  const options = () => renderer.root.findAllByProps({ role: 'option' });
  const key = (key: string) => act(() => input().props.onKeyDown({ key, preventDefault() {} }));
  try {
    act(() => toggle().props.onClick()); assert.equal(options().length, rootCount); assert.equal(focused, 1);
    act(() => toggle().props.onClick()); assert.equal(options().length, 0);
    act(() => input().props.onClick()); assert.equal(options().length, rootCount);
    key('ArrowUp'); assert.ok(input().props['aria-activedescendant'].endsWith(`option-${rootCount - 1}`));
    key('ArrowDown'); key('ArrowDown'); key('ArrowUp');
    act(() => options()[0].props.onMouseDown({ preventDefault() { prevented = true; } }));
    assert.equal(prevented, true);
    const root = renderer.root.findByProps({ className: 'question-composer' });
    act(() => root.props.onBlur({ currentTarget: { contains: () => true }, relatedTarget: {} }));
    assert.equal(options().length, rootCount, 'moving focus within the composer keeps suggestions');
    act(() => renderer.root.findByProps({ type: 'submit' }).props.onClick());
    assert.equal(options().length, 0);
    act(() => render({ busy: true })); assert.equal(renderer.root.findByProps({ type: 'submit' }).props.disabled, true);
    act(() => render({ context: undefined })); assert.equal(toggle().props.disabled, true);
    act(() => input().props.onFocus()); assert.equal(options().length, 0);
    act(() => render());
    key('Escape'); key('ArrowUp');
    act(() => render({ context: { ...context, electionId: '1' } }));
    assert.equal(input().props['aria-activedescendant'], undefined, 'stale selection is cleared when available options shrink');
    act(() => render({ context: undefined })); key('ArrowDown');
    act(() => render({ disabled: true })); assert.equal(input().props['aria-expanded'], false);
  } finally { act(() => renderer.unmount()); }
});

test('names are editable inline chips, with a full text escape hatch and Enter submission', () => {
  let renderer!: ReturnType<typeof create>; let value = 'כמה קולות קיבלה רשימה א'; let submissions = 0;
  const props = () => ({ value, context, busy: false, disabled: false, onChange: (next: string) => { value = next; renderer.update(React.createElement(QuestionInput, props())); } });
  act(() => { renderer = create(React.createElement(QuestionInput, props()), { createNodeMock: element => element.type === 'input'
    ? { focus() {}, form: { requestSubmit() { submissions++; } } } : { focus() {}, scrollIntoView() {} } }); });
  try {
    const select = renderer.root.findByType(SearchableSelect);
    assert.equal(select.props.variant, 'chip'); assert.equal(select.props.value, 'א');
    act(() => select.props.onChange('ב'));
    assert.equal(value, 'כמה קולות קיבלה רשימה ב');
    const preview = renderer.root.findByProps({ className: 'question-tokenized' });
    const target = {};
    act(() => preview.props.onKeyDown({ key: 'Enter', target, currentTarget: target, preventDefault() {} }));
    assert.equal(submissions, 1);
    act(() => renderer.root.findByProps({ className: 'ui-button ui-button-quiet question-edit-text' }).props.onClick());
    assert.equal(renderer.root.findByType('input').props.hidden, false);
    act(() => renderer.root.findByType('input').props.onChange({ target: { value: 'שאלה אחרת' } }));
    assert.equal(value, 'שאלה אחרת');
    assert.equal(renderer.root.findAllByType(SearchableSelect).length, 0);
  } finally { act(() => renderer.unmount()); }
});

test('tokenized completion keeps focus, opens suggestions, and name-loading failures can retry', () => {
  let renderer!: ReturnType<typeof create>; let value = 'כמה קולות קיבלה רשימה א'; let retried = false;
  const props = () => ({ value, context, busy: false, disabled: false, placesError: true, retryPlaces: () => { retried = true; },
    onChange: (next: string) => { value = next; renderer.update(React.createElement(QuestionInput, props())); } });
  act(() => { renderer = create(React.createElement(QuestionInput, props()), { createNodeMock: () => ({ focus() {}, scrollIntoView() {} }) }); });
  try {
    act(() => renderer.root.findAllByType('button').find(button => button.children.includes('ניסיון נוסף'))!.props.onClick());
    assert.equal(retried, true);
    const toggle = renderer.root.findByProps({ className: 'ui-button ui-button-quiet question-suggest-toggle' });
    act(() => toggle.props.onClick());
    act(() => renderer.update(React.createElement(QuestionInput, { ...props(), value: '' })));
    act(() => renderer.root.findByType('input').props.onFocus());
    act(() => renderer.root.findAllByProps({ role: 'option' })[0].props.onClick());
    act(() => renderer.root.findAllByProps({ role: 'option' })[0].props.onClick());
    assert.ok(renderer.root.findByProps({ className: 'question-tokenized' }));
  } finally { act(() => renderer.unmount()); }
});


test('a number chip updates only its numeric span and stays in structured editing mode', () => {
  let renderer!: ReturnType<typeof create>; let value = 'מה היה קורה אם רשימה א הייתה מקבלת 500 פחות קולות';
  const props = () => ({ value, context, busy: false, disabled: false, onChange: (next: string) => { value = next; renderer.update(React.createElement(QuestionInput, props())); } });
  act(() => { renderer = create(React.createElement(QuestionInput, props())); });
  try {
    assert.equal(renderer.root.findByType(QuestionNumberChip).props.value, '500');
    act(() => renderer.root.findByType(QuestionNumberChip).props.onChange('1,000'));
    assert.equal(value, 'מה היה קורה אם רשימה א הייתה מקבלת 1,000 פחות קולות');
    assert.ok(renderer.root.findByProps({ className: 'question-tokenized' }));
  } finally { act(() => renderer.unmount()); }
});
