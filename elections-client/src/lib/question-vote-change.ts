import { normalizeQuestion, resolveParties, type QuestionContext, type QuestionParse } from './election-questions';

/** A relative count change adds/removes valid votes; it is never an implicit transfer. */
export function parseVoteChange(input: string, context: QuestionContext): QuestionParse | null {
  // Preserve separators until the numeric token has been validated.
  const text = normalizeQuestion(input.replaceAll(',', '\uE000')).replaceAll('\uE000', ',');
  const match = /^מה (?:(?:היה קורה|יקרה) )?(?:אם|אילו) (.+?) (?:הייתה מקבלת|היתה מקבלת|היה מקבל|הייתה מקבל|מקבלת|מקבל|תקבל|יקבל) (?:ב ?)?([\d][\d,.]*)(?: (פחות|יותר) קולות| קולות (פחות|יותר))$/.exec(text);
  if (!match) return null;
  if (/(?:^|\s)[+−-]\d/.test(input)) return { error: 'יש לציין מספר קולות חיובי ולבחור פחות או יותר.' };
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(match[2])) return { error: 'יש לציין מספר קולות שלם, למשל 5000 או 5,000.' };
  const amount = Number(match[2].replaceAll(',', ''));
  if (!Number.isSafeInteger(amount) || amount <= 0) return { error: 'השינוי חייב להיות מספר שלם וחיובי של קולות בטווח החישוב.' };
  const resolved = resolveParties(normalizeQuestion(match[1]).replace(/^(?:מפלגת|רשימת) /, ''), context);
  if (resolved.ambiguous || resolved.text !== '@0' || resolved.parties.length !== 1) return { error: 'לא זוהתה רשימה חד משמעית בבחירות שנבחרו. השתמשו בשם המלא או באותיות הקלפי.' };
  const party = resolved.parties[0];
  const delta = (match[3] || match[4]) === 'פחות' ? -amount : amount;
  return { query: { kind: 'scenario', voteChange: { party, delta } },
    explanation: `${context.names[party] ?? party} מקבלת ${amount.toLocaleString('he-IL')} קולות ${delta < 0 ? 'פחות' : 'יותר'}. השינוי חל גם על סך הקולות הכשרים; קולות יתר הרשימות נשארים קבועים, ללא העברה ביניהן.` };
}
