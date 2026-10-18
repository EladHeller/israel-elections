import assert from 'node:assert/strict';
import { test } from 'node:test';
import { algorithmLabel, formatTime, getStablePartyColor, numberFormat } from './ui-helpers';

test('formats the ballot counts and local update times used by the dashboard', () => {
  assert.equal(numberFormat.format(160000), '160,000');
  assert.equal(formatTime(), '');
  assert.equal(formatTime(null), '');
  const date = new Date(2026, 9, 18, 12, 3);
  assert.equal(formatTime(date.toISOString()), `12:03 ${new Intl.DateTimeFormat('he-IL').format(date)}`);
});

test('party colors stay stable across repeated lookups and distinguish party keys', () => {
  const color = getStablePartyColor('מחל');
  assert.match(color, /^hsl\(\d+, \d+%, \d+%\)$/);
  assert.equal(getStablePartyColor('מחל'), color);
  assert.notEqual(getStablePartyColor('אמת'), color);
  assert.match(getStablePartyColor(''), /^hsl\(/);
  assert.equal(algorithmLabel('baderOffer'), 'שיטת בדר־עופר');
  assert.equal(algorithmLabel('ceilRound'), 'עיגול כלפי מעלה');
});
