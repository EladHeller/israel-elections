import { normalizeQuestion } from './election-questions';
import type { QuestionCompletion } from './question-completions';

interface Node { value: string; children: Map<string, Node> }
// Keep familiar openings in one choice; names are also kept whole below.
const openings = ['כמה קולות חסרים ל', 'כמה קולות קיבלה', 'כמה מנדטים קיבלה', 'כמה אחוזים קיבלה',
  'כמה קולות צריכים לרדת ל', 'כמה קולות נוספים הייתה צריכה', 'כמה קולות היו חסרים ל',
  'כמה קולות התבזבזו', 'באיזה יישוב', 'באיזו קלפי', 'מה היה קורה אם', 'איזו רשימה', 'השווה בין', 'באילו', 'בכמה'];

/** Build a compact prefix tree from the same executable questions used by the examples. */
export function completionCatalog(questions: string[], names: string[]) {
  const root: Node = { value: '', children: new Map() };
  const atoms = [...new Set(names.map(normalizeQuestion))].sort((a, b) => b.length - a.length);
  const split = (text: string) => {
    const result: string[] = [];
    while (text) {
      const name = atoms.find(name => text === name || text.startsWith(`${name} `)
        || text === `ל${name}` || text.startsWith(`ל${name} `));
      const part = name ? (text.startsWith(name) ? name : `ל${name}`) : text.split(' ')[0];
      result.push(part); text = text.slice(part.length).trimStart();
    }
    return result;
  };
  for (const question of questions) {
    const normalized = normalizeQuestion(question);
    const opening = openings.find(prefix => normalized.startsWith(prefix));
    if (!opening) continue;
    const rest = split(normalized.slice(opening.length).trimStart());
    const parts = [opening, ...rest];
    let node = root;
    for (const [index, part] of parts.entries()) {
      const value = node.value + (index === 0 || (index === 1 && opening.endsWith(' ל')) ? '' : ' ') + part;
      if (!node.children.has(value)) node.children.set(value, { value, children: new Map() });
      node = node.children.get(value)!;
    }
  }
  const branches: { prefix: string; children: QuestionCompletion[] }[] = [];
  const visit = (node: Node) => {
    if (!node.children.size) return;
    branches.push({ prefix: node.value, children: [...node.children.values()].map(child => {
      let next = child;
      // Do not skip a list choice just because that list has a single continuation.
      while (node.value && next.children.size === 1 && !atoms.some(atom => { const suffix = next.value.slice(node.value.length).trim(); return suffix === atom || suffix === `ל${atom}`; })) next = [...next.children.values()][0];
      return { label: next.value.slice(node.value.length).trim(), value: next.value };
    }) });
    for (const child of node.children.values()) visit(child);
  };
  visit(root);
  return branches;
}
