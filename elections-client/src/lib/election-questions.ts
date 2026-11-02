import type { ElectionConfig, PartyNames, VoteData } from '../types';
import { executeInsight, parseInsight, type InsightQuery, type PreviousElection } from './question-insights';
import { computeScenarioResults } from './scenario';
import { computeSeatMargins } from './analytics';
import { rankLocalities, type LocalityVotes } from './party-research';
import { parseComparison, executeComparison, type ComparisonQuery, type ElectionSnapshot } from './election-comparisons';
import type { BlocsConfig } from '../types';

export type QuestionQuery =
  | ComparisonQuery
  | InsightQuery
  | { kind: 'results'; parties: string[] }
  | { kind: 'rank'; party: string; level: 'localities' | 'stations'; order: 'votes' | 'percentage'; limit: number }
  | { kind: 'gap'; party: string; denominator: 'fixed' | 'additional' }
  | { kind: 'seat-gap'; party: string }
  | { kind: 'seat-loss'; party: string }
  | { kind: 'below-threshold-winners'; level: 'localities' | 'stations'; measure: 'majority' | 'plurality' }
  | { kind: 'scenario'; threshold?: number; withoutAgreements?: boolean; transfer?: { from: string; to: string; fraction: number } };
export type QuestionParse = { query: QuestionQuery; explanation: string } | { error: string };
export interface QuestionContext { votes: VoteData; names: PartyNames; config: ElectionConfig; previous?: PreviousElection; electionId?: string; blocs?: BlocsConfig; comparison?: ElectionSnapshot }
export interface Answer { note: string; columns: string[]; rows: (string | number)[][] }

export const normalizeQuestion = (value: string): string => value.normalize('NFKC')
  .replace(/[\u0591-\u05bd\u05bf-\u05c2\u05c4-\u05c5\u05c7]/g, '').replace(/["'״׳?？!,:;]/g, '').replace(/[־–—-]/g, ' ')
  .replace(/\s+/g, ' ').trim();

// Aliases are only attached when they occur in this election's actual list name.
// Historical factions inside joint lists are not inferred. Explicit current-list
// shorthand is shown back to the user using the full list name before calculation.
const listAliases: Record<string, string[]> = { 'הציונות הדתית וזהות': ['הציונות הדתית'], 'נעם לישראל': ['נועם', 'נעם'] };
const aliases = ['הליכוד', 'ליכוד', 'שס', 'יהדות התורה', 'יש עתיד', 'ישראל ביתנו', 'הציונות הדתית', 'עמך ישראל', 'נועם', 'נעם', 'הדמוקרטים', 'כחול לבן', 'רעם', 'הרשימה המשותפת'];
export function resolveParties(text: string, context: QuestionContext): { text: string; parties: string[]; ambiguous: boolean } {
  const candidates = new Map<string, Set<string>>();
  const add = (alias: string, party: string) => {
    const normalized = normalizeQuestion(alias);
    candidates.set(normalized, new Set([...(candidates.get(normalized) ?? []), party]));
  };
  for (const party of Object.keys(context.votes)) {
    add(party, party);
    const name = context.names[party] ?? party;
    add(name, party);
    for (const alias of listAliases[name] ?? []) add(alias, party);
    for (const alias of aliases) {
      if (normalizeQuestion(name) === normalizeQuestion(alias)
        || normalizeQuestion(name).replace(/^ה/, '') === normalizeQuestion(alias).replace(/^ה/, '')) add(alias, party);
    }
  }
  const parties: string[] = [];
  let ambiguous = false;
  // Resolve in textual order; longest alternatives prevent a short ballot letter
  // consuming part of a multiword list name. Prefer an exact name over a prefix.
  for (const [alias, ids] of [...candidates]) {
    if (alias.startsWith('ה') && alias.length > 2) for (const id of ids) add(alias.slice(1), id);
  }
  if (!candidates.size) return { text, parties, ambiguous };
  const syntaxWords = new Set(['מה', 'אם', 'לא', 'כל', 'את', 'של', 'בלי', 'ללא', 'היה', 'היו', 'קולות', 'אחוז', 'החסימה']);
  const alternatives = [...candidates.keys()].sort((a, b) => b.length - a.length)
    .map(alias => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`(^| )(?:(${alternatives})|([ובל])(${alternatives}))(?=$| )`, 'g');
  text = text.replace(pattern, (match, space: string, exact: string, prefix: string, prefixed: string) => {
    if (syntaxWords.has(exact || `${prefix}${prefixed}`)) return match;
    const ids = candidates.get(exact || prefixed)!;
    if (ids.size !== 1) { ambiguous = true; return `${space}רשימהעמומה`; }
    const id = [...ids][0];
    let index = parties.indexOf(id);
    if (index < 0) { index = parties.length; parties.push(id); }
    return `${space}${prefix || ''}@${index}`;
  });
  return { text, parties, ambiguous };
}

export function parseElectionQuestion(input: string, context: QuestionContext): QuestionParse {
  if (input.length > 600) return { error: 'השאלה ארוכה מדי. נסו שאלה אחת עד 600 תווים.' };
  const raw = normalizeQuestion(input).replace(/^איפה /, 'באילו יישובים ');
  const comparison = parseComparison(raw, context);
  if (comparison) return comparison;
  const neutralInsight = raw.startsWith('מי ') ? null : parseInsight(raw, []);
  if (neutralInsight) return neutralInsight;
  const normalized = raw.replace(/מפלגת |רשימת |מפלגות |רשימות /g, '');
  const { text, parties, ambiguous } = resolveParties(normalized, context);
  if (ambiguous) return { error: 'שם הרשימה מתאים ליותר מרשימה אחת. השתמשו בשם המלא או באותיות הקלפי.' };
  const label = (id: string) => context.names[id] ?? id;
  const unsupported = { error: 'לא הצלחתי לפרש את כל השאלה בבטחה. נסו אחת מהדוגמאות, ובדקו שהרשימה התמודדה בשם הזה בבחירות שנבחרו. שאלות המשך וכמה שאלות יחד עדיין אינן נתמכות.' };
  const insight = parseInsight(text, parties);
  if (insight) return insight;
  const belowList = '(?:רשימה|מפלגה) שלא עברה את אחוז החסימה(?: הארצי)?';
  const localWinners = new RegExp(`^(?:באילו|באיזה|איזה|אילו) (קלפיות|קלפי|יישובים|ישובים|יישוב|ישוב) (?:${belowList} (?:קיבלה|קבלה)|(?:קיבלה|קבלה) ${belowList}) (?:את )?(רוב הקולות|הכי הרבה קולות|מספר הקולות הגבוה ביותר|(?:מעל|יותר מ) ?50(?:%| אחוז| אחוזים) מהקולות)$`).exec(text);
  if (localWinners && parties.length === 0) {
    const level = localWinners[1].startsWith('קלפ') ? 'stations' : 'localities';
    const measure = /הכי הרבה|הגבוה ביותר/.test(localWinners[2]) ? 'plurality' : 'majority';
    return { query: { kind: 'below-threshold-winners', level, measure }, explanation: `כל ${level === 'stations' ? 'הקלפיות' : 'היישובים'} שבהם רשימה שלא עברה את אחוז החסימה הארצי ${measure === 'majority' ? 'קיבלה יותר מ־50% מהקולות הכשרים במקום' : 'קיבלה את מספר הקולות הגבוה ביותר במקום, כולל תיקו שמסומן במפורש'}. אחוז החסימה נבדק מול התוצאות הארציות בבחירות שנבחרו.` };
  }
  if (/^(?:כמה קולות (?:היו )?חסרים ל?@0 (?:(?:כדי )?(?:לקבל|להשיג) (?:עוד מנדט|מנדט נוסף)|ל(?:מנדט נוסף|עוד מנדט|מנדט הבא))|כמה קולות (?:נוספים )?(?:הייתה |היתה )?צריכה @0 (?:כדי )?(?:לקבל|להשיג) (?:עוד מנדט|מנדט נוסף))(?: בתוצאות האמת)?$/.test(text) && parties.length === 1) {
    return { query: { kind: 'seat-gap', party: parties[0] }, explanation: `תוספת הקולות הדרושה ל${label(parties[0])} כדי להגדיל את מספר המנדטים שלה. קולות יתר הרשימות וכללי הבחירות נשארים קבועים; הסך הארצי גדל.` };
  }
  if (/^כמה קולות (?:צריכים לרדת|צריך להוריד|צריך להפחית|היו צריכים לרדת) ל?@0 (?:כדי )?(?:שתאבד מנדט|שתאבד מנדט אחד|לאבד מנדט|שירד לה מנדט|שירד מנדט)(?: בתוצאות האמת)?$/.test(text) && parties.length === 1) {
    return { query: { kind: 'seat-loss', party: parties[0] }, explanation: `הפחתת הקולות הדרושה ל${label(parties[0])} כדי להקטין את מספר המנדטים שלה. הקולות מוסרים מהסך הארצי ואינם מועברים לרשימה אחרת; קולות יתר הרשימות וכללי הבחירות נשארים קבועים.` };
  }
  const rank = /^(?:באיזה|באילו|איפה|מהם|מהן) (?:(\d+) )?(יישוב|ישוב|יישובים|ישובים|קלפי|קלפיות) (?:ה)?@0 (?:קיבלה|קבלה|קיבל) (?:את )?(?:הכי הרבה קולות|את מספר הקולות הגבוה ביותר|מספר הקולות הגבוה ביותר|האחוז הגבוה ביותר|הכי הרבה אחוזים|אחוז הקולות הגבוה ביותר)$/.exec(text);
  if (rank && parties.length === 1) {
    const limit = rank[1] ? Number(rank[1]) : /ים$|יות$/.test(rank[2]) ? 10 : 1;
    if (limit < 1 || limit > 100) return { error: 'אפשר להציג בין 1 ל־100 תוצאות.' };
    const level = rank[2].startsWith('קלפ') ? 'stations' : 'localities';
    const order = /אחוז/.test(text) ? 'percentage' : 'votes';
    return { query: { kind: 'rank', party: parties[0], level, order, limit }, explanation: `הצגת עד ${limit} ${level === 'stations' ? 'קלפיות' : 'יישובים'} עם התמיכה הגבוהה ביותר ב־${label(parties[0])}, לפי ${order === 'votes' ? 'מספר קולות' : 'אחוז מהקולות הכשרים בכל מקום'}.` };
  }
  if (/^(?:כמה קולות (?:היו )?חסרים ל?@0 (?:כדי )?לעבור את אחוז החסימה|כמה קולות נוספים (?:הייתה |היתה |היו )?צריכה @0 (?:כדי )?לעבור את אחוז החסימה)$/.test(text) && parties.length === 1) {
    const denominator = text.includes('נוספים') ? 'additional' : 'fixed';
    return { query: { kind: 'gap', party: parties[0], denominator }, explanation: `הפער של ${label(parties[0])} מאחוז החסימה, ${denominator === 'fixed' ? 'בהנחה שמספר הקולות הכשרים הכולל קבוע (העברת קולות קיימים)' : 'בהוספת קולות כשרים חדשים לרשימה ולסך הארצי'}.` };
  }
  if (/^(?:כמה (?:קולות|מנדטים|אחוזים) (?:קיבלה|קבלה|קיבל) @0|מה (?:התוצאות|התוצאה) של @0|השווה בין @0 ל@1|השוואה בין @0 ל@1)$/.test(text)) {
    return { query: { kind: 'results', parties }, explanation: `קולות, אחוז מהקולות הכשרים ומנדטים: ${parties.map(label).join(', ')}.` };
  }
  if (/^מה (?:היה קורה )?אם /.test(text)) {
    let remainder = text.replace(/^מה (?:היה קורה )?אם /, '');
    const query: Extract<QuestionQuery, { kind: 'scenario' }> = { kind: 'scenario' };
    const descriptions: string[] = [];
    const clauses = remainder.split(/ וגם | ו(?=(?:בלי|ללא|אחוז החסימה|@))/);
    for (const clause of clauses) {
      remainder = clause.trim();
      if (/^(?:לא היה אחוז חסימה|בלי אחוז חסימה|ללא אחוז חסימה)$/.test(remainder) && query.threshold === undefined) {
        query.threshold = 0; descriptions.push('ללא אחוז חסימה'); continue;
      }
      const threshold = /^אחוז החסימה (?:היה|יהיה) (\d+(?:\.\d+)?)\s*(?:%|אחוז|אחוזים)$/.exec(remainder);
      if (threshold && query.threshold === undefined) {
        const value = Number(threshold[1]);
        if (value > 100) return { error: 'אחוז החסימה חייב להיות בין 0 ל־100.' };
        query.threshold = value / 100; descriptions.push(`אחוז חסימה ${value}%`); continue;
      }
      if (/^(?:בלי|ללא|לא היו) הסכמי עודפים$/.test(remainder) && !query.withoutAgreements) {
        query.withoutAgreements = true; descriptions.push('ללא הסכמי עודפים'); continue;
      }
      const transfer = /^@([01]) (?:הייתה מקבלת|היתה מקבלת|מקבלת|תקבל) (?:את )?(כל הקולות|הקולות|\d+(?:\.\d+)?% מהקולות) של @([01])$/.exec(remainder);
      if (transfer && parties.length === 2 && !query.transfer && transfer[1] !== transfer[3]) {
        const fraction = transfer[2].includes('%') ? Number.parseFloat(transfer[2]) / 100 : 1;
        if (fraction <= 0 || fraction > 1) return { error: 'העברת קולות חייבת להיות מעל 0% ועד 100%.' };
        query.transfer = { to: parties[Number(transfer[1])], from: parties[Number(transfer[3])], fraction };
        descriptions.push(`העברת ${fraction * 100}% מקולות ${label(query.transfer.from)} אל ${label(query.transfer.to)} (הפחתה מהמקור)`); continue;
      }
      return unsupported;
    }
    return { query, explanation: `${descriptions.join('; ')}. יתר הקולות והכללים נשארים כפי שהיו. העברה מחושבת לפי תמונת המקור ומעוגלת מטה לקול שלם.` };
  }
  return unsupported;
}

export function executeElectionQuestion(query: QuestionQuery, context: QuestionContext, places?: LocalityVotes[]): Answer {
  const { votes, names, config } = context;
  const label = (id: string) => names[id] ?? id;
  const total = Object.values(votes).reduce((sum, entry) => sum + entry.votes, 0);
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('אין עדיין קולות כשרים לחישוב.');
  if (query.kind === 'comparison' || query.kind === 'comparison-scenario') return executeComparison(query, context);
  const known = (party: string) => {
    if (!Object.hasOwn(votes, party)) throw new Error('הרשימה אינה קיימת בבחירות שנבחרו.');
  };
  if (query.kind === 'insight') return executeInsight(query, context, places);
  if (query.kind === 'below-threshold-winners') {
    if (!places) throw new Error('נתוני היישובים או הקלפיות אינם זמינים לבחירות אלו.');
    const below = new Set(Object.keys(votes).filter(party => votes[party].votes < config.blockPercentage * total));
    const winners = places.flatMap(place => {
      if (place.validVotes <= 0) return [];
      const entries = Object.entries(place.votes);
      const highest = entries.reduce((max, [, count]) => Math.max(max, count), 0);
      const tied = entries.filter(([, count]) => count === highest && count > 0).length > 1;
      return entries.filter(([party, count]) => below.has(party) && count > 0
        && (query.measure === 'majority' ? count > place.validVotes / 2 : count === highest))
        .map(([party, count]) => ({ place, party, count, share: count / place.validVotes, tied }));
    }).sort((a, b) => b.share - a.share || b.count - a.count || a.place.id.localeCompare(b.place.id) || a.party.localeCompare(b.party));
    return { note: 'כל התוצאות המתאימות בקובץ הזמין, לפי שיעור התמיכה במקום. רוב פירושו יותר מ־50% מהקולות הכשרים; מקום ראשון יכול לכלול תיקו. המעמד הארצי מחושב מתמונת התוצאות הארציות, וקובץ המקומות נטען בנפרד.', columns: ['מקום', 'רשימה', 'קולות', 'אחוז', 'מיקום'], rows: winners.map(({ place, party, count, share, tied }) => [
      `${place.name}${place.pollingStation ? ` — קלפי ${place.pollingStation}${place.split !== undefined ? ` / פיצול ${place.split}` : ''}` : ''}`,
      label(party), count, `${(share * 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}%`, tied ? 'תיקו במקום הראשון' : 'מקום ראשון',
    ]) };
  }
  if (query.kind === 'rank') {
    known(query.party);
    if (!places) throw new Error('נתוני היישובים או הקלפיות אינם זמינים לבחירות אלו.');
    const ranked = rankLocalities(places, query.party, query.order).slice(0, query.limit);
    return { note: 'דירוג מתוך המקומות בקובץ הזמין. אחוזים מחושבים מתוך הקולות הכשרים במקום; מקומות ללא קולות לרשימה אינם נכללים. אין סינון מינימום. קובץ המקומות נטען בנפרד מתמונת התוצאות הארציות.', columns: ['מקום', 'קולות', 'אחוז'], rows: ranked.map(row => [
      `${row.name}${row.pollingStation ? ` — קלפי ${row.pollingStation}${row.split !== undefined ? ` / פיצול ${row.split}` : ''}` : ''}`, row.partyVotes, `${row.percentage.toFixed(2)}%`,
    ]) };
  }
  if (query.kind === 'gap') {
    known(query.party);
    const count = votes[query.party].votes;
    if (config.blockPercentage >= 1 && query.denominator === 'additional' && count < total) throw new Error('אי אפשר להגיע ל־100% בהוספת קולות בלבד כאשר יש קולות לרשימות אחרות.');
    const gap = Math.max(0, Math.ceil((config.blockPercentage * total - count) / (query.denominator === 'additional' ? 1 - config.blockPercentage : 1)));
    return { note: query.denominator === 'fixed' ? 'הסך הארצי קבוע: קולות עוברים מרשימות אחרות. הגעה לאחוז החסימה אינה מבטיחה מנדט כאשר הסף נמוך במיוחד.' : 'הוספת קולות מגדילה גם את המכנה הארצי. אין כאן תחזית לקולות שטרם נספרו.', columns: ['רשימה', 'קולות חסרים'], rows: [[label(query.party), gap]] };
  }
  const baseline = computeScenarioResults(votes, config).realResults;
  if (query.kind === 'seat-gap' || query.kind === 'seat-loss') {
    known(query.party);
    const current = baseline[query.party] ?? { votes: votes[query.party].votes, mandats: 0 };
    const [margin] = computeSeatMargins({ [query.party]: current }, votes, config);
    if (query.kind === 'seat-loss') return { note: 'הפחתת קולות מהרשימה בלבד מקטינה גם את הסך הארצי. קולות יתר הרשימות, אחוז החסימה והסכמי העודפים נשארים קבועים. מחושב במנוע האתר, כולל כלל ההכרעה שלו בתיקו. ירידה מתחת לאחוז החסימה עלולה להוריד כמה מנדטים יחד; אין כאן תחזית.', columns: ['רשימה', 'קולות להפחתה', 'מנדטים כעת'], rows: [[label(query.party), margin.lose ?? '—', current.mandats]] };
    return { note: 'הוספת קולות חדשים לרשימה בלבד מגדילה גם את הסך הארצי. קולות יתר הרשימות, אחוז החסימה והסכמי העודפים נשארים קבועים. מחושב במנוע האתר, כולל כלל ההכרעה שלו בתיקו. החיפוש מוגבל לתוספת בגודל כלל הקולות הכשרים הקיימים; אין כאן תחזית.', columns: ['רשימה', 'קולות נוספים', 'מנדטים כעת'], rows: [[label(query.party), margin.gain ?? '—', current.mandats]] };
  }
  if (query.kind === 'results') {
    query.parties.forEach(known);
    return { note: 'אחוז מתוך כלל הקולות הכשרים. מנדטים מחושבים במנוע האתר לפי כללי הבחירות שנבחרו.', columns: ['רשימה', 'קולות', 'אחוז', 'מנדטים'], rows: query.parties.map(party => [label(party), votes[party].votes, `${(votes[party].votes / total * 100).toFixed(2)}%`, baseline[party]?.mandats ?? 0]) };
  }
  const changed = structuredClone(votes);
  if (query.transfer) {
    const { from, to, fraction } = query.transfer;
    known(from); known(to);
    if (from === to || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) throw new Error('העברת קולות אינה תקינה.');
    const amount = Math.floor(votes[from].votes * fraction);
    changed[from].votes -= amount; changed[to].votes += amount;
  }
  if (query.threshold !== undefined && (!Number.isFinite(query.threshold) || query.threshold < 0 || query.threshold > 1)) throw new Error('אחוז החסימה אינו תקין.');
  const scenario = computeScenarioResults(changed, { ...config, blockPercentage: query.threshold ?? config.blockPercentage, agreements: query.withoutAgreements ? [] : config.agreements }).realResults;
  return { note: 'תרחיש מחושב, לא תחזית. הסכמים קיימים נשמרים אלא אם ביקשתם להסירם. בתיקו מופעל כלל ההכרעה הדטרמיניסטי של מנוע האתר.', columns: ['רשימה', 'לפני', 'אחרי', 'שינוי'], rows: Object.keys(votes).sort((a, b) => (scenario[b]?.mandats ?? 0) - (scenario[a]?.mandats ?? 0)).map(party => [label(party), baseline[party]?.mandats ?? 0, scenario[party]?.mandats ?? 0, (scenario[party]?.mandats ?? 0) - (baseline[party]?.mandats ?? 0)]) };
}
