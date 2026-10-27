import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import ResultsTimestamp from '../components/ResultsTimestamp';

const render = (time?: string) => renderToStaticMarkup(createElement(ResultsTimestamp, { time }));

test('shows the result snapshot date and time in Israel, including crossing midnight', () => {
  const html = render('2026-10-27T22:13:19.926Z');
  assert.match(html, /עדכון התוצאות האחרון:/);
  assert.match(html, /datetime="2026-10-27T22:13:19.926Z"/i);
  assert.match(html, /28.10.2026/);
  assert.match(html, /00:13/);
  assert.match(html, /שעון ישראל/);
  assert.match(render('2026-07-01T12:03:00Z'), /15:03/);
});

test('omits missing and malformed timestamps', () => {
  for (const time of [undefined, '', 'invalid']) assert.equal(render(time), '');
});

test('updates the label when a new result snapshot arrives', () => {
  const renderer = create(createElement(ResultsTimestamp, { time: '2026-10-27T22:13:19Z' }));
  act(() => renderer.update(createElement(ResultsTimestamp, { time: '2026-10-27T22:14:20Z' })));
  assert.equal(renderer.root.findByType('time').props.dateTime, '2026-10-27T22:14:20Z');
  assert.match(renderer.root.findByType('bdi').children.join(''), /00:14/);
  act(() => renderer.unmount());
});
