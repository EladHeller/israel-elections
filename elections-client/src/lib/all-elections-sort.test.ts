import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AllElectionsSummary from '../components/AllElectionsSummary';
import { sortSummaryRows, type SummaryRow, type SummarySortKey } from './all-elections-sort';

const row = (id: number, value: number | null): SummaryRow => ({
  id, turnoutPercentage: value, totalVotes: value, invalidVotes: value,
  validVotes: value, thresholdPercentage: value, belowThresholdPercentage: value,
});

test('sorts every metric numerically in both directions without mutating the input', () => {
  const rows = [row(1, 100), row(2, 9), row(3, 20), row(4, 0)];
  const original = [...rows];
  for (const key of Object.keys(rows[0]).filter(key => key !== 'id') as SummarySortKey[]) {
    assert.deepEqual(sortSummaryRows(rows, key, 'asc').map(row => row.id), [4, 2, 3, 1]);
    assert.deepEqual(sortSummaryRows(rows, key, 'desc').map(row => row.id), [1, 3, 2, 4]);
  }
  assert.deepEqual(sortSummaryRows(rows, 'id', 'asc').map(row => row.id), [1, 2, 3, 4]);
  assert.deepEqual(sortSummaryRows(rows, 'id', 'desc').map(row => row.id), [4, 3, 2, 1]);
  assert.deepEqual(rows, original);
});

test('keeps missing data last in both directions and breaks ties by newest Knesset', () => {
  const rows = [row(1, null), row(2, NaN), row(3, 0), row(4, 10), row(5, 10)];
  assert.deepEqual(sortSummaryRows(rows, 'totalVotes', 'asc').map(row => row.id), [3, 5, 4, 2, 1]);
  assert.deepEqual(sortSummaryRows(rows, 'totalVotes', 'desc').map(row => row.id), [5, 4, 3, 2, 1]);
});

test('renders seven keyboard-accessible sorting controls and announces the default order', () => {
  const html = renderToStaticMarkup(createElement(AllElectionsSummary));
  assert.equal((html.match(/class="summary-sort-button"/g) || []).length, 7);
  assert.equal((html.match(/scope="col"/g) || []).length, 7);
  assert.equal((html.match(/aria-sort=/g) || []).length, 1);
  assert.match(html, /aria-sort="descending"/);
  assert.match(html, /כנסת: מיון בסדר עולה/);
  assert.ok(html.indexOf('<td>26</td>') < html.indexOf('<td>25</td>'));
});
