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

test('below-threshold local winners distinguish strict majorities from first place including ties', () => {
  for (const unit of ['קלפיות', 'קלפי', 'יישובים', 'ישובים']) {
    for (const list of ['מפלגה', 'רשימה']) {
      for (const metric of ['רוב הקולות', 'הכי הרבה קולות', 'מספר הקולות הגבוה ביותר', 'מעל 50% מהקולות', 'יותר מ־50 אחוז מהקולות']) {
        const expected = { kind: 'below-threshold-winners', level: unit.startsWith('קלפ') ? 'stations' : 'localities', measure: /הכי הרבה|הגבוה/.test(metric) ? 'plurality' : 'majority' };
        assert.deepEqual(query(`באילו ${unit} ${list} שלא עברה את אחוז החסימה קיבלה את ${metric}?`), expected);
        assert.deepEqual(query(`איזה ${unit} קיבלה ${list} שלא עברה את אחוז החסימה הארצי ${metric}`), expected);
      }
    }
  }
  rejected('באילו קלפיות רשימה שלא עברה את אחוז החסימה קיבלה רוב הקולות מעל 100 כשרים');
  const places: LocalityVotes[] = [
    { id: '1', name: 'רוב', pollingStation: '3', split: 0, validVotes: 100, votes: { ך: 60, מחל: 40 } },
    { id: '2', name: 'חצי', validVotes: 100, votes: { ך: 50, מחל: 30, ט: 20 } },
    { id: '3', name: 'מוביל', pollingStation: '2', validVotes: 100, votes: { ך: 40, מחל: 35, ט: 25 } },
    { id: '4', name: 'תיקו', validVotes: 100, votes: { ך: 45, מחל: 45, ט: 10 } },
    { id: '5', name: 'עברה', validVotes: 100, votes: { מחל: 70, ך: 30 } },
    { id: '6', name: 'ללא כשרים', validVotes: 0, votes: {} },
    { id: '7', name: 'ללא קולות', validVotes: 100, votes: {} },
    { id: '8', name: 'לא מוכרת', validVotes: 100, votes: { לאמוכרת: 70, ך: 30 } },
  ];
  const majority = query('באילו קלפיות רשימה שלא עברה את אחוז החסימה קיבלה רוב הקולות');
  const plurality = query('באילו קלפיות רשימה שלא עברה את אחוז החסימה קיבלה הכי הרבה קולות');
  const before = structuredClone(places);
  assert.deepEqual(execute(majority, context, places).rows, [['רוב — קלפי 3 / פיצול 0', 'עמך ישראל', 60, '60.00%', 'מקום ראשון']]);
  const rows = execute(plurality, context, places).rows;
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.find(row => row[0] === 'תיקו'), ['תיקו', 'עמך ישראל', 45, '45.00%', 'תיקו במקום הראשון']);
  assert.ok(rows.some(row => row[0] === 'מוביל — קלפי 2'));
  assert.equal(execute(plurality, { ...context, config: { ...context.config, blockPercentage: 0.19 } }, places).rows.length, 0);
  assert.equal(execute(majority, context, []).rows.length, 0);
  assert.throws(() => execute(majority, context), /זמינים/);
  assert.equal(execute(majority, { ...context, names: {} }, places).rows[0][1], 'ך');
  const tiedPlaces: LocalityVotes[] = [
    { id: 'b', name: 'ב', validVotes: 100, votes: { ך: 45, ט: 45, מחל: 10 } },
    { id: 'a', name: 'א', validVotes: 100, votes: { ך: 45, ט: 45, מחל: 10 } },
    { id: 'c', name: 'ג', validVotes: 200, votes: { ך: 90, מחל: 110 } },
    { id: 'd', name: 'ד', validVotes: 200, votes: { ך: 90, ט: 90, מחל: 20 } },
  ];
  const bothBelow = { ...context, config: { ...context.config, blockPercentage: 0.35 } };
  const tiedRows = execute(plurality, bothBelow, tiedPlaces).rows;
  assert.equal(tiedRows.length, 6);
  assert.deepEqual(tiedRows.map(row => row[0]), ['ד', 'ד', 'א', 'א', 'ב', 'ב']);
  assert.deepEqual(places, before);
});

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
        const original = computeScenarioResults(ctx.votes, ctx.config).realResults;
        const changed = computeScenarioResults({ ...ctx.votes, [party]: { ...ctx.votes[party], votes: ctx.votes[party].votes + expected } }, ctx.config).realResults;
        const expectedChanges = Object.keys(ctx.votes).filter(id => (original[id]?.mandats ?? 0) !== (changed[id]?.mandats ?? 0))
          .map(id => ({ party: id, name: ctx.names[id], before: original[id]?.mandats ?? 0, after: changed[id]?.mandats ?? 0 }));
        assert.deepEqual([...answer.seatChanges!].sort((a, b) => a.party.localeCompare(b.party)), expectedChanges.sort((a, b) => a.party.localeCompare(b.party)));
        assert.equal(answer.seatChanges![0].party, party);
        assert.equal(answer.seatChanges!.reduce((sum, change) => sum + change.after - change.before, 0), 0);
        assert.ok(answer.seatChanges!.some(change => change.after < change.before));
      }
      assert.deepEqual(ctx, before);
    }
  }
  assert.throws(() => execute({ kind: 'seat-gap', party: 'missing' }, context), /קיימת/);
  const single = { ...context, votes: { מחל: { votes: 100, mandats: 0 } }, config: { ...context.config, agreements: [] } };
  const noGain = execute({ kind: 'seat-gap', party: 'מחל' }, single);
  assert.equal(noGain.rows[0][1], '—');
  assert.deepEqual(noGain.seatChanges, []);
  assert.equal(execute({ kind: 'seat-gap', party: 'ט' }, { ...context, config: { ...context.config, blockPercentage: 1 } }).rows[0][1], '—');
});

test('next-seat impact includes threshold cascades and lists losing all their seats', () => {
  const ctx = { ...context, config: { ...context.config, blockPercentage: 0.31 } };
  const original = structuredClone(ctx);
  const answer = execute({ kind: 'seat-gap', party: 'ך' }, ctx);
  const lost = answer.seatChanges!.find(change => change.party === 'ט')!;
  assert.ok(lost.before > 0);
  assert.equal(lost.after, 0);
  const gained = answer.seatChanges!.find(change => change.party === 'ך')!;
  assert.equal(gained.before, 0);
  assert.ok(gained.after > 1);
  assert.equal(answer.seatChanges!.reduce((sum, change) => sum + change.after - change.before, 0), 0);
  assert.deepEqual(ctx, original);
});

test('short next-seat questions resolve list aliases and use the existing seat calculation', () => {
  for (const name of ['ליכוד', 'הליכוד', 'מחל', 'רשימת הליכוד', 'הציונות הדתית']) {
    const party = name === 'הציונות הדתית' ? 'ט' : 'מחל';
    for (const tense of ['חסרים', 'היו חסרים']) {
      for (const target of ['למנדט נוסף', 'לעוד מנדט', 'למנדט הבא']) {
        const parsed = query(`כמה קולות ${tense} ל${name} ${target}?`);
        assert.deepEqual(parsed, { kind: 'seat-gap', party });
        assert.deepEqual(execute(parsed, context), execute({ kind: 'seat-gap', party }, context));
      }
    }
  }
  const parsed = query('כמה קולות חסרים לליכוד למנדט נוסף');
  const answer = execute(parsed, context);
  const delta = Number(answer.rows[0][1]);
  const seats = (added: number) => computeScenarioResults({ ...context.votes, מחל: { ...context.votes['מחל'], votes: context.votes['מחל'].votes + added } }, context.config).realResults['מחל'].mandats;
  assert.ok(delta > 0);
  assert.ok(seats(delta) > seats(0));
  assert.equal(seats(delta - 1), seats(0));
  assert.deepEqual(query('כמה קולות היו חסרים לליכוד למנדט נוסף בתוצאות האמת'), parsed);
  for (const suffix of ['בלי הסכמי עודפים', 'בבחירות 25', 'בירושלים', 'וכמה לשס', 'אם אחוז החסימה ישתנה']) {
    rejected(`כמה קולות חסרים לליכוד למנדט נוסף ${suffix}`);
  }
  rejected('כמה קולות חסרים לליכוד למנדט שני');
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

test('unanswered production and develop questions and related Hebrew phrasings get executable queries', () => {
  const names26 = names['26'];
  const names25 = names['25'];
  const ctx: QuestionContext = {
    ...context, electionId: '26', names: names26,
    votes: { ...context.votes, שס: { votes: 100, mandats: 0 }, די: { votes: 10, mandats: 0 } },
    comparison: { id: '25', names: names25, config: context.config, votes: { מחל: { votes: 400, mandats: 0 }, ט: { votes: 250, mandats: 0 }, שס: { votes: 100, mandats: 0 } } },
  };
  const places: LocalityVotes[] = [
    { id: '1', name: 'ירושלים', validVotes: 100, votes: { מחל: 60, ט: 40 } },
    { id: '2', name: 'חיפה', validVotes: 200, votes: { מחל: 80, ט: 120 } },
  ];
  const stations = places.map((p, i) => ({ ...p, pollingStation: String(i + 1) }));
  const answered = (text: string) => {
    const q = query(text, ctx);
    const answer = execute(q, ctx, 'level' in q && q.level === 'stations' ? stations : places);
    assert.ok(answer.rows.length, text);
    return { q, answer };
  };
  for (const text of ['כמה קולות חסרים לליכוד למנדט נוסף', 'עוד כמה קולות ש״ס הייתה מקבלת מנדט נוסף', 'עוד כמה קולות הליכוד היה מקבל עוד מנדט']) {
    assert.equal(answered(text).q.kind, 'seat-gap');
  }
  for (const name of ['כלכלית', 'הכלכלית', 'המילואימניקים והכלכלית']) {
    const { q, answer } = answered(`כמה קולות היו חסרים ל${name} לעבור את אחוז החסימה`);
    assert.deepEqual(q, { kind: 'gap', party: 'די', denominator: 'fixed' });
    assert.equal(answer.rows[0][1], 212);
  }
  for (const unit of ['עיר', 'יישוב', 'ישוב']) for (const order of ['קיבל הליכוד', 'הליכוד קיבלה']) {
    const { q, answer } = answered(`באיזה ${unit} ${order} הכי הרבה קולות`);
    assert.deepEqual(q, { kind: 'rank', party: 'מחל', level: 'localities', order: 'votes', limit: 1 });
    assert.equal(answer.rows[0][0], 'חיפה');
    assert.equal(answer.rows[0][1], 80);
  }
  assert.equal(answered('באילו ערים קיבל הליכוד הכי הרבה קולות').answer.rows.length, 2);
  for (const wording of ['באיזו קלפי קיבל הליכוד אחוז הכי גבוה מהקולות', 'באיזה קלפי הליכוד קיבלה את אחוז הקולות הגבוה ביותר', 'באיזו קלפי קיבלה הליכוד האחוז הגבוה ביותר']) {
    const { q, answer } = answered(wording);
    assert.deepEqual(q, { kind: 'rank', party: 'מחל', level: 'stations', order: 'percentage', limit: 1 });
    assert.match(String(answer.rows[0][0]), /ירושלים.*קלפי 1/);
    assert.equal(answer.rows[0][2], '60.00%');
  }
  for (const subject of ['איזו מפלגה', 'איזו רשימה', 'איזה מפלגה']) for (const verb of ['קבלה', 'קיבלה', 'קיבל']) {
    const { q, answer } = answered(`${subject} ${verb} הכי הרבה קולות בירושלים`);
    assert.equal(q.kind, 'insight');
    assert.match(String(answer.rows[0][0]), /ירושלים.*הליכוד.*60/);
  }
  assert.match(String(answered('איזו רשימה קיבלה הכי הרבה קולות בירושלים בקלפי 1').answer.rows[0][0]), /קלפי 1/);
  for (const source of ['מהכנסת הקודמת', 'מהבחירות הקודמות', 'לעומת הבחירות הקודמות', 'מאז הבחירות הקודמות']) {
    const { q, answer } = answered(`בכמה אחוזים עלתה הליכוד ${source}`);
    assert.deepEqual(q, { kind: 'comparison', source: '25', target: { type: 'list', id: 'מחל' }, measure: 'both' });
    assert.match(String(answer.rows[0][0]), /נקודות אחוז.*יחסי/);
  }
  const changed = answered('בכמה קולות עלתה הציונות הדתית מהבחירות הקודמות');
  assert.equal(changed.q.kind, 'comparison');
  assert.match(String(changed.answer.rows[0][0]), /250.*310.*60 קולות/);
  assert.match(changed.answer.note, /הציונות הדתית וזהות.*הציונות הדתית.*הרכב הרשימות שונה/);
  for (const text of ['באיזה עיר קיבל הליכוד הכי הרבה קולות וגם שס', 'באיזו קלפי קיבל הליכוד אחוז הכי גבוה מהקולות בחיפה', 'עוד כמה קולות ש״ס הייתה מקבלת מנדט נוסף וגם הליכוד', 'בכמה אחוזים עלתה הליכוד מהבחירות הקודמות וגם שס']) rejected(text, ctx);
  const ambiguous = { ...ctx, names: { ...ctx.names, יז: 'הכלכלית החדשה' }, votes: { ...ctx.votes, יז: { votes: 1, mandats: 0 } } };
  rejected('כמה קולות היו חסרים לכלכלית לעבור את אחוז החסימה', ambiguous);
});
