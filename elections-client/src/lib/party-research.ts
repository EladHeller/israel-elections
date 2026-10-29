import { parse } from 'csv-parse/browser/esm/sync';

export interface LocalityVotes {
  id: string;
  name: string;
  validVotes: number;
  votes: Record<string, number>;
}

const metadata = new Set(['', 'סמל ועדה', 'שם ישוב', 'סמל ישוב', 'מספר קלפי', 'סמל קלפי',
  'פיצול', 'נפה', 'בזב', "בז''ב", 'בוחרים', 'מצביעים', 'פסולים', 'כשרים',
  'כתובת', 'ת. עדכון', 'חיצוניות', 'קלפי אחרת']);

export function parseLocalities(csv: string): LocalityVotes[] {
  const rows: string[][] = parse(csv, { bom: true, skip_empty_lines: true, trim: true });
  const header = rows.shift()?.map(value => value.trim()) ?? [];
  const nameIndex = header.indexOf('שם ישוב');
  const idIndex = header.indexOf('סמל ישוב');
  const validIndex = header.indexOf('כשרים');
  if (nameIndex < 0 || validIndex < 0 || new Set(header).size !== header.length) {
    throw new Error('קובץ הנתונים אינו מכיל נתוני יישובים תקינים');
  }
  const parties = header.map((party, index) => ({ party, index })).filter(({ party }) => !metadata.has(party));
  if (!parties.length) throw new Error('לא נמצאו רשימות בקובץ הנתונים');
  const localities = new Map<string, LocalityVotes>();
  const count = (value: string): number => {
    const result = Number(value);
    if (!value || !Number.isSafeInteger(result) || result < 0) throw new Error('מספר קולות לא תקין');
    return result;
  };
  for (const row of rows) {
    const name = row[nameIndex];
    const code = idIndex < 0 ? null : Number(row[idIndex]);
    if (!name || /מעטפות|חיצוניות|קלפי אחרת|סה[״"']?כ/.test(name) || (code !== null && (!Number.isFinite(code) || code <= 0))) continue;
    const id = code === null ? name : String(code);
    const locality = localities.get(id) ?? { id, name, validVotes: 0, votes: {} };
    locality.validVotes += count(row[validIndex]);
    for (const { party, index } of parties) locality.votes[party] = (locality.votes[party] ?? 0) + count(row[index]);
    localities.set(id, locality);
  }
  return [...localities.values()].filter(locality => locality.validVotes > 0);
}

export function rankLocalities(localities: LocalityVotes[], party: string, order: 'votes' | 'percentage', minimum = 0) {
  return localities.filter(locality => locality.validVotes >= minimum && (locality.votes[party] ?? 0) > 0)
    .map(locality => ({ ...locality, partyVotes: locality.votes[party], percentage: 100 * locality.votes[party] / locality.validVotes }))
    .sort((a, b) => (order === 'votes' ? b.partyVotes - a.partyVotes : b.percentage - a.percentage)
      || b.partyVotes - a.partyVotes || a.name.localeCompare(b.name, 'he'));
}
