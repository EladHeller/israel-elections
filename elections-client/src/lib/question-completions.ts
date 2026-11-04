import { normalizeQuestion, parseElectionQuestion, type QuestionContext } from './election-questions';
import { hasLocalityData, pollingStationSource } from './locality-availability';

export interface QuestionCompletion { label: string; value: string; detail?: string }
interface Branch { prefix: string; label: string; children: QuestionCompletion[] }

/** Derive suggestions from the current text, so editing or pasting never leaves stale wizard state. */
export function createQuestionCompletions(context: QuestionContext) {
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
  const add = (prefix: string, label: string, children: QuestionCompletion[]) => branches.push({ prefix, label, children });
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
  add('', 'איך מתחילה השאלה?', roots);

  return (input: string): { label: string; options: QuestionCompletion[] } => {
    const normalized = normalizeQuestion(input);
    const branch = branches.filter(({ prefix }) => {
      const base = normalizeQuestion(prefix);
      return normalized === base || normalized.startsWith(`${base} `) || (prefix.endsWith(' ל') && normalized.startsWith(base));
    }).sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? branches[branches.length - 1];
    const options = branch.children.filter(option => {
      const value = normalizeQuestion(option.value);
      return value !== normalized && value.startsWith(normalized);
    });
    return { label: branch.label, options };
  };
}

export function questionCompletions(input: string, context: QuestionContext) {
  return createQuestionCompletions(context)(input);
}
