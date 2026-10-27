import { parse } from 'csv-parse/sync';
import type { VoteData } from './types';

export function getCsvResults(csv: string, notPartiesKeys: string[]): { voteData: VoteData; countedVotes?: number } {
  const rows: string[][] = parse(csv, { bom: true, skip_empty_lines: true });
  const keys = rows.shift();
  if (!keys || new Set(keys).size !== keys.length) {
    throw new Error('Invalid results CSV: missing data or duplicate columns');
  }
  const parties = keys.map((key, index) => ({ key, index }))
    .filter(({ key }) => key.trim() && !notPartiesKeys.includes(key));
  if (!parties.length || !keys.some(key => notPartiesKeys.includes(key))) {
    throw new Error('Invalid results CSV: missing election columns');
  }
  const data: VoteData = Object.fromEntries(parties.map(({ key }) => [key, { votes: 0 }]));
  const invalidIndex = keys.indexOf('פסולים');
  let invalidVotes = 0;
  for (const row of rows) {
    if (invalidIndex >= 0) {
      const value = row[invalidIndex].trim();
      const votes = Number(value);
      if (!value || !Number.isSafeInteger(votes) || votes < 0 || !Number.isSafeInteger(invalidVotes + votes)) {
        throw new Error('Invalid invalid-vote count');
      }
      invalidVotes += votes;
    }
    for (const { key, index } of parties) {
      const value = row[index].trim();
      const votes = Number(value);
      if (!value || !Number.isSafeInteger(votes) || votes < 0 || !Number.isSafeInteger(data[key].votes + votes)) {
        throw new Error(`Invalid vote count for ${key}`);
      }
      data[key].votes += votes;
    }
  }
  const validVotes = Object.values(data).reduce((sum, { votes }) => sum + votes, 0);
  if (!Number.isSafeInteger(validVotes + invalidVotes)) {
    throw new Error('Invalid total vote count');
  }
  return { voteData: data, ...(invalidIndex >= 0 ? { countedVotes: validVotes + invalidVotes } : {}) };
}

export function getCsvData(csv: string, notPartiesKeys: string[]): VoteData {
  return getCsvResults(csv, notPartiesKeys).voteData;
}

export async function fetchResultsCsv(url: string): Promise<{ csv: string; time: string }> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      'User-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) throw new Error(`Results source returned HTTP ${response.status}`);
  const csv = await response.text();
  const modified = response.headers.get('last-modified');
  const date = modified ? new Date(modified) : new Date();
  return { csv, time: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString() };
}
