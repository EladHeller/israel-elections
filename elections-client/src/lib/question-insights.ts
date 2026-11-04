import { localityHref } from './locality-results';
import type { Answer, QuestionContext, QuestionParse, QuestionQuery } from './election-questions';
import { normalizeQuestion } from './election-questions';
import type { LocalityVotes } from './party-research';
import type { PartyNames } from '../types';
import { computeScenarioResults } from './scenario';

export type InsightMetric = 'closest' | 'similarity' | 'turnout-high' | 'turnout-low' | 'eligible-high' | 'winner' | 'national-winner' | 'local-results' | 'strengthened' | 'weakened' | 'threshold-entry' | 'wasted' | 'coverage';
export type InsightQuery = { kind: 'insight'; metric: InsightMetric; level: 'localities' | 'stations'; party?: string; place?: string; station?: string; split?: number; limit: number; minimum: number; byVotes: boolean };
export interface PreviousElection { id: string; names: PartyNames; places: LocalityVotes[] }
const units = '(יישובים|ישובים|קלפיות|יישוב|ישוב|קלפי)';
const isStation = (text: string) => /קלפי/.test(text);
const placeLabel = (place: LocalityVotes) => `${place.name}${place.pollingStation ? ` — קלפי ${place.pollingStation}${place.split !== undefined ? ` / פיצול ${place.split}` : ''}` : ''}`;
const pct = (value: number) => `${value.toFixed(2)}%`;
const count = (value: number) => value.toLocaleString('he-IL');

export function parseInsight(text: string, parties: string[]): QuestionParse | null {
  const make = (metric: InsightMetric, options: Partial<InsightQuery> = {}): QuestionParse => {
    const query: InsightQuery = { kind: 'insight', metric, level: 'localities', limit: 10, minimum: 100, byVotes: false, ...options };
    if (!Number.isSafeInteger(query.minimum) || !Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 100) return { error: 'אפשר להציג בין 1 ל־100 תוצאות ולציין מינימום קולות שלם.' };
    return { query,
    explanation: metric === 'threshold-entry' ? 'הוספת מינימום קולות חדשים לרשימה כדי להגיע לאחוז החסימה; יתר הקולות וכללי הבחירות נשארים קבועים.'
      : metric === 'wasted' ? 'קולות לרשימות שלא הגיעו לאחוז החסימה הארצי, מתוך כלל הקולות הכשרים.'
      : metric === 'coverage' ? 'ספירת כל היישובים שבהם הרשימה קיבלה לפחות קול אחד.'
      : metric === 'winner' ? 'הרשימה שקיבלה הכי הרבה קולות במקום שבשאלה, כולל תיקו שמסומן במפורש.'
      : metric === 'national-winner' ? 'הרשימה שקיבלה הכי הרבה קולות בתוצאות הארציות, כולל תיקו.'
      : metric === 'local-results' ? 'קולות הרשימה ואחוזה מתוך הקולות הכשרים ביישוב או בקלפי שבשאלה.'
      : metric === 'eligible-high' ? 'דירוג לפי מספר בעלי זכות ההצבעה, ללא סינון לפי מספר הקולות הכשרים.'
      : 'בדירוגים נכללים כברירת מחדל מקומות עם לפחות 100 קולות כשרים; אפשר לציין מינימום אחר. התוצאות אינן תחזית.',
    };
  };
  if (/^כמה קולות (?:לא עברו את אחוז החסימה|הלכו לרשימות שלא עברו את אחוז החסימה|התבזבזו)$/.test(text) && !parties.length) return make('wasted');
  if (/^מה (?:היה קורה )?(?:אם|אילו) @0 (?:הייתה עוברת|היתה עוברת|עברה) את אחוז החסימה$/.test(text) && parties.length === 1) return make('threshold-entry', { party: parties[0] });
  if (/^(?:בכמה יישובים|בכמה ישובים) @0 (?:קיבלה|קבלה) קולות$/.test(text) && parties.length === 1) return make('coverage', { party: parties[0] });
  if (/^(?:מי|איזו (?:מפלגה|רשימה)|איזה (?:מפלגה|רשימה)) (?:קיבלה|קבלה|קיבל) (?:את )?הכי הרבה קולות(?: בארץ| בבחירות)?$/.test(text) && !parties.length) return make('national-winner', { minimum: 0 });
  const local = /^כמה קולות (?:קיבלה|קבלה|קיבל|קבלו|קיבלו) @0 ב(?:יישוב |ישוב |עיר )?([^@]+?)(?: בקלפי (\d+(?:\.\d+)?)(?: פיצול (\d+))?)?$/.exec(text);
  if (local && parties.length === 1 && !/(?:בחירות|כנסת|וגם|וכמה|לעומת|בהשוואה)/.test(local[1])) return make('local-results', { party: parties[0], place: local[1], station: local[2], ...(local[3] === undefined ? {} : { split: Number(local[3]) }), level: local[2] ? 'stations' : 'localities', minimum: 0 });
  const eligible = /^(?:באיזו|באיזה|באילו) (קלפי|קלפיות|יישוב|ישוב|יישובים|ישובים) יש הכי הרבה בעלי זכות (?:הצבעה|בחירה)$/.exec(text);
  if (eligible && !parties.length) return make('eligible-high', { level: isStation(text) ? 'stations' : 'localities', minimum: 0, limit: /ים$|יות$/.test(eligible[1]) ? 10 : 1 });
  const winner = /^(?:מי|איזו (?:מפלגה|רשימה)|איזה (?:מפלגה|רשימה)) (?:ניצחה|ניצח|(?:קיבלה|קבלה|קיבל) (?:את )?הכי הרבה קולות) ב(?:יישוב |ישוב )?(.+?)(?: בקלפי (\d+(?:\.\d+)?)(?: פיצול (\d+))?)?(?: ובכמה קולות)?$/.exec(text);
  if (winner && !parties.length && !/@/.test(text)) return make('winner', { place: winner[1], station: winner[2], ...(winner[3] === undefined ? {} : { split: Number(winner[3]) }), level: winner[2] ? 'stations' : 'localities', minimum: 0 });
  let base = text;
  let minimum = 100;
  let limit = 10;
  let byVotes = false;
  const filter = / עם לפחות (\d+) קולות כשרים$/.exec(base);
  if (filter) { minimum = Number(filter[1]); base = base.slice(0, filter.index); }
  const measure = / ב(קולות|אחוזים)$/.exec(base);
  if (measure) { byVotes = measure[1] === 'קולות'; base = base.slice(0, measure.index); }
  const sized = /^(באילו|באיזה|איזה|אילו) (\d+) /.exec(base);
  if (sized) { limit = Number(sized[2]); base = base.replace(sized[0], `${sized[1]} `); }
  const closest = new RegExp(`^(?:(?:באילו|באיזה|איזה|אילו) ${units} (?:היה הקרב הכי צמוד|היה הכי צמוד|הפער בין שתי המובילות היה הכי קטן)|באילו יישובים היה הכי צמוד)$`).exec(base);
  if (closest && !parties.length) return make('closest', { level: isStation(base) ? 'stations' : 'localities', minimum, limit, byVotes });
  const similar = new RegExp(`^(?:באילו|באיזה|איזה|אילו) ${units} הצביעו הכי דומה (?:לתוצאה הארצית|למדינה|לתוצאות הארציות)$`).test(base);
  if (similar && !parties.length && !measure) return make('similarity', { level: isStation(base) ? 'stations' : 'localities', minimum, limit });
  const turnout = new RegExp(`^(?:באילו|באיזה|איזה|אילו) ${units} (?:שיעור|אחוז) ההצבעה היה הכי (גבוה|נמוך)$`).exec(base);
  if (turnout && !parties.length && !measure) return make(base.endsWith('גבוה') ? 'turnout-high' : 'turnout-low', { level: isStation(base) ? 'stations' : 'localities', minimum, limit });
  const change = /^(?:באילו יישובים|באילו ישובים) @0 (התחזקה|התחזק|נחלשה|נחלש) הכי הרבה מאז הבחירות הקודמות(?: ב(קולות|אחוזים))?$/.exec(base);
  if (change && parties.length === 1) return make(change[1].startsWith('התחזק') ? 'strengthened' : 'weakened', { party: parties[0], minimum, limit, byVotes });
  return null;
}

export const insightNeedsPlaces = (query: QuestionQuery) => query.kind === 'insight' && !['threshold-entry', 'wasted', 'national-winner'].includes(query.metric);

export function executeInsight(query: InsightQuery, context: QuestionContext, places?: LocalityVotes[]): Answer {
  const { votes, names, config } = context;
  const label = (id: string) => names[id] ?? id;
  const total = Object.values(votes).reduce((sum, entry) => sum + entry.votes, 0);
  const answer = (sentences: string[], note: string, locations: LocalityVotes[] = []): Answer => ({ rows: sentences.map(sentence => [sentence]), columns: ['תשובה'], note, rowLinks: locations.map(place => context.electionId ? [{ href: localityHref(context.electionId, place), label: 'תוצאות המקום' }] : []) });
  if (query.party !== undefined && !Object.hasOwn(votes, query.party)) throw new Error('הרשימה אינה קיימת בבחירות שנבחרו.');
  if (query.metric === 'national-winner') {
    const highest = Math.max(...Object.values(votes).map(entry => entry.votes));
    const winners = Object.keys(votes).filter(id => votes[id].votes === highest).sort();
    return answer([`${winners.map(label).join(' ו')} ${winners.length > 1 ? 'בתיקו במקום הראשון' : 'במקום הראשון'} בארץ, עם ${count(highest)} קולות (${pct(100 * highest / total)}).`], 'דירוג לפי מספר הקולות הארצי, ללא סינון לפי אחוז החסימה.');
  }
  if (query.metric === 'wasted') {
    const below = Object.values(votes).filter(entry => entry.votes < config.blockPercentage * total).reduce((sum, entry) => sum + entry.votes, 0);
    return answer([`${count(below)} קולות, שהם ${pct(100 * below / total)} מהקולות הכשרים, ניתנו לרשימות שלא הגיעו לאחוז החסימה.`], 'רשימה שהגיעה בדיוק לסף אינה נכללת.');
  }
  if (query.metric === 'threshold-entry') {
    const party = query.party!;
    const current = votes[party].votes;
    if (current >= total * config.blockPercentage) return answer([`${label(party)} כבר מגיעה לאחוז החסימה.`], 'אין צורך להוסיף קולות.');
    if (config.blockPercentage >= 1) throw new Error('אי אפשר להגיע ל־100% בהוספת קולות בלבד כאשר יש קולות לרשימות אחרות.');
    let added = Math.max(0, Math.ceil((config.blockPercentage * total - current) / (1 - config.blockPercentage)));
    // Use the same multiplication comparison as the seat engine, including
    // floating-point equality at the electoral threshold.
    while (added > 0 && current + added - 1 >= (total + added - 1) * config.blockPercentage) added--;
    while (current + added < (total + added) * config.blockPercentage) added++;
    const changed = structuredClone(votes); changed[party].votes += added;
    const before = computeScenarioResults(votes, config).realResults;
    const after = computeScenarioResults(changed, config).realResults;
    const sentences = [`נוספו ל${label(party)} ${count(added)} קולות חדשים כדי להגיע לאחוז החסימה.`];
    const changes: (string | number)[][] = [];
    for (const id of Object.keys(votes)) {
      const from = before[id]?.mandats ?? 0; const to = after[id]?.mandats ?? 0;
      if (from !== to) changes.push([`${label(id)} ${to > from ? 'מקבלת' : 'מאבדת'} ${Math.abs(to - from)} מנדטים: מ־${from} ל־${to}.`, to - from]);
    }
    if (!changes.length) sentences.push('חלוקת המנדטים נשארת ללא שינוי.');
    const result = answer(sentences, 'הקולות נוספו גם למכנה הארצי. יתר הקולות והסכמי העודפים נשמרו. הגעה לסף אינה מבטיחה מנדט בכל סף אפשרי.');
    result.scenario = { voteData: changed, config };
    result.rows.push(...changes);
    return result;
  }
  if (!places) throw new Error('נתוני היישובים או הקלפיות אינם זמינים לבחירות אלו.');
  if (query.metric === 'eligible-high') {
    const valid = places.filter(place => Number.isSafeInteger(place.eligibleVoters) && place.eligibleVoters! > 0);
    if (places.length && !valid.length) throw new Error('אין נתוני בעלי זכות הצבעה תקינים לדירוג.');
    const rows = valid.sort((a, b) => b.eligibleVoters! - a.eligibleVoters! || a.id.localeCompare(b.id) || placeLabel(a).localeCompare(placeLabel(b))).slice(0, query.limit);
    return answer(rows.map(place => `${placeLabel(place)}: ${count(place.eligibleVoters!)} בעלי זכות הצבעה.`), 'מיון לפי מספר בעלי זכות ההצבעה, ולא לפי שיעור ההצבעה. מקומות ללא נתון חיובי ושלם אינם נכללים; בתיקו המיון לפי מזהה המקום.', rows);
  }
  if (query.metric === 'winner' || query.metric === 'local-results') {
    const requested = normalizeQuestion(query.place!);
    const placeAliases: Record<string, string> = { 'תל אביב': 'תל אביב יפו' };
    const stationMatches = (place: LocalityVotes) => (query.station === undefined || Number(place.pollingStation) === Number(query.station)) && (query.split === undefined || place.split === query.split);
    const exact = places.filter(place => normalizeQuestion(place.name) === requested && stationMatches(place));
    const matches = exact.length ? exact : places.filter(place => normalizeQuestion(place.name) === placeAliases[requested] && stationMatches(place));
    if (!matches.length) throw new Error('המקום לא נמצא. כתבו שם יישוב מפורש כפי שהוא מופיע באתר; אין זיהוי אוטומטי של היישוב שלכם.');
    if (matches.length > 1) throw new Error('המקום אינו חד משמעי. יש לבחור יישוב או קלפי מדויקים, כולל פיצול אם קיים.');
    if (query.metric === 'local-results') {
      const place = matches[0];
      if (place.validVotes <= 0) throw new Error('אין קולות כשרים במקום לחישוב אחוז התמיכה.');
      const received = place.votes[query.party!] ?? 0;
      return answer([`${placeLabel(place)}: ${label(query.party!)} קיבלה ${count(received)} קולות, שהם ${pct(100 * received / place.validVotes)} מהקולות הכשרים במקום.`], 'הנתונים מתייחסים למקום שנבחר בלבד; שם היישוב חייב להתאים לשם המופיע באתר.', [place]);
    }
    const locations: LocalityVotes[] = [];
    return answer(matches.flatMap(place => {
      const ranked = Object.entries(place.votes).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      if (!ranked.length || place.validVotes <= 0) return [];
      locations.push(place);
      const highest = ranked[0][1]; const winners = ranked.filter(([, value]) => value === highest);
      const gap = highest - (ranked[1]?.[1] ?? 0);
      return [`${placeLabel(place)}: ${winners.map(([id]) => label(id)).join(' ו')} ${winners.length > 1 ? 'בתיקו במקום הראשון' : 'במקום הראשון'}, עם ${count(highest)} קולות (${pct(100 * highest / place.validVotes)}). הפער מהמקום השני: ${count(gap)} קולות.`];
    }), 'פער מחושב מול הרשימה השנייה, ובתיקו הפער אפס.', locations);
  }
  const eligible = places.filter(place => place.validVotes > 0 && place.validVotes >= query.minimum);
  if (query.metric === 'coverage') {
    const supported = places.filter(place => (place.votes[query.party!] ?? 0) > 0).length;
    return answer([`${label(query.party!)} קיבלה קולות ב־${count(supported)} מתוך ${count(places.length)} היישובים.`], 'כל היישובים נכללים, ללא מינימום גודל.');
  }
  if (query.metric === 'strengthened' || query.metric === 'weakened') {
    const previous = context.previous;
    if (!previous) throw new Error('אין נתוני יישובים למערכת הבחירות הקודמת.');
    const fullName = normalizeQuestion(label(query.party!));
    const ids = Object.keys(previous.names).filter(id => normalizeQuestion(previous.names[id]) === fullName);
    if (ids.length !== 1) throw new Error('אין התאמה חד משמעית בשם הרשימה בבחירות הקודמות. אין הנחה שאותיות זהות או רשימה משותפת הן אותה רשימה.');
    const oldPlaces = new Map(previous.places.map(place => [place.id, place]));
    const changes = eligible.flatMap(place => {
      const old = oldPlaces.get(place.id);
      if (!old || old.name !== place.name || old.validVotes < query.minimum || old.validVotes <= 0) return [];
      const before = old.votes[ids[0]] ?? 0; const after = place.votes[query.party!] ?? 0;
      const delta = query.byVotes ? after - before : 100 * (after / place.validVotes - before / old.validVotes);
      return (query.metric === 'strengthened' ? delta > 0 : delta < 0) ? [{ place, delta }] : [];
    }).sort((a, b) => (query.metric === 'strengthened' ? b.delta - a.delta : a.delta - b.delta) || a.place.id.localeCompare(b.place.id)).slice(0, query.limit);
    return answer(changes.map(({ place, delta }) => `${placeLabel(place)}: ${label(query.party!)} ${delta > 0 ? 'עלתה' : 'ירדה'} ב־${query.byVotes ? count(Math.abs(delta)) + ' קולות' : Math.abs(delta).toFixed(2) + ' נקודות אחוז'}.`), `השוואה לבחירות ${previous.id}, לפי שם רשימה זהה וסמל יישוב ושם זהים בלבד. שינוי בהרכב רשימה או בגבולות היישוב אינו מזוהה; לא כל היישובים בהכרח נכללים.`, changes.map(row => row.place));
  }
  if (query.metric === 'turnout-high' || query.metric === 'turnout-low') {
    const valid = eligible.filter(place => Number.isSafeInteger(place.eligibleVoters) && place.eligibleVoters! > 0 && Number.isSafeInteger(place.voters) && place.voters! >= place.validVotes && place.voters! <= place.eligibleVoters!);
    if (eligible.length && !valid.length) throw new Error('אין נתוני בעלי זכות בחירה ומצביעים תקינים לחישוב שיעור הצבעה.');
    const rows = valid.map(place => ({ place, rate: 100 * place.voters! / place.eligibleVoters! })).sort((a, b) => (query.metric === 'turnout-high' ? b.rate - a.rate : a.rate - b.rate) || a.place.id.localeCompare(b.place.id)).slice(0, query.limit);
    return answer(rows.map(({ place, rate }) => `${placeLabel(place)}: שיעור הצבעה ${pct(rate)}, ${count(place.voters!)} מצביעים מתוך ${count(place.eligibleVoters!)} בעלי זכות בחירה.`), `שיעור הצבעה כולל קולות פסולים. מינימום ${query.minimum} כשרים. מקומות עם נתוני מצביעים או בעלי זכות בחירה חסרים או סותרים אינם נכללים.`, rows.map(row => row.place));
  }
  const ranked = eligible.flatMap(place => {
    if (query.metric === 'closest') {
      const sorted = Object.entries(place.votes).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      if (sorted.length < 2) return [];
      const gap = sorted[0][1] - sorted[1][1];
      return [{ place, score: query.byVotes ? gap : gap / place.validVotes, sentence: `${placeLabel(place)}: ${label(sorted[0][0])} ו${label(sorted[1][0])}, פער של ${count(gap)} קולות (${pct(100 * gap / place.validVotes)} מהכשרים)${gap === 0 ? ' — תיקו במקום הראשון' : ''}.` }];
    }
    const keys = new Set([...Object.keys(votes), ...Object.keys(place.votes)]);
    let distance = 0;
    for (const id of keys) distance += Math.abs((place.votes[id] ?? 0) / place.validVotes - (votes[id]?.votes ?? 0) / total);
    const similarity = Math.max(0, 100 * (1 - distance / 2));
    return [{ place, score: distance, sentence: `${placeLabel(place)}: ציון דמיון ${pct(similarity)} לתוצאה הארצית.` }];
  }).sort((a, b) => a.score - b.score || a.place.id.localeCompare(b.place.id)).slice(0, query.limit);
  return answer(ranked.map(row => row.sentence), query.metric === 'closest' ? `הפער בין שתי המובילות, ממוין לפי ${query.byVotes ? 'מספר קולות' : 'אחוז מהקולות הכשרים'}. מינימום ${query.minimum} כשרים. תיקו נכלל; מקום עם רשימה אחת שקיבלה קולות אינו נכלל.` : `ציון הדמיון הוא 100 כפול אחד פחות חצי מסכום ההפרשים המוחלטים בין שיעורי כל הרשימות במקום ובארץ. 100% מציין התפלגות זהה. מינימום ${query.minimum} כשרים. זהו מדד חישובי, לא מדד רשמי.`, ranked.map(row => row.place));
}
