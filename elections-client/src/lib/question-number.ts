export interface QuestionNumber { percent: boolean; suffix: string; min: number; max: number; positive: boolean; label: string }

export function numberReplacement(draft: string, config: QuestionNumber): { text: string } | { error: string } {
  const input = draft.normalize('NFKC').trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(input)) return { error: 'יש להזין מספר תקין, למשל 10,000 או 2.5 לאחוזים.' };
  const value = Number(input.replaceAll(',', ''));
  if (!Number.isFinite(value) || (!config.percent && !Number.isSafeInteger(value))) return { error: 'מספר הקולות או התוצאות חייב להיות מספר שלם בטווח החישוב.' };
  if (value < config.min || value > config.max || (config.positive && value === 0)) return { error: config.percent ? 'האחוז חייב להיות בין 0 ל־100, ובהעברת קולות גדול מאפס.' : `המספר חייב להיות בין ${config.min.toLocaleString('he-IL')} ל־${config.max.toLocaleString('he-IL')}.` };
  return { text: value.toLocaleString('en-US', { useGrouping: !config.percent, maximumSignificantDigits: 21 }) + config.suffix };
}
