import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
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
  assert.deepEqual(sortSummaryRows([...rows].reverse(), 'totalVotes', 'asc').map(row => row.id), [3, 5, 4, 2, 1]);
  assert.deepEqual(sortSummaryRows([...rows].reverse(), 'totalVotes', 'desc').map(row => row.id), [5, 4, 3, 2, 1]);
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

test('clicking every column toggles displayed numeric order, direction arrows and accessible labels', () => {
  const renderer = create(createElement(AllElectionsSummary));
  const headers = () => renderer.root.findAllByType('th');
  const values = (column: number) => renderer.root.findByType('tbody').findAllByType('tr')
    .map(row => row.findAllByType('td')[column].children.join(''));
  assert.equal(values(0)[0], '26');
  for (let column = 0; column < 7; column++) {
    const directions = column === 0 ? ['ascending', 'descending'] : ['descending', 'ascending'];
    for (const direction of directions) {
      act(() => headers()[column].findByType('button').props.onClick());
      assert.equal(headers()[column].props['aria-sort'], direction);
      assert.equal(headers().filter(header => header.props['aria-sort']).length, 1);
      assert.match(headers()[column].findByType('button').props['aria-label'], direction === 'ascending' ? /בסדר יורד/ : /בסדר עולה/);
      assert.equal(headers()[column].findByType('span').children.join(''), direction === 'ascending' ? '↑' : '↓');
      const cells = values(column);
      const numbers = cells.filter(value => value !== '—').map(value => Number(value.replace(/[,%]/g, '')));
      assert.ok(numbers.length > 0);
      assert.ok(numbers.every((value, index) => index === 0 || (direction === 'ascending' ? value >= numbers[index - 1] : value <= numbers[index - 1])));
      const firstMissing = cells.indexOf('—');
      if (firstMissing >= 0) assert.ok(cells.slice(firstMissing).every(value => value === '—'));
    }
  }
  act(() => renderer.unmount());
});
