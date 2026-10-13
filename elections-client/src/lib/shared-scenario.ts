import { validateAgreements } from './scenario';
import type { ElectionConfig, ScenarioState, VoteData } from '../types';

export interface SharedScenario {
  version: 1;
  election: string;
  demo: boolean;
  base: ScenarioState;
  scenario: ScenarioState;
}

const MAX_BYTES = 100_000;
const MAX_TOKEN_LENGTH = 24_000;
const invalid = () => new Error('קישור התרחיש אינו תקין או שאינו נתמך.');
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;

function readState(value: unknown): ScenarioState {
  if (!record(value) || !record(value.voteData) || !record(value.config)) throw invalid();
  const entries = Object.entries(value.voteData);
  if (!entries.length || entries.length > 200) throw invalid();
  const voteData: VoteData = Object.fromEntries(entries.map(([party, data]) => {
    if (!party || party.length > 40 || (party.includes('+') || [...party].some(c => c.charCodeAt(0) < 32)) || ['__proto__', 'prototype', 'constructor'].includes(party)
      || !record(data) || !count(data.votes)
      || (data.name !== undefined && (typeof data.name !== 'string' || data.name.length > 200))) throw invalid();
    return [party, { votes: data.votes, mandats: 0, ...(data.name === undefined ? {} : { name: data.name as string }) }];
  }));
  const c = value.config;
  if (!['baderOffer', 'ceilRound'].includes(c.algorithm as string)
    || typeof c.blockPercentage !== 'number' || !Number.isFinite(c.blockPercentage)
    || c.blockPercentage < 0 || c.blockPercentage > 1
    || !Array.isArray(c.agreements) || c.agreements.length > 100
    || !c.agreements.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(p => typeof p === 'string'))
    || !validateAgreements(c.agreements, voteData).isValid
    || (c.totalVotes !== undefined && !count(c.totalVotes))
    || (c.turnoutPercentage !== undefined && (typeof c.turnoutPercentage !== 'number'
      || !Number.isFinite(c.turnoutPercentage) || c.turnoutPercentage < 0 || c.turnoutPercentage > 100))) throw invalid();
  const config: ElectionConfig = {
    algorithm: c.algorithm as ElectionConfig['algorithm'], blockPercentage: c.blockPercentage,
    agreements: c.agreements.map(([a, b]) => [a, b]),
    ...(c.totalVotes === undefined ? {} : { totalVotes: c.totalVotes as number }),
    ...(c.turnoutPercentage === undefined ? {} : { turnoutPercentage: c.turnoutPercentage as number }),
  };
  return { voteData, config };
}

export function validateSharedScenario(value: unknown, election: string): SharedScenario {
  if (!record(value) || value.version !== 1 || value.election !== election
    || !/^[1-9][0-9]*$/.test(election) || typeof value.demo !== 'boolean') throw invalid();
  const base = readState(value.base);
  const scenario = readState(value.scenario);
  if (Object.keys(base.voteData).sort().join('\0') !== Object.keys(scenario.voteData).sort().join('\0')) throw invalid();
  return { version: 1, election, demo: value.demo, base, scenario };
}

async function readBounded(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) throw invalid();
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function encodeSharedScenario(snapshot: SharedScenario): Promise<string> {
  const json = JSON.stringify(validateSharedScenario(snapshot, snapshot.election));
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_BYTES) throw invalid();
  const compressed = await readBounded(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));
  const token = btoa(String.fromCharCode(...compressed)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  if (token.length > MAX_TOKEN_LENGTH) throw new Error('התרחיש גדול מדי לשיתוף בקישור.');
  return token;
}

export async function decodeSharedScenario(token: string, election: string): Promise<SharedScenario> {
  if (!token || token.length > MAX_TOKEN_LENGTH || !/^[\w-]+$/.test(token)) throw invalid();
  try {
    const bytes = Uint8Array.from(atob(token.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    const inflated = await readBounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    return validateSharedScenario(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inflated)), election);
  } catch { throw invalid(); }
}
