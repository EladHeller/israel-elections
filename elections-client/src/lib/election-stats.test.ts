import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ElectionStatsSection from '../components/ElectionStatsSection';

const render = (props: Partial<Parameters<typeof ElectionStatsSection>[0]> = {}) =>
  renderToStaticMarkup(createElement(ElectionStatsSection, {
    turnoutPercentage: 77.7,
    totalVotes: 5_695_682,
    validVotes: 5_690_685,
    invalidVotes: 25_988,
    countedVotes: 5_716_673,
    isCounting: true,
    isSimulator: false,
    ...props,
  }));

test('counting turnout shows at least the sum of valid and invalid votes', () => {
  assert.match(render(), /<bdi>5,716,673<\/bdi> מצביעים/);
  assert.match(render({ totalVotes: 6_000_000 }), /<bdi>6,000,000<\/bdi> מצביעים/);
  assert.match(render({ totalVotes: undefined }), /<bdi>5,716,673<\/bdi> מצביעים/);
  assert.match(render({ invalidVotes: undefined }), /<bdi>5,695,682<\/bdi> מצביעים/);
  assert.match(render({ totalVotes: undefined, invalidVotes: undefined }), /<bdi>5,690,685<\/bdi> מצביעים/);
  assert.match(render(), /77\.70%/);
  assert.match(render(), /0\.45%/);
});

test('final results retain the configured voter total', () => {
  assert.match(render({ isCounting: false }), /<bdi>5,695,682<\/bdi> מצביעים/);
  assert.match(render({ isCounting: false, totalVotes: undefined }), /<bdi>—<\/bdi> מצביעים/);
});
