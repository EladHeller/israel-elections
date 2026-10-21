import { createHash } from 'node:crypto';

type VoteData = Record<string, { votes: number; mandats: number; name?: string }>;
type ElectionConfig = {
  algorithm: 'baderOffer' | 'ceilRound';
  blockPercentage: number;
  agreements: [string, string][];
  totalVotes?: number;
  turnoutPercentage?: number;
};
type ScenarioState = { voteData: VoteData; config: ElectionConfig };
type SharedScenario = {
  version: 1;
  election: string;
  demo: boolean;
  base: ScenarioState;
  scenario: ScenarioState;
};

const MAX_BYTES = 100_000;
const ID_LENGTHS = [10, 12, 16, 24, 43];
const tableName = process.env.SCENARIO_TABLE_NAME;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;

class InvalidScenarioError extends Error {}

const invalid = () => new InvalidScenarioError('Invalid scenario');

function validateAgreements(agreements: [string, string][], voteData: VoteData): boolean {
  const existingParties = new Set(Object.keys(voteData));
  const usedParties = new Set<string>();
  const seenPairs = new Set<string>();
  for (const [a, b] of agreements) {
    if (!a || !b || a === b || !existingParties.has(a) || !existingParties.has(b)) return false;
    const pair = [a, b].sort().join('\0');
    if (seenPairs.has(pair) || usedParties.has(a) || usedParties.has(b)) return false;
    seenPairs.add(pair);
    usedParties.add(a);
    usedParties.add(b);
  }
  return true;
}

function readState(value: unknown): ScenarioState {
  if (!record(value) || !record(value.voteData) || !record(value.config)) throw invalid();
  const entries = Object.entries(value.voteData);
  if (!entries.length || entries.length > 200) throw invalid();
  const voteData: VoteData = Object.fromEntries(entries.map(([party, data]) => {
    if (!party || party.length > 40 || party.includes('+') || [...party].some(c => c.charCodeAt(0) < 32)
      || ['__proto__', 'prototype', 'constructor'].includes(party)
      || !record(data) || !count(data.votes)
      || (data.name !== undefined && (typeof data.name !== 'string' || data.name.length > 200))) throw invalid();
    return [party, { votes: data.votes, mandats: 0, ...(data.name === undefined ? {} : { name: data.name as string }) }];
  }));
  const configValue = value.config;
  if (!['baderOffer', 'ceilRound'].includes(configValue.algorithm as string)
    || typeof configValue.blockPercentage !== 'number' || !Number.isFinite(configValue.blockPercentage)
    || configValue.blockPercentage < 0 || configValue.blockPercentage > 1
    || !Array.isArray(configValue.agreements) || configValue.agreements.length > 100
    || !configValue.agreements.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(p => typeof p === 'string'))
    || (configValue.totalVotes !== undefined && !count(configValue.totalVotes))
    || (configValue.turnoutPercentage !== undefined && (typeof configValue.turnoutPercentage !== 'number'
      || !Number.isFinite(configValue.turnoutPercentage) || configValue.turnoutPercentage < 0 || configValue.turnoutPercentage > 100))) throw invalid();
  const agreements = configValue.agreements.map(([a, b]) => [a, b] as [string, string]);
  if (!validateAgreements(agreements, voteData)) throw invalid();
  return {
    voteData,
    config: {
      algorithm: configValue.algorithm as ElectionConfig['algorithm'],
      blockPercentage: configValue.blockPercentage,
      agreements,
      ...(configValue.totalVotes === undefined ? {} : { totalVotes: configValue.totalVotes as number }),
      ...(configValue.turnoutPercentage === undefined ? {} : { turnoutPercentage: configValue.turnoutPercentage as number }),
    },
  };
}

export function validateSharedScenario(value: unknown): SharedScenario {
  if (!record(value) || value.version !== 1 || typeof value.election !== 'string'
    || !/^[1-9][0-9]*$/.test(value.election) || typeof value.demo !== 'boolean') throw invalid();
  const base = readState(value.base);
  const scenario = readState(value.scenario);
  if (Object.keys(base.voteData).sort().join('\0') !== Object.keys(scenario.voteData).sort().join('\0')) throw invalid();
  const result: SharedScenario = { version: 1, election: value.election, demo: value.demo, base, scenario };
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MAX_BYTES) throw invalid();
  return result;
}

export function scenarioIdCandidates(payload: string): string[] {
  const hash = createHash('sha256').update(payload).digest('base64url');
  return ID_LENGTHS.map(length => hash.slice(0, length));
}

function json(statusCode: number, body: unknown, cacheControl = 'no-store') {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
    },
    body: JSON.stringify(body),
  };
}

function getBody(event: any): string {
  if (typeof event?.body !== 'string') throw invalid();
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) throw invalid();
  return body;
}

function dynamoSdk() {
  return require('@aws-sdk/client-dynamodb');
}

let dynamo: any;
function getDynamo() {
  if (!dynamo) {
    const { DynamoDBClient } = dynamoSdk();
    dynamo = new DynamoDBClient({});
  }
  return dynamo;
}

async function saveScenario(payload: string): Promise<string> {
  if (!tableName) throw new Error('SCENARIO_TABLE_NAME is not configured');
  const { PutItemCommand } = dynamoSdk();
  for (const id of scenarioIdCandidates(payload)) {
    try {
      await getDynamo().send(new PutItemCommand({
        TableName: tableName,
        Item: {
          id: { S: id },
          payload: { S: payload },
          createdAt: { N: String(Date.now()) },
        },
        ConditionExpression: 'attribute_not_exists(#id) OR #payload = :payload',
        ExpressionAttributeNames: { '#id': 'id', '#payload': 'payload' },
        ExpressionAttributeValues: { ':payload': { S: payload } },
      }));
      return id;
    } catch (error: any) {
      if (error?.name !== 'ConditionalCheckFailedException') throw error;
    }
  }
  throw new Error('Unable to allocate scenario id');
}

async function loadScenario(id: string): Promise<string | undefined> {
  if (!tableName) throw new Error('SCENARIO_TABLE_NAME is not configured');
  const { GetItemCommand } = dynamoSdk();
  const response = await getDynamo().send(new GetItemCommand({
    TableName: tableName,
    Key: { id: { S: id } },
    ProjectionExpression: 'payload',
  }));
  return response.Item?.payload?.S;
}

export async function handler(event: any) {
  const method = event?.requestContext?.http?.method;
  const path = event?.rawPath;
  try {
    if (method === 'POST' && path === '/api/scenarios') {
      const scenario = validateSharedScenario(JSON.parse(getBody(event)));
      const payload = JSON.stringify(scenario);
      const id = await saveScenario(payload);
      return json(201, { id });
    }
    if (method === 'GET') {
      const match = /^\/api\/scenarios\/([A-Za-z0-9_-]{10,43})$/.exec(path || '');
      if (match) {
        const payload = await loadScenario(match[1]);
        if (!payload) return json(404, { error: 'Scenario not found' });
        return {
          statusCode: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=31536000, immutable',
          },
          body: payload,
        };
      }
    }
    return json(404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof InvalidScenarioError || error instanceof SyntaxError) {
      return json(400, { error: 'Invalid scenario' });
    }
    console.error(error);
    return json(500, { error: 'Internal server error' });
  }
}
