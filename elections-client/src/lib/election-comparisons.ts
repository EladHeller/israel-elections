import type { BlocsConfig, ElectionConfig, PartyNames, VoteData } from '../types';
import type { Answer, QuestionContext, QuestionParse } from './election-questions';
import { normalizeQuestion, resolveParties } from './election-questions';
import { computeScenarioResults } from './scenario';

export interface ElectionSnapshot {
  id: string;
  votes: VoteData;
  names: PartyNames;
  config: ElectionConfig;
  blocs?: BlocsConfig;
}
export type ComparisonTarget = { type: 'list'; id: string } | { type: 'bloc'; id: string };
export type ChangeMeasure = 'both' | 'points' | 'relative' | 'votes' | 'seats';
export type ComparisonQuery =
  | { kind: 'comparison'; source: string; target?: ComparisonTarget; direction?: 'up' | 'down'; measure: ChangeMeasure }
  | { kind: 'comparison-scenario'; target: ComparisonTarget; mode: 'zero' | 'votes' | 'share'; source?: string };

const count = (n: number) => n.toLocaleString('he-IL', { maximumFractionDigits: 2 });
const pct = (n: number) => `${count(n)}%`;
const identity = (name: string) => normalizeQuestion(name);
const sameListError = 'אין התאמה חד משמעית בשם הרשימה בין הבחירות. איחודים ופיצולים אינם מושווים אוטומטית, ואותיות קלפי זהות אינן הוכחה לזהות רשימה.';

function resolveTarget(text: string, context: QuestionContext): ComparisonTarget | null {
  const clean = text.replace(/^(?:רשימת|מפלגת) /, '');
  const blocNames: Record<string, string[]> = {
    gushA: ['גוש הימין', 'הימין'],
    gushB: ['גוש השמאל מרכז', 'גוש המרכז שמאל', 'השמאל מרכז', 'המרכז שמאל'],
    gushC: ['רשימות ערביות', 'מפלגות ערביות', 'הרשימות הערביות', 'המפלגות הערביות', 'הרשימות הערביות יחד', 'המפלגות הערביות יחד'],
  };
  const blocs = Object.entries(context.blocs?.blocks ?? {}).filter(([id, bloc]) =>
    [bloc.label, ...(blocNames[id] ?? [])].some(alias => identity(alias) === clean));
  if (blocs.length === 1) return { type: 'bloc', id: blocs[0][0] };
  const found = resolveParties(clean, context);
  if (!found.ambiguous && found.text === '@0' && found.parties.length === 1) return { type: 'list', id: found.parties[0] };
  return null;
}

const electionWords: Record<string, string> = {
  'העשרים ואחת': '21', 'העשרים ושתיים': '22', 'העשרים ושלוש': '23',
  'העשרים וארבע': '24', 'העשרים וחמש': '25', 'העשרים ושש': '26',
};
function sourceElection(value: string, context: QuestionContext): string | null {
  value = value.replace(/^ב(?=בחירות|כנסת|הכנסת)/, '').replace(/^(בחירות הקודמות)$/, 'הבחירות הקודמות').replace(/ ה (\d+)$/, ' $1');
  if (value === 'הבחירות הקודמות' || value === 'פעם שעברה' || value === 'הפעם הקודמת') {
    const id = Number(context.electionId) - 1;
    return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
  }
  const match = /^(?:הבחירות לכנסת|הבחירות|בחירות לכנסת|בחירות|כנסת|הכנסת) (.+)$/.exec(value);
  const id = match && (electionWords[match[1]] ?? (/^\d+$/.test(match[1]) ? String(Number(match[1])) : null));
  return id && Number(id) > 0 && Number(id) < Number(context.electionId) ? id : null;
}

function measureOf(text: string): ChangeMeasure {
  if (/נקודות אחוז/.test(text)) return 'points';
  if (/יחסי/.test(text)) return 'relative';
  if (/מנדטים/.test(text)) return 'seats';
  if (/קולות/.test(text) && !/אחוז/.test(text)) return 'votes';
  return 'both';
}

export function parseComparison(text: string, context: QuestionContext): QuestionParse | null {
  const finish = (query: ComparisonQuery): QuestionParse => ({ query, explanation: query.kind === 'comparison'
    ? `השוואה ארצית בין בחירות ${query.source} לבחירות ${context.electionId}. שיעורי התמיכה מחושבים מהקולות הכשרים בכל מערכת בנפרד.`
    : `תרחיש ארצי: ${query.mode === 'zero' ? 'הסרת קולות היעד מהסך הארצי' : `החלפת ${query.mode === 'votes' ? 'מספר הקולות' : 'שיעור התמיכה'} של היעד בערך מבחירות ${query.source}`}. קולות יתר הרשימות וכללי הבחירות הנבחרות נשארים קבועים.` });
  const badSource = { error: 'יש לציין מערכת בחירות קודמת קיימת, למשל: לעומת הבחירות הקודמות או לעומת הכנסת ה־25.' };
  const badTarget = { error: 'לא זוהתה רשימה או קבוצת רשימות חד משמעית בבחירות שנבחרו.' };
  const zero = /^מה (?:היה קורה )?אם (.+?) (?:לא (?:הייתה מקבלת|היתה מקבלת|היו מקבלות|היו מקבלים|מקבלת|מקבלות|מקבלים) קולות(?: בכלל)?|(?:הייתה מקבלת|היתה מקבלת|היו מקבלות|היו מקבלים) (?:אפס|0) קולות)$/.exec(text);
  if (zero) {
    const target = resolveTarget(zero[1], context);
    return target ? finish({ kind: 'comparison-scenario', target, mode: 'zero' }) : badTarget;
  }
  const scenario = /^מה (?:היה קורה )?אם (.+?) (?:הייתה מקבלת|היתה מקבלת|היו מקבלות|היו מקבלים|מקבלת|מקבלות) (?:את )?אותו (מספר קולות|אחוז(?: מהקולות)?) (?:כמו|כמו ב|כמו בבחירות|כמו בבחירות לכנסת) (.+)$/.exec(text);
  if (scenario) {
    const target = resolveTarget(scenario[1], context);
    let sourceText = scenario[3].replace(/^ב(?=כנסת|הכנסת)/, '');
    if (/^\d+$/.test(sourceText) || electionWords[sourceText]) sourceText = `הכנסת ${sourceText}`;
    const source = sourceElection(sourceText, context);
    return !target ? badTarget : !source ? badSource : finish({ kind: 'comparison-scenario', target, source, mode: scenario[2].startsWith('מספר') ? 'votes' : 'share' });
  }
  const match = /^(.*?) (?:לעומת|בהשוואה ל|מאז) ?(.+)$/.exec(text)
    ?? (/^(?:בכמה|איזו רשימה|איזה רשימה|מי) /.test(text) && /עלתה|עלה|ירדה|ירד|התחזקה|התחזק|נחלשה|נחלש|עלו|ירדו/.test(text) ? ['', text, 'הבחירות הקודמות'] : null);
  if (!match) return null;
  // Geographic comparisons belong to the geographic operator and its data loader.
  if (/יישוב|ישוב|קלפי/.test(match[1])) return null;
  const source = sourceElection(match[2], context);
  const metric = '(?:אחוזים(?: יחסיים)?|נקודות אחוז|קולות|מנדטים)';
  const single = new RegExp(`^בכמה(?: ${metric})? (?:עלתה|עלה|ירדה|ירד|התחזקה|התחזק|נחלשה|נחלש) (.+)$`).exec(match[1])
    ?? new RegExp(`^בכמה(?: ${metric})? (.+?) (?:עלתה|עלה|ירדה|ירד|התחזקה|התחזק|נחלשה|נחלש|עלו|ירדו|התחזקו|נחלשו)$`).exec(match[1]);
  const ranking = new RegExp(`^(?:איזו רשימה|איזה רשימה|מי) (?:עלתה|עלה|ירדה|ירד|התחזקה|התחזק|נחלשה|נחלש) הכי הרבה(?: ב(?:${metric}|אחוז הקולות))?$`).test(match[1]);
  if (!single && !ranking) return null;
  if (!source) return badSource;
  const measure = measureOf(match[1]);
  if (ranking) return finish({ kind: 'comparison', source, direction: /ירד|נחלש/.test(match[1]) ? 'down' : 'up', measure });
  const target = resolveTarget(single![1], context);
  return target ? finish({ kind: 'comparison', source, target, measure }) : badTarget;
}

function totalVotes(votes: VoteData): number {
  const values = Object.values(votes).map(entry => entry.votes);
  const total = values.reduce((sum, n) => sum + n, 0);
  if (values.some(n => !Number.isSafeInteger(n) || n < 0) || !Number.isSafeInteger(total) || total <= 0) throw new Error('אין נתוני קולות כשרים תקינים להשוואה.');
  return total;
}

export function matchingList(id: string, current: Pick<ElectionSnapshot, 'names' | 'votes'>, previous: ElectionSnapshot): string {
  if (!Object.hasOwn(current.votes, id) || !current.names[id]) throw new Error(sameListError);
  const name = identity(current.names[id]);
  const now = Object.keys(current.votes).filter(key => current.names[key] && identity(current.names[key]) === name);
  const old = Object.keys(previous.votes).filter(key => previous.names[key] && identity(previous.names[key]) === name);
  if (now.length !== 1 || old.length !== 1) throw new Error(sameListError);
  return old[0];
}

function members(target: ComparisonTarget, snapshot: Pick<ElectionSnapshot, 'votes' | 'blocs'>): string[] {
  if (target.type === 'list') {
    if (!Object.hasOwn(snapshot.votes, target.id)) throw new Error('הרשימה אינה קיימת בבחירות שנבחרו.');
    return [target.id];
  }
  const bloc = snapshot.blocs?.blocks[target.id];
  if (!bloc || new Set(bloc.parties).size !== bloc.parties.length) throw new Error('אין הגדרת גוש תקינה במערכת הבחירות להשוואה.');
  const ids = bloc.parties.filter(id => Object.hasOwn(snapshot.votes, id));
  if (!ids.length) throw new Error('אין נתוני רשימות לגוש במערכת הבחירות להשוואה.');
  return ids;
}

function distribute(votes: VoteData, ids: string[], desired: number): VoteData {
  if (!Number.isSafeInteger(desired) || desired < 0) throw new Error('מספר הקולות בתרחיש חורג מטווח החישוב.');
  const changed = structuredClone(votes);
  const current = ids.reduce((sum, id) => sum + votes[id].votes, 0);
  if (desired > 0 && current === 0 && ids.length > 1) throw new Error('אין תמיכה קיימת שממנה אפשר לקבוע חלוקת קולות בתוך הגוש.');
  const allocations = ids.map(id => {
    const exact = ids.length === 1 ? desired : current === 0 ? 0 : desired * (votes[id].votes / current);
    return { id, amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  }).sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  const left = desired - allocations.reduce((sum, row) => sum + row.amount, 0);
  allocations.forEach((row, index) => { changed[row.id].votes = row.amount + (index < left ? 1 : 0); });
  totalVotes(changed);
  return changed;
}

export function executeComparison(query: ComparisonQuery, context: QuestionContext): Answer {
  const current: ElectionSnapshot = { id: context.electionId ?? '', ...context };
  const total = totalVotes(current.votes);
  const previous = query.kind === 'comparison-scenario' && query.mode === 'zero' ? undefined : context.comparison;
  if ((query.kind === 'comparison' || query.mode !== 'zero') && (!previous || previous.id !== query.source || Number(previous.id) >= Number(current.id))) throw new Error('נתוני מערכת הבחירות המבוקשת אינם זמינים להשוואה.');
  const oldTotal = previous ? totalVotes(previous.votes) : 0;
  const oldTarget = (target: ComparisonTarget): ComparisonTarget => target.type === 'list' ? { type: 'list', id: matchingList(target.id, current, previous!) } : target;
  const sum = (snapshot: ElectionSnapshot, ids: string[]) => ids.reduce((n, id) => n + snapshot.votes[id].votes, 0);
  const label = (target: ComparisonTarget) => target.type === 'list' ? current.names[target.id] ?? target.id : current.blocs!.blocks[target.id].label;
  const membership = (target: ComparisonTarget) => target.type === 'list' ? 'התאמה לפי שם רשימה זהה בלבד; שינויים בהרכב הרשימה אינם מזוהים.'
    : `הרכב הגוש לפי הגדרות האתר: בבחירות ${current.id}: ${members(target, current).map(id => current.names[id] ?? id).join(', ')}${previous ? `; בבחירות ${previous.id}: ${members(target, previous).map(id => previous.names[id] ?? id).join(', ')}` : ''}. ההרכב עשוי להשתנות בין הבחירות.`;
  if (query.kind === 'comparison-scenario') {
    const ids = members(query.target, current);
    const original = sum(current, ids);
    const old = query.mode === 'zero' ? 0 : sum(previous!, members(oldTarget(query.target), previous!));
    const others = total - original;
    let desired = old;
    if (query.mode === 'share') {
      if (old === oldTotal) {
        if (others > 0) throw new Error('אי אפשר להגיע ל־100% תמיכה בלי לשנות גם את קולות יתר הרשימות.');
        desired = original;
      } else {
        if (!others && old > 0) throw new Error('אי אפשר לשחזר שיעור תמיכה נמוך מ־100% כשאין קולות לרשימות אחרות.');
        desired = Math.round(old * (others / (oldTotal - old)));
      }
    }
    const changed = distribute(current.votes, ids, desired);
    const before = computeScenarioResults(current.votes, current.config).realResults;
    const after = computeScenarioResults(changed, current.config).realResults;
    const intro = `${label(query.target)}: מ־${count(original)} ל־${count(desired)} קולות; שיעור התמיכה בתרחיש ${pct(100 * desired / totalVotes(changed))}.`;
    const rows: (string | number)[][] = [[intro]];
    for (const id of Object.keys(current.votes)) {
      const from = before[id]?.mandats ?? 0; const to = after[id]?.mandats ?? 0;
      if (from !== to) rows.push([`${current.names[id] ?? id} ${to > from ? 'מקבלת' : 'מאבדת'} ${Math.abs(to - from)} מנדטים: מ־${from} ל־${to}.`, to - from]);
    }
    if (rows.length === 1) rows.push(['חלוקת המנדטים נשארת ללא שינוי.']);
    return { columns: ['תשובה'], rows, note: `${membership(query.target)} קולות יתר הרשימות נשארים קבועים; המכנה הארצי משתנה. בתוך גוש נשמר יחס התמיכה הנוכחי, בעיגול לקולות שלמים בשיטת השאריות הגדולות. שיעור היסטורי משוחזר בקירוב בגלל העיגול. אחוז החסימה, ההסכמים ושיטת חלוקת המנדטים הם של הבחירות שנבחרו. תרחיש חישובי, לא תחזית.` };
  }
  const beforeSeats = query.measure === 'seats' ? computeScenarioResults(previous!.votes, previous!.config).realResults : {};
  const afterSeats = query.measure === 'seats' ? computeScenarioResults(current.votes, current.config).realResults : {};
  const targets: ComparisonTarget[] = query.target ? [query.target] : Object.keys(current.votes).flatMap(id => {
    try { matchingList(id, current, previous!); return [{ type: 'list' as const, id }]; } catch { return []; }
  });
  const changes = targets.map(target => {
    const ids = members(target, current); const oldIds = members(oldTarget(target), previous!);
    const before = sum(previous!, oldIds); const after = sum(current, ids);
    const from = 100 * before / oldTotal; const to = 100 * after / total;
    const points = to - from; const relative = before === 0 ? null : 100 * (to / from - 1);
    const seats = ids.reduce((n, id) => n + (afterSeats[id]?.mandats ?? 0), 0) - oldIds.reduce((n, id) => n + (beforeSeats[id]?.mandats ?? 0), 0);
    const delta = query.measure === 'votes' ? after - before : query.measure === 'seats' ? seats : query.measure === 'relative' ? relative : points;
    const movement = (n: number, unit: string) => Math.abs(n) < 1e-10 ? `ללא שינוי ב${unit}` : `${n > 0 ? 'עלייה' : 'ירידה'} של ${count(Math.abs(n))} ${unit}`;
    let sentence = `${label(target)}: מ־${pct(from)} ל־${pct(to)} מהקולות הכשרים — `;
    if (query.measure === 'votes') sentence = `${label(target)}: מ־${count(before)} ל־${count(after)} קולות — ${movement(after - before, 'קולות')}.`;
    else if (query.measure === 'seats') sentence = `${label(target)}: ${movement(seats, 'מנדטים')} (מ־${oldIds.reduce((n, id) => n + (beforeSeats[id]?.mandats ?? 0), 0)} ל־${ids.reduce((n, id) => n + (afterSeats[id]?.mandats ?? 0), 0)}).`;
    else {
      const rel = relative === null ? 'לא ניתן לחשב שינוי יחסי מבסיס אפס' : `${relative >= 0 ? 'גידול' : 'קיטון'} יחסי של ${pct(Math.abs(relative))}`;
      sentence += query.measure === 'relative' ? rel : `${movement(points, 'נקודות אחוז')}${query.measure === 'both' ? `, ${rel}` : ''}`;
      sentence += '.';
    }
    return { sentence, delta };
  }).filter(row => !query.direction || (row.delta !== null && (query.direction === 'up' ? row.delta > 1e-10 : row.delta < -1e-10)))
    .sort((a, b) => (query.direction === 'down' ? a.delta! - b.delta! : b.delta! - a.delta!) || a.sentence.localeCompare(b.sentence));
  const winners = query.target || !changes.length ? changes : changes.filter(row => Math.abs(row.delta! - changes[0].delta!) < 1e-10);
  return { columns: ['תשובה'], rows: winners.map(row => [row.sentence]), note: `השוואה מבחירות ${previous!.id} לבחירות ${current.id}. ${query.target ? membership(query.target) : 'הדירוג כולל רק רשימות עם התאמה חד משמעית בשם בשתי הבחירות; רשימות חדשות, איחודים ופיצולים ללא התאמה אינם נכללים. כל השוויונות במקום הראשון מוצגים. דירוג באחוזים ללא פירוט הוא לפי נקודות אחוז.'} שינוי יחסי באחוזים מתייחס לשיעור התמיכה, ולא למספר הקולות. התוצאות כפופות למצב הספירה בכל מערכת.` };
}
