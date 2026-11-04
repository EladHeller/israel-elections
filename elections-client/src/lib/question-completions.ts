import { normalizeQuestion, parseElectionQuestion, type QuestionContext } from './election-questions';
import { buildQuestionExamples } from './question-examples';
import { placeCompletions, emptyQuestionPlaces, type QuestionPlaces } from './question-entities';
import { completionCatalog } from './question-completion-catalog';
import { hasLocalityData, pollingStationSource } from './locality-availability';

export interface QuestionCompletion { label: string; value: string; detail?: string }
interface Branch { prefix: string; label: string; children: QuestionCompletion[] }

/** Derive suggestions from the current text, so editing or pasting never leaves stale wizard state. */
export function createQuestionCompletions(context: QuestionContext, places: QuestionPlaces = emptyQuestionPlaces) {
  const total = Object.values(context.votes).reduce((sum, entry) => sum + entry.votes, 0);
  if (total <= 0) return (_input: string) => ({ label: '', options: [] as QuestionCompletion[] });
  const parties = Object.keys(context.votes).sort((a, b) => context.votes[b].votes - context.votes[a].votes);
  const name = (id: string) => context.names[id] ?? id;
  // Ballot letters disambiguate identical names and names containing parser syntax.
  const tokens = new Map<string, string>();
  const token = (id: string) => {
    if (tokens.has(id)) return tokens.get(id)!;
    const found = parseElectionQuestion(`כמה קולות קיבלה ${name(id)}`, context);
    const result = !('error' in found) && found.query.kind === 'results' && found.query.parties[0] === id ? name(id) : id;
    tokens.set(id, result);
    return result;
  };
  const branches: Branch[] = [];
  const byPrefix = new Map<string, Branch>();
  const add = (prefix: string, label: string, children: QuestionCompletion[]) => {
    const key = normalizeQuestion(prefix);
    const existing = byPrefix.get(key);
    if (!existing) { const branch = { prefix, label, children }; branches.push(branch); byPrefix.set(key, branch); return; }
    const seen = new Set(existing.children.map(option => normalizeQuestion(option.value)));
    existing.children.push(...children.filter(option => {
      const value = normalizeQuestion(option.value);
      if (seen.has(value)) return false;
      seen.add(value); return true;
    }));
  };
  const leaves = (prefix: string, endings: string[]): QuestionCompletion[] => endings.map(label => ({ label, value: `${prefix} ${label}` }));
  const partyOptions = (prefix: string) => parties.map(id => ({ label: name(id), value: `${prefix}${token(id)}`, detail: `אותיות הקלפי: ${id}` }));
  const roots: QuestionCompletion[] = [];
  const root = (label: string, value = label) => roots.push({ label, value });

  root('כמה קולות חסרים', 'כמה קולות חסרים ל');
  add('כמה קולות חסרים ל', 'בחרו רשימה', partyOptions('כמה קולות חסרים ל'));
  for (const id of parties) {
    const prefix = `כמה קולות חסרים ל${token(id)}`;
    const below = context.votes[id].votes < total * context.config.blockPercentage;
    add(prefix, 'מה תרצו לחשב?', [{ label: below ? 'לעבור את אחוז החסימה' : 'למנדט נוסף', value: `${prefix} ${below ? 'לעבור את אחוז החסימה' : 'למנדט נוסף'}`, detail: below ? 'העברת קולות קיימים · הסך הארצי קבוע' : 'הוספת קולות חדשים · הסך הארצי גדל' }]);
  }
  root('כמה קולות קיבלה');
  add('כמה קולות קיבלה', 'בחרו רשימה', partyOptions('כמה קולות קיבלה '));
  for (const [prefix, available] of [['באיזה יישוב', hasLocalityData(context.electionId ?? null)], ['באיזו קלפי', !!pollingStationSource(context.electionId ?? '')]] as const) {
    if (!available) continue;
    root(prefix);
    add(prefix, 'באיזו רשימה להתמקד?', partyOptions(`${prefix} `));
    for (const id of parties) {
      const base = `${prefix} ${token(id)}`;
      add(base, 'לפי מספר קולות או שיעור התמיכה?', leaves(base, ['קיבלה הכי הרבה קולות', 'קיבלה את אחוז הקולות הגבוה ביותר']));
    }
  }
  if (hasLocalityData(context.electionId ?? null) && places.localities.length) {
    root('איזו רשימה קיבלה הכי הרבה קולות ביישוב', 'איזו רשימה קיבלה הכי הרבה קולות ביישוב ');
    root('מי ניצחה ביישוב', 'מי ניצחה ביישוב ');
    for (const id of parties) {
      const prefix = `כמה קולות קיבלה ${token(id)}`;
      add(prefix, 'אפשר להתמקד ביישוב', [{ label: 'ביישוב מסוים', value: `${prefix} ביישוב ` }]);
    }
  }
  root('מה היה קורה אם');
  const scenario = 'מה היה קורה אם';
  const scenarios = leaves(scenario, ['לא היה אחוז חסימה', 'לא היו הסכמי עודפים', 'אחוז החסימה היה 1%', 'אחוז החסימה היה 2%', 'אחוז החסימה היה 5%']);
  scenarios.push(...partyOptions(`${scenario} `));
  for (const id of parties) {
    const prefix = `${scenario} ${token(id)}`;
    const endings = ['לא הייתה מקבלת קולות', 'מקבלת את כל הקולות של'];
    if (context.votes[id].votes < total * context.config.blockPercentage) endings.push('הייתה עוברת את אחוז החסימה');
    add(prefix, 'מה משתנה בתרחיש?', leaves(prefix, endings));
    add(`${prefix} מקבלת את כל הקולות של`, 'מאיזו רשימה להעביר קולות?', partyOptions(`${prefix} מקבלת את כל הקולות של `).filter((_, i) => parties[i] !== id));
  }
  for (const bloc of Object.values(context.blocs?.blocks ?? {})) {
    if (!bloc.parties.some(id => context.votes[id]?.votes > 0)) continue;
    const value = `${scenario} ${bloc.label} לא היו מקבלים קולות`;
    if (!('error' in parseElectionQuestion(value, context))) scenarios.push({ label: `${bloc.label} לא היו מקבלים קולות`, value, detail: 'גוש · לפי הרכב הרשימות באתר' });
  }
  add(scenario, 'בחרו שינוי או רשימה', scenarios);
  root('השווה בין');
  add('השווה בין', 'בחרו רשימה ראשונה', partyOptions('השווה בין '));
  for (const id of parties) {
    const prefix = `השווה בין ${token(id)} ל`;
    add(`השווה בין ${token(id)}`, 'בחרו רשימה שנייה', partyOptions(prefix).filter((_, index) => parties[index] !== id));
  }
  add('', 'איך מתחילה השאלה?', roots);
  const catalog = buildQuestionExamples(context, true).flatMap(group => group.questions);
  for (const branch of completionCatalog(catalog, Object.values(context.names))) {
    add(branch.prefix, branch.prefix ? 'איך ממשיכים את השאלה?' : 'איך מתחילה השאלה?', branch.children);
  }

  const prepared = branches.map(branch => ({ ...branch, base: normalizeQuestion(branch.prefix),
    children: branch.children.map(option => ({ ...option, normalized: normalizeQuestion(option.value) }))
  })).sort((a, b) => b.prefix.length - a.prefix.length);
  const fallback = prepared.find(branch => branch.prefix === '')!;
  return (input: string): { label: string; options: QuestionCompletion[] } => {
    const geographic = placeCompletions(input, context, places);
    if (geographic) return geographic;
    const normalized = normalizeQuestion(input);
    const branch = prepared.find(({ base, prefix }) => normalized === base || normalized.startsWith(`${base} `)
      || (prefix.endsWith(' ל') && normalized.startsWith(base))) ?? fallback;
    const options = branch.children.filter(option => option.normalized !== normalized && option.normalized.startsWith(normalized));
    return { label: branch.label, options };
  };

}

export function questionCompletions(input: string, context: QuestionContext) {
  return createQuestionCompletions(context)(input);
}
