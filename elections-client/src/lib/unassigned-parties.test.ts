import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import UnassignedParties from '../components/UnassignedParties';

const render = (hasResults?: boolean, parties = [{ party: 'a', mandats: 0 }]) =>
  renderToStaticMarkup(createElement(UnassignedParties, {
    parties, getPartyName: party => `רשימה ${party}`, hasResults,
  }));

test('hides the unassigned summary before results arrive, including stored assignments', () => {
  assert.equal(render(false), '');
  assert.equal(render(false, [{ party: 'a', mandats: 4 }]), '');
});

test('does not render an empty summary after results arrive', () => {
  assert.equal(render(true, []), '');
});

test('shows unassigned lists and their seat total after counting or simulation produces results', () => {
  const html = render(true, [{ party: 'a', mandats: 4 }, { party: 'b', mandats: 2 }]);
  assert.match(html, /רשימות ללא שיוך לגוש/);
  assert.match(html, /רשימה a/);
  assert.match(html, /רשימה b/);
  assert.match(html, /<strong>6<\/strong> מנדטים/);
  assert.match(html, /4 מנדטים/);
  assert.match(html, /2 מנדטים/);
  assert.match(render(), /רשימות ללא שיוך לגוש/);
});
