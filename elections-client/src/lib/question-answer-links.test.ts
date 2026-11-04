import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeElectionQuestion, type Answer, type QuestionContext, type QuestionQuery } from './election-questions';
import { partyAnswerLink, questionAnswerLinks } from './question-answer-links';
import { parseLocalities, parsePollingStations } from './party-research';
import type { InsightQuery } from './question-insights';

const context: QuestionContext = { electionId: '26', votes: { א: { votes: 700, mandats: 0 }, ב: { votes: 290, mandats: 0 }, ג: { votes: 10, mandats: 0 } }, names: { א: 'ראשונה', ב: 'שנייה', ג: 'קטנה' }, config: { blockPercentage: .0325, agreements: [], algorithm: 'baderOffer' } };
const empty: Answer = { rows: [], columns: [], note: '' };
const csv = 'סמל ישוב,שם ישוב,מספר קלפי,פיצול,בזב,מצביעים,כשרים,א,ב,ג\n1,מקום,1,0,200,105,100,40,40,20\n1,מקום,1,1,200,150,100,20,20,60\n2,אחר,2.1,0,400,300,200,100,100,0';
const locations = parseLocalities(csv);
const stations = parsePollingStations(csv);
const insight = (metric: InsightQuery['metric'], options: Partial<InsightQuery> = {}): InsightQuery => ({ kind: 'insight', metric, level: 'stations', limit: 10, minimum: 0, byVotes: false, ...options });

test('factual links select list pages, both comparison elections, and results where list research is unavailable', () => {
  const links = (query: QuestionQuery, answer = empty, election = '26') => questionAnswerLinks(query, answer, context, election);
  assert.equal(links({ kind: 'results', parties: ['א', 'ב', 'א'] }).length, 2);
  const [list] = links({ kind: 'results', parties: ['א'] });
  assert.equal(new URL('https://example.org' + list.href).searchParams.get('party'), 'א');
  assert.match(list.label, /ראשונה/);
  assert.equal(partyAnswerLink('לא ידוע', context, '26').label, 'לעמוד הרשימה לא ידוע');
  assert.deepEqual(links({ kind: 'results', parties: ['א', 'ב'] }, empty, '1'), [{ href: '/results/1', label: 'תוצאות הבחירות לכנסת 1' }]);
  assert.deepEqual(links(insight('wasted')).map(link => link.href), ['/results/26']);
  assert.deepEqual(links(insight('coverage', { party: 'א' })).map(link => new URL('https://example.org' + link.href).searchParams.get('party')), ['א']);
  const geographic = { ...empty, rowLinks: [[{ href: '/localities/26?locality=1', label: 'מקום' }]] };
  assert.deepEqual(links(insight('winner'), geographic), []);
  assert.deepEqual(links(insight('winner'), { ...empty, rowLinks: [[]] }).map(link => link.href), ['/results/26']);
  const compare = links({ kind: 'comparison', source: '25', measure: 'both', target: { type: 'list', id: 'א' } });
  assert.equal(compare.length, 2); assert.equal(compare[1].href, '/results/25');
  assert.deepEqual(links({ kind: 'comparison', source: '25', measure: 'both', target: { type: 'bloc', id: 'gushA' } }).map(link => link.href), ['/results/26', '/results/25']);
  const ranked = links({ kind: 'rank', party: 'א', level: 'stations', order: 'votes', limit: 10 });
  assert.equal(new URL('https://example.org' + ranked[0].href).searchParams.get('level'), 'stations');
  for (const query of [{ kind: 'gap', party: 'ג', denominator: 'fixed' }, { kind: 'seat-gap', party: 'א' }, { kind: 'seat-loss', party: 'א' }] as QuestionQuery[]) assert.equal(links(query).length, 1);
  assert.deepEqual(links({ kind: 'scenario', threshold: 0 }).map(link => link.href), ['/results/26']);
});

test('rank and below-threshold answers retain precise place and split IDs after sorting', () => {
  for (const level of ['localities', 'stations'] as const) {
    const places = level === 'stations' ? stations : locations;
    for (const query of [
      { kind: 'rank', party: 'ג', level, order: 'votes', limit: 10 },
      { kind: 'below-threshold-winners', level, measure: 'plurality' },
    ] as QuestionQuery[]) {
      const answer = executeElectionQuestion(query, context, places);
      assert.equal(answer.rowLinks!.length, answer.rows.length);
      const url = new URL('https://example.org' + answer.rowLinks![0][0].href);
      assert.equal(url.pathname, '/localities/26'); assert.equal(url.searchParams.get('locality'), '1');
      assert.equal(url.searchParams.get('station'), level === 'stations' ? stations[1].id : null);
    }
  }
});

test('every geographic insight links its own row, including tied winners and split stations', () => {
  const previous = { id: '25', names: context.names, places: locations.map(place => ({ ...place, votes: { א: 1, ב: place.validVotes - 1, ג: 0 } })) };
  for (const query of [
    insight('closest'), insight('similarity'), insight('turnout-high'), insight('turnout-low'),
    insight('winner', { place: 'אחר', station: '2.1' }),
    insight('eligible-high'),
    insight('local-results', { party: 'א', place: 'אחר', station: '2.1' }),
    insight('strengthened', { party: 'א', level: 'localities' }),
    insight('weakened', { party: 'ב', level: 'localities' }),
  ]) {
    const answer = executeElectionQuestion(query, { ...context, previous }, query.level === 'stations' ? stations : locations);
    assert.ok(answer.rows.length, query.metric);
    assert.equal(answer.rowLinks!.length, answer.rows.length);
    answer.rowLinks!.forEach((links, index) => {
      const url = new URL('https://example.org' + links[0].href);
      const place = query.level === 'stations' ? stations.find(place => place.id === url.searchParams.get('station')) : locations.find(place => place.id === url.searchParams.get('locality'));
      assert.ok(place);
      assert.ok(String(answer.rows[index][0]).startsWith(place.name));
      if (place.pollingStation) assert.ok(String(answer.rows[index][0]).includes(`פיצול ${place.split}`));
    });
  }
});

test('comparison winner links identify the actual winning list rather than parsing its display name', () => {
  const comparison = { id: '25', votes: { ז: { votes: 100, mandats: 0 }, ח: { votes: 900, mandats: 0 } }, names: { ז: 'ראשונה', ח: 'שנייה' }, config: context.config };
  const answer = executeElectionQuestion({ kind: 'comparison', source: '25', direction: 'up', measure: 'points' }, { ...context, comparison });
  assert.equal(answer.rows.length, 1);
  assert.equal(new URL('https://example.org' + answer.rowLinks![0][0].href).searchParams.get('party'), 'א');
});
