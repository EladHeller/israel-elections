import { csvMonitor, uploadResults } from './csv-monitor';
import { calcVotesResults } from './calc-elections';
import config from './config';
import { isRecord, isVoteData } from './types';

type HandlerEvent = { source?: string; body?: string };

export async function handler(req: HandlerEvent) {
  if (req.source === 'aws.events') {
    return csvMonitor();
  }
  try {
    if (typeof req.body !== 'string') throw new Error('Missing request body');
    const payload: unknown = JSON.parse(req.body);
    if (!isRecord(payload)) throw new Error('Invalid election calculation payload');
    const { voteData, blockPercentage, agreements } = payload;
    if (!isVoteData(voteData)
      || (blockPercentage != null && typeof blockPercentage !== 'number')
      || (agreements != null && (!Array.isArray(agreements) || !agreements.every(
        (agreement: unknown): agreement is string[] =>
          Array.isArray(agreement) && agreement.every(letter => typeof letter === 'string'),
      )))
    ) {
      throw new Error('Invalid election calculation payload');
    }
    const res = calcVotesResults(voteData, blockPercentage ?? undefined, agreements ?? undefined);
    return {
      statusCode: 200,
      body: JSON.stringify(res),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify(e),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
}

export async function calcOldElectionsResults(electionsIndex: number) {
  const election = config.electionsConfig[electionsIndex];
  if (!election?.voteData) throw new Error(`No historical vote data for election ${electionsIndex}`);
  const { agreements, algorithm, blockPercentage, voteData } = election;
  const res = calcVotesResults(voteData, blockPercentage, agreements, algorithm);
  await uploadResults(res, electionsIndex);
}
