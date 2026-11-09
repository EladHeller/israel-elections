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

  const prepare = (items: Branch[]) => items.map(branch => ({ ...branch, base: normalizeQuestion(branch.prefix),
    children: branch.children.map(option => ({ ...option, normalized: normalizeQuestion(option.value) }))
  })).sort((a, b) => b.prefix.length - a.prefix.length);
  const prepared = prepare(branches);
  const fallback = prepared.find(branch => branch.prefix === '')!;
  const lookup = (text: string, choices = prepared) => {
    const normalized = normalizeQuestion(text);
    const branch = choices.find(({ base, prefix }) => normalized === base || normalized.startsWith(`${base} `)
      || (prefix.endsWith(' ל') && normalized.startsWith(base)));
    const selected = branch ?? (choices === prepared ? fallback : undefined);
    return { label: selected?.label ?? '', options: (selected?.children ?? [])
      .filter(option => option.normalized !== normalized && option.normalized.startsWith(normalized)) };
  };
  const chainable = (text: string) => {
    const parsed = parseElectionQuestion(text, context);
    return !('error' in parsed) && (parsed.query.kind === 'scenario'
      || parsed.query.kind === 'comparison-scenario' && parsed.query.mode === 'zero' && parsed.query.target.type === 'list');
  };
  // Reuse supported single-condition choices, then let the parser reject conflicts with the existing scenario.
  const atoms = [...new Set([...catalog, ...branches.flatMap(branch => branch.children.map(option => option.value))].map(normalizeQuestion))].filter(text => text.startsWith(`${scenario} `)
    && !text.includes(' וגם ') && chainable(text));
  const validAddition = (prefix: string, text: string) => {
    const combined = `${prefix} ${text.slice(scenario.length).trimStart()}`;
    const parsed = parseElectionQuestion(combined, context);
    return !('error' in parsed) && parsed.query.kind === 'scenario';
  };
  let cachedPrefix = '';
  let continuations: ReturnType<typeof prepare> = [];
  const afterConjunction = (prefix: string, tail: string) => {
    if (prefix !== cachedPrefix) {
      cachedPrefix = prefix;
      const valid = atoms.filter(text => validAddition(prefix, text));
      continuations = prepare(completionCatalog(valid, parties.map(token)).map(branch => ({ ...branch, label: 'בחרו תנאי נוסף' })));
    }
    return lookup(`${scenario} ${tail}`.trim(), continuations).options.map(option => ({ ...option,
      value: `${prefix} ${option.value.slice(scenario.length).trimStart()}` }));
  };
  return (input: string): { label: string; options: QuestionCompletion[] } => {
    if (input.length > 600) return { label: '', options: [] };
    const geographic = placeCompletions(input, context, places);
    if (geographic) return geographic;
    const clean = input.trim().replace(/[?？!]+$/, '').trimEnd();
    const conjunction = [...clean.matchAll(/\s+וגם(?:\s+|$)/g)].at(-1);
    const suggestions = conjunction
      ? { label: 'בחרו תנאי נוסף', options: afterConjunction(clean.slice(0, conjunction.index! + conjunction[0].length).trimEnd(),
        clean.slice(conjunction.index! + conjunction[0].length)) }
      : lookup(input);
    const options: QuestionCompletion[] = suggestions.options.filter(option => option.value.length <= 600);
    if (chainable(clean) && atoms.some(text => validAddition(`${clean} וגם`, text)) && `${clean} וגם `.length <= 600) {
      options.push({ label: 'וגם', value: `${clean} וגם `, detail: 'הוספת תנאי לתרחיש' });
    }
    return { label: suggestions.label, options };
  };

}

export function questionCompletions(input: string, context: QuestionContext) {
  return createQuestionCompletions(context)(input);
}
