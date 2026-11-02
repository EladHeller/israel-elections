import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeElectionQuestion as execute, parseElectionQuestion as parse, normalizeQuestion, type QuestionContext, type QuestionQuery } from './election-questions';
import names from '../data/party-names.json';
import type { LocalityVotes } from './party-research';
import { computeScenarioResults } from './scenario';

const context: QuestionContext = { votes: { מחל: { votes: 500, mandats: 0 }, ט: { votes: 310, mandats: 0 }, ך: { votes: 190, mandats: 0 } }, names: { מחל: 'הליכוד', ט: 'הציונות הדתית וזהות', ך: 'עמך ישראל' }, config: { blockPercentage: 0.2, agreements: [['מחל', 'ט']], algorithm: 'baderOffer' } };
function query(text: string, ctx = context): QuestionQuery {
  const result = parse(text, ctx);
  assert.ok('query' in result, `${text}: ${JSON.stringify(result)}`);
  assert.ok(result.explanation.length);
  return result.query;
}
function rejected(text: string, ctx = context) { assert.ok('error' in parse(text, ctx), text); }

test('seat-loss questions remove votes only from the selected list and find the first loss', () => {
  for (const name of ['הציונות הדתית', 'ציונות הדתית', 'ט', 'ליכוד']) {
    for (const wording of [`כמה קולות צריכים לרדת ל${name} כדי שתאבד מנדט?`, `כמה קולות צריך להוריד ל${name} כדי שירד לה מנדט`, `כמה קולות היו צריכים לרדת ל${name} כדי לאבד מנדט בתוצאות האמת`]) {
      assert.deepEqual(query(wording), { kind: 'seat-loss', party: name === 'ליכוד' ? 'מחל' : 'ט' });
    }
  }
  rejected('כמה קולות צריכים לרדת לציונות הדתית כדי שתאבד מנדט ויעברו לליכוד');
  for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
    for (const agreements of [[], [['מחל', 'ט']]] as [string, string][][]) {
      const ctx = { ...context, config: { ...context.config, algorithm, agreements } };
      const before = structuredClone(ctx);
      for (const party of ['ט', 'ך']) {
        const seats = (delta: number) => computeScenarioResults({ ...ctx.votes, [party]: { ...ctx.votes[party], votes: ctx.votes[party].votes - delta } }, ctx.config).realResults[party]?.mandats ?? 0;
        const baseline = seats(0);
        let expected = 1;
        while (expected <= ctx.votes[party].votes && seats(expected) >= baseline) expected++;
        const answer = execute({ kind: 'seat-loss', party }, ctx);
        assert.equal(answer.rows[0][1], expected <= ctx.votes[party].votes ? expected : '—');
        assert.equal(answer.rows[0][2], baseline);
      }
      assert.deepEqual(ctx, before);
    }
  }
  assert.throws(() => execute({ kind: 'seat-loss', party: 'missing' }, context), /קיימת/);
  const edge = { ...context, config: { ...context.config, blockPercentage: 0.3095 } };
  const answer = execute({ kind: 'seat-loss', party: 'ט' }, edge);
  assert.equal(answer.rows[0][1], 1);
  assert.ok(Number(answer.rows[0][2]) > 1);
  assert.equal(computeScenarioResults({ ...edge.votes, ט: { votes: 309, mandats: 0 } }, edge.config).realResults['ט']?.mandats ?? 0, 0);
});

test('next-seat questions accept natural Hebrew and return the first added-vote seat gain', () => {
  for (const name of ['הציונות הדתית', 'ציונות הדתית', 'ט']) {
    for (const wording of [`כמה קולות היו חסרים ל${name} כדי לקבל מנדט נוסף בתוצאות האמת?`, `כמה קולות חסרים ל${name} להשיג עוד מנדט`, `כמה קולות נוספים הייתה צריכה ${name} כדי לקבל מנדט נוסף`]) {
      assert.deepEqual(query(wording), { kind: 'seat-gap', party: 'ט' });
    }
  }
  rejected('כמה קולות היו חסרים לציונות הדתית כדי לקבל מנדט נוסף בבחירות 25');
  rejected('כמה קולות היו חסרים לציונות הדתית כדי לקבל מנדט נוסף בלי הסכמי עודפים');
  for (const algorithm of ['baderOffer', 'ceilRound'] as const) {
    for (const agreements of [[], [['מחל', 'ט']]] as [string, string][][]) {
      const ctx = { ...context, config: { ...context.config, algorithm, agreements } };
      const before = structuredClone(ctx);
      for (const party of ['ט', 'ך']) {
        const seats = (delta: number) => computeScenarioResults({ ...ctx.votes, [party]: { ...ctx.votes[party], votes: ctx.votes[party].votes + delta } }, ctx.config).realResults[party]?.mandats ?? 0;
        const baseline = seats(0);
        let expected = 1;
        while (expected <= 1000 && seats(expected) <= baseline) expected++;
        const answer = execute({ kind: 'seat-gap', party }, ctx);
        assert.equal(answer.rows[0][1], expected <= 1000 ? expected : '—');
        assert.equal(answer.rows[0][2], baseline);
      }
      assert.deepEqual(ctx, before);
    }
  }
  assert.throws(() => execute({ kind: 'seat-gap', party: 'missing' }, context), /קיימת/);
  const single = { ...context, votes: { מחל: { votes: 100, mandats: 0 } }, config: { ...context.config, agreements: [] } };
  assert.equal(execute({ kind: 'seat-gap', party: 'מחל' }, single).rows[0][1], '—');
  assert.equal(execute({ kind: 'seat-gap', party: 'ט' }, { ...context, config: { ...context.config, blockPercentage: 1 } }).rows[0][1], '—');
});

test('Hebrew normalization, list names, ballot letters, prefixes and current-election aliases', () => {
  assert.equal(normalizeQuestion('  ש״ס — הַלִּיכוּד?  '), 'שס הליכוד');
  for (const name of ['הליכוד', 'ליכוד', 'מחל', 'מפלגת הליכוד', 'רשימת הליכוד']) {
    assert.deepEqual(query(`כמה קולות קיבלה ${name}?`), { kind: 'results', parties: ['מחל'] });
  }
  assert.deepEqual(query('השווה בין הליכוד לציונות הדתית'), { kind: 'results', parties: ['מחל', 'ט'] });
  assert.deepEqual(query('השוואה בין ט למחל'), { kind: 'results', parties: ['ט', 'מחל'] });
  for (const metric of ['מנדטים', 'אחוזים']) assert.equal(query(`כמה ${metric} קיבלה הליכוד`).kind, 'results');
  assert.equal(query('מה התוצאות של עמך ישראל').kind, 'results');
  const noam = { ...context, votes: { ני: { votes: 1, mandats: 0 } }, names: { ני: 'נעם לישראל' } };
  assert.equal(query('כמה קולות קיבלה נועם', noam).kind, 'results');
  rejected('כמה קולות קיבלה נועם');
  rejected('כמה קולות קיבלה נועם', { ...noam, names: { ני: 'הציונות הדתית ועוצמה יהודית ונעם' } });
  rejected('כמה קולות קיבלה אותו שם', { ...context, names: { מחל: 'אותו שם', ט: 'אותו שם' } });
  rejected('כמה קולות קיבלה הליכוד בבחירות 25');
  rejected('כמה קולות קיבלה הליכוד וכמה חסרו לה למנדט');
  rejected('מה ההבדל בינו לבין הקודמת');
  rejected('א'.repeat(601)); rejected('');
  assert.equal(query('כמה קולות קיבלה מחל', { ...context, names: {} }).kind, 'results');
});

test('geographic ranking composes unit, measure, list and bounded result count', () => {
  for (const unit of ['יישוב', 'ישוב', 'יישובים', 'ישובים', 'קלפי', 'קלפיות']) {
    for (const metric of ['הכי הרבה קולות', 'האחוז הגבוה ביותר', 'אחוז הקולות הגבוה ביותר', 'הכי הרבה אחוזים', 'את מספר הקולות הגבוה ביותר']) {
      const q = query(`באילו ${unit} הליכוד קיבלה ${metric}`);
      assert.equal(q.kind, 'rank');
      if (q.kind === 'rank') { assert.equal(q.level, unit.startsWith('קלפ') ? 'stations' : 'localities'); assert.equal(q.order, metric.includes('אחוז') ? 'percentage' : 'votes'); }
    }
  }
  assert.deepEqual(query('באילו 5 יישובים הליכוד קיבלה הכי הרבה קולות'), { kind: 'rank', party: 'מחל', level: 'localities', order: 'votes', limit: 5 });
  assert.equal(query('איפה הליכוד קיבלה הכי הרבה קולות').kind, 'rank');
  rejected('באילו 0 יישובים הליכוד קיבלה הכי הרבה קולות');
  rejected('באילו 101 קלפיות הליכוד קיבלה הכי הרבה קולות');
  rejected('באיזה יישוב הליכוד קיבלה הכי הרבה קולות מעל 500 כשרים');
});

test('threshold gap distinguishes transferred votes from newly added valid votes', () => {
  const fixed = query('כמה קולות היו חסרים לעמך ישראל לעבור את אחוז החסימה');
  const additional = query('כמה קולות נוספים היו צריכה עמך ישראל כדי לעבור את אחוז החסימה');
  assert.deepEqual(execute(fixed, context).rows, [['עמך ישראל', 10]]);
  assert.deepEqual(execute(additional, context).rows, [['עמך ישראל', 13]]);
  assert.equal(execute({ kind: 'gap', party: 'מחל', denominator: 'fixed' }, context).rows[0][1], 0);
  const exact = { ...context, config: { ...context.config, blockPercentage: 0.19 } };
  assert.equal(execute(fixed, exact).rows[0][1], 0);
  assert.throws(() => execute(additional, { ...context, config: { ...context.config, blockPercentage: 1 } }), /100%/);
});

test('scenario grammar composes threshold, agreements and one conservative vote transfer in either direction', () => {
  const clauses = ['ללא אחוז חסימה', 'אחוז החסימה היה 2%', 'בלי הסכמי עודפים', 'הציונות הדתית הייתה מקבלת את הקולות של עמך ישראל', 'עמך ישראל תקבל 50% מהקולות של הציונות הדתית'];
  for (const clause of clauses) {
    const q = query(`מה היה קורה אם ${clause}`);
    assert.equal(q.kind, 'scenario');
    const answer = execute(q, context);
    assert.equal(answer.rows.reduce((sum, row) => sum + Number(row[2]), 0), 120);
  }
  for (const threshold of ['לא היה אחוז חסימה', 'אחוז החסימה יהיה 3.25 אחוזים']) {
    for (const agreement of ['', ' וגם לא היו הסכמי עודפים']) {
      const q = query(`מה היה קורה אם ${threshold}${agreement} וגם הציונות הדתית מקבלת כל הקולות של עמך ישראל`);
      const before = structuredClone(context);
      const rows = execute(q, context).rows;
      assert.equal(rows.find(row => row[0] === 'עמך ישראל')?.[2], 0);
      assert.deepEqual(context, before);
    }
  }
  assert.equal(query('מה אם בלי הסכמי עודפים וללא אחוז חסימה').kind, 'scenario');
  for (const bad of ['אחוז החסימה היה 101%', 'אחוז החסימה היה 2% וגם אחוז החסימה היה 3%', 'עמך ישראל תקבל 0% מהקולות של הליכוד', 'עמך ישראל תקבל 101% מהקולות של הליכוד', 'הליכוד תקבל את הקולות של הליכוד', 'בלי הסכמי עודפים וגם בלי הסכמי עודפים', 'בלי אחוז חסימה וגם השמש תזרח', 'הליכוד ועמך ישראל יתאחדו', '']) rejected(`מה היה קורה אם ${bad}`);
});

test('answers reuse seat allocation, rank by votes versus share, preserve polling split and guard missing data', () => {
  const results = execute(query('השווה בין הליכוד לעמך ישראל'), context);
  assert.deepEqual(results.rows.map(row => row.slice(0, 3)), [['הליכוד', 500, '50.00%'], ['עמך ישראל', 190, '19.00%']]);
  const places: LocalityVotes[] = [ { id: '1', name: 'גדול', validVotes: 1000, votes: { מחל: 100 } }, { id: '2', name: 'קטן', validVotes: 10, votes: { מחל: 9 }, pollingStation: '2', split: 1 }, { id: '3', name: 'ריק', validVotes: 10, votes: {} }, { id: '4', name: 'אחר', validVotes: 10, votes: { מחל: 8 }, pollingStation: '1' } ];
  const q = query('באיזה יישוב הליכוד קיבלה הכי הרבה קולות');
  assert.equal(execute(q, context, places).rows[0][0], 'גדול');
  assert.equal(execute(query('באיזה קלפי הליכוד קיבלה האחוז הגבוה ביותר'), context, places).rows[0][0], 'קטן — קלפי 2 / פיצול 1');
  assert.ok(execute(query('באילו קלפיות הליכוד קיבלה האחוז הגבוה ביותר'), context, places).rows.some(row => row[0] === 'אחר — קלפי 1'));
  assert.throws(() => execute(q, context), /זמינים/);
  assert.equal(execute(q, context, []).rows.length, 0);
  assert.throws(() => execute({ kind: 'results', parties: ['missing'] }, context), /קיימת/);
  for (const votes of [{}, { מחל: { votes: NaN, mandats: 0 } }] as QuestionContext['votes'][]) assert.throws(() => execute(q, { ...context, votes }), /כשרים/);
  for (const fraction of [0, 1.1, NaN]) assert.throws(() => execute({ kind: 'scenario', transfer: { from: 'מחל', to: 'ט', fraction } }, context), /תקינה/);
  assert.throws(() => execute({ kind: 'scenario', transfer: { from: 'מחל', to: 'מחל', fraction: 1 } }, context), /תקינה/);
  for (const threshold of [-1, 2, NaN]) assert.throws(() => execute({ kind: 'scenario', threshold }, context), /תקין/);
  const unnamed = { ...context, names: {} };
  assert.equal(execute({ kind: 'results', parties: ['מחל'] }, unnamed).rows[0][0], 'מחל');
  assert.equal(execute({ kind: 'scenario', threshold: 1 }, unnamed).rows.reduce((sum, row) => sum + Number(row[2]), 0), 0);
});

test('all explicit examples resolve against current-election party names without mapping a faction to a historical joint list', () => {
  const current = { ...context, names: names['26'], votes: Object.fromEntries(Object.keys(names['26']).map(party => [party, { votes: 100, mandats: 0 }])) };
  for (const question of ['באיזה יישוב הליכוד קיבלה הכי הרבה קולות', 'כמה קולות היו חסרים לעמך ישראל לעבור את אחוז החסימה', 'מה היה קורה אם הציונות הדתית הייתה מקבלת את הקולות של עמך ישראל', 'באיזה יישוב מפלגת נועם קיבלה הכי הרבה קולות']) assert.ok(query(question, current));
  rejected('כמה קולות קיבלה נועם', { ...current, names: names['25'] });
});


test('common Hebrew syntax never becomes a ballot identifier across historical elections', () => {
  for (const partyNames of Object.values(names)) {
    const ctx = { ...context, names: partyNames, votes: Object.fromEntries(Object.keys(partyNames).map(id => [id, { votes: 1, mandats: 0 }])) };
    assert.equal(query('מה היה קורה אם לא היה אחוז חסימה', ctx).kind, 'scenario');
    assert.equal(query('מה היה קורה אם בלי הסכמי עודפים', ctx).kind, 'scenario');
  }
  assert.equal(query('מה היה קורה אם לא היה אחוז חסימה', { ...context, votes: {} }).kind, 'scenario');
});
