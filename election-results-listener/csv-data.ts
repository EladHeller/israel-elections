import { parse } from 'csv-parse/sync';
import type { VoteData } from './types';

export function getCsvData(csv: string, notPartiesKeys: string[]): VoteData {
  const rows: string[][] = parse(csv, { bom: true, skip_empty_lines: true });
  const keys = rows.shift();
  if (!keys || rows.length === 0 || new Set(keys).size !== keys.length) {
    throw new Error('Invalid results CSV: missing data or duplicate columns');
  }
  const parties = keys.map((key, index) => ({ key, index }))
    .filter(({ key }) => key.trim() && !notPartiesKeys.includes(key));
  if (!parties.length || !keys.some(key => notPartiesKeys.includes(key))) {
    throw new Error('Invalid results CSV: missing election columns');
  }
  const data: VoteData = Object.fromEntries(parties.map(({ key }) => [key, { votes: 0 }]));
  for (const row of rows) {
    for (const { key, index } of parties) {
      const value = row[index].trim();
      const votes = Number(value);
      if (!value || !Number.isSafeInteger(votes) || votes < 0 || !Number.isSafeInteger(data[key].votes + votes)) {
        throw new Error(`Invalid vote count for ${key}`);
      }
      data[key].votes += votes;
    }
  }
  if (!Object.values(data).some(({ votes }) => votes > 0)) {
    throw new Error('Results CSV contains no votes');
  }
  return data;
}

export async function fetchResultsCsv(url: string): Promise<{ csv: string; time: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Results source returned HTTP ${response.status}`);
  const csv = await response.text();
  const modified = response.headers.get('last-modified');
  const date = modified ? new Date(modified) : new Date();
  return { csv, time: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString() };
}
