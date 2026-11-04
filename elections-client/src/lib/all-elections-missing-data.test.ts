import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import configs from '../data/elections-config.json';
import totals from '../data/elections-valid.json';

test('summary preserves unavailable statistics as unknown rather than zero for an election awaiting data', async () => {
  const elections = configs as Record<string, { totalVotes?: number; turnoutPercentage?: number }>;
  const valid = totals as Record<string, unknown>;
  const original = { config: elections['26'], totals: valid['26'] };
  try {
    elections['26'] = { ...elections['26'], totalVotes: undefined, turnoutPercentage: undefined };
    delete valid['26'];
    // Load the summary after setting up an upcoming election with no published totals.
    const { default: Summary } = await import('../components/AllElectionsSummary');
    const html = renderToStaticMarkup(createElement(Summary));
    const cells = html.match(/<tr><td>26<\/td>(.*?)<\/tr>/)?.[1];
    assert.equal(cells, '<td>—</td><td>—</td><td>—</td><td>—</td><td>3.25%</td><td>—</td>');
  } finally {
    elections['26'] = original.config;
    valid['26'] = original.totals;
  }
});
