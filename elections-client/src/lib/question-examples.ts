import type { QuestionContext } from './election-questions';
import { normalizeQuestion, parseElectionQuestion } from './election-questions';
import { hasLocalityData, pollingStationSource } from './locality-availability';
import namesAll from '../data/party-names.json';
import configs from '../data/elections-config.json';
import type { PartyNames } from '../types';

export interface QuestionExampleGroup { title: string; questions: string[] }

/** Use only current lists and available data sources; no extra network requests. */
export function buildQuestionExamples(context: QuestionContext, allLists = false): QuestionExampleGroup[] {
  const { votes, names, electionId = '', config } = context;
  const parties = Object.keys(votes).filter(id => allLists || votes[id].votes > 0)
    .sort((a, b) => votes[b].votes - votes[a].votes || a.localeCompare(b));
  if (!parties.length) return [];
  const total = parties.reduce((sum, id) => sum + votes[id].votes, 0);
  const leading = allLists ? parties : parties.slice(0, 3);
  const below = parties.filter(id => votes[id].votes < total * config.blockPercentage).slice(0, allLists ? parties.length : 1);
  const label = (id: string) => names[id] ?? id;
  const groups: QuestionExampleGroup[] = [];
  const add = (title: string, questions: string[]) => groups.push({ title, questions });
  add('תוצאות ארציות', ['איזו רשימה קיבלה הכי הרבה קולות?', 'כמה קולות התבזבזו?',
    ...leading.flatMap(id => [`כמה קולות קיבלה ${label(id)}?`, `כמה מנדטים קיבלה ${label(id)}?`, `כמה אחוזים קיבלה ${label(id)}?`]),
    ...(leading.length > 1 ? [`השווה בין ${label(leading[0])} ל${label(leading[1])}?`] : [])]);
  add('מנדטים ואחוז החסימה', [
    ...leading.filter(id => votes[id].votes >= total * config.blockPercentage).flatMap(id => [`כמה קולות חסרים ל${label(id)} למנדט נוסף?`,
      ...(votes[id].mandats > 0 ? [`כמה קולות צריכים לרדת ל${label(id)} כדי שתאבד מנדט?`] : [])]),
    ...below.flatMap(id => [`כמה קולות היו חסרים ל${label(id)} לעבור את אחוז החסימה?`,
      `כמה קולות נוספים הייתה צריכה ${label(id)} כדי לעבור את אחוז החסימה?`,
      `מה היה קורה אם ${label(id)} הייתה עוברת את אחוז החסימה?`])]);
  add('תרחישים', ['מה היה קורה אם לא היה אחוז חסימה?', 'מה היה קורה אם אחוז החסימה היה 1%?',
    'מה היה קורה אם אחוז החסימה היה 5%?',
    ...(config.agreements.length ? ['מה היה קורה אם לא היו הסכמי עודפים?', 'מה היה קורה אם לא היה אחוז חסימה וגם לא היו הסכמי עודפים?'] : []),
    ...leading.map(id => `מה היה קורה אם ${label(id)} לא הייתה מקבלת קולות בכלל?`),
    ...(leading.length > 1 ? [`מה היה קורה אם כל הקולות של ${label(leading[1])} היו עוברים ל${label(leading[0])}?`,
      `מה היה קורה אם 10% מהקולות של ${label(leading[0])} היו עוברים ל${label(leading[1])}?`] : [])]);
  if (hasLocalityData(electionId)) {
    add('יישובים', [
      ...leading.flatMap(id => [`באיזה יישוב ${label(id)} קיבלה הכי הרבה קולות?`, `באילו 10 יישובים ${label(id)} קיבלה את האחוז הגבוה ביותר?`, `בכמה יישובים ${label(id)} קיבלה קולות?`]),
      'באילו יישובים היה הכי צמוד?', 'באילו יישובים הצביעו הכי דומה למדינה?',
      'באילו יישובים שיעור ההצבעה היה הכי גבוה?', 'באילו יישובים שיעור ההצבעה היה הכי נמוך?',
      'באיזה יישוב יש הכי הרבה בעלי זכות הצבעה?',
      'באילו יישובים רשימה שלא עברה את אחוז החסימה קיבלה רוב הקולות?',
      'באילו יישובים רשימה שלא עברה את אחוז החסימה קיבלה הכי הרבה קולות?',
      'באילו 5 יישובים היה הכי צמוד עם לפחות 1000 קולות כשרים?']);
  }
  if (pollingStationSource(electionId)) {
    add('קלפיות', [
      ...leading.flatMap(id => [`באיזו קלפי ${label(id)} קיבלה הכי הרבה קולות?`, `באילו 10 קלפיות ${label(id)} קיבלה את האחוז הגבוה ביותר?`]),
      'באילו קלפיות היה הכי צמוד?', 'באילו קלפיות הצביעו הכי דומה למדינה?',
      'באילו קלפיות שיעור ההצבעה היה הכי גבוה?', 'באילו קלפיות שיעור ההצבעה היה הכי נמוך?',
      'באיזו קלפי יש הכי הרבה בעלי זכות הצבעה?',
      'באילו קלפיות רשימה שלא עברה את אחוז החסימה קיבלה רוב הקולות?',
      'באילו קלפיות רשימה שלא עברה את אחוז החסימה קיבלה הכי הרבה קולות?']);
  }
  const previousId = String(Number(electionId) - 1);
  const previousNames = (namesAll as Record<string, PartyNames>)[previousId];
  if (previousNames && Object.hasOwn(configs, previousId)) {
    // A reused ballot letter does not establish continuity between lists.
    const comparable = leading.filter(id => Object.values(previousNames).filter(name => normalizeQuestion(name) === normalizeQuestion(label(id))).length === 1);
    add('השוואה לבחירות הקודמות', [
      'איזו רשימה עלתה הכי הרבה באחוזים לעומת הבחירות הקודמות?',
      'איזו רשימה ירדה הכי הרבה בקולות לעומת הבחירות הקודמות?',
      ...comparable.flatMap(id => [`בכמה אחוזים עלתה ${label(id)} לעומת הבחירות הקודמות?`,
        `בכמה מנדטים עלתה ${label(id)} לעומת הבחירות הקודמות?`,
        `מה היה קורה אם ${label(id)} הייתה מקבלת אותו מספר קולות כמו הבחירות הקודמות?`,
        `מה היה קורה אם ${label(id)} הייתה מקבלת אותו אחוז מהקולות כמו הבחירות הקודמות?`,
        ...(hasLocalityData(electionId) && hasLocalityData(previousId) ? [
          `באילו יישובים ${label(id)} התחזקה הכי הרבה מאז הבחירות הקודמות?`,
          `באילו יישובים ${label(id)} נחלשה הכי הרבה מאז הבחירות הקודמות בקולות?`] : [])])]);
  }
  // List names can collide with question syntax or be ambiguous in an election.
  const seen = new Set<string>();
  return groups.map(group => ({ ...group, questions: group.questions.filter(question => {
    if (seen.has(question) || 'error' in parseElectionQuestion(question, context)) return false;
    seen.add(question); return true;
  }) })).filter(group => group.questions.length);
}

/** Sample categories as well as questions so the four suggestions show breadth. */
export function selectQuestionExamples(groups: QuestionExampleGroup[], seed: number) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const shuffle = <T,>(values: T[]) => {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  };
  const shuffled = shuffle(groups.filter(group => group.questions.length).map(group => shuffle(group.questions)));
  const featured: string[] = [];
  while (featured.length < 4 && shuffled.some(group => group.length)) {
    for (const group of shuffled) {
      if (group.length && featured.length < 4) featured.push(group.pop()!);
    }
  }
  const selected = new Set(featured);
  return { featured, remaining: groups.map(group => ({ ...group, questions: group.questions.filter(question => !selected.has(question)) })).filter(group => group.questions.length) };
}
