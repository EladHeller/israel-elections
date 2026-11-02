import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
const electionsConfig: Record<string, unknown> = require('./config-elections.json');

const dynamo = new DynamoDBClient({});
const outcomes = new Set(['answered', 'unsupported', 'empty', 'failed', 'cancelled']);
const elections = new Set(Object.keys(electionsConfig));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
interface ApiEvent { requestContext?: { http?: { method?: string } }; rawPath?: string; body?: string; isBase64Encoded?: boolean }
const response = (statusCode: number) => ({ statusCode, headers: { 'cache-control': 'no-store' }, body: '' });

/** Outcomes are client-reported: this endpoint does not verify election calculations. */
export async function handler(event: ApiEvent) {
  if (event.requestContext?.http?.method !== 'POST' || event.rawPath !== '/api/questions') return response(404);
  try {
    if (typeof event.body !== 'string' || event.body.length > 6000) return response(400);
    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    if (Buffer.byteLength(body, 'utf8') > 4096) return response(400);
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return response(400);
    const { id, election, question, outcome } = value as Record<string, unknown>;
    if (typeof id !== 'string' || !uuid.test(id) || typeof election !== 'string' || !elections.has(election)
      || typeof question !== 'string' || !question.trim() || question.length > 600
      || typeof outcome !== 'string' || !outcomes.has(outcome)) return response(400);
    const table = process.env.QUESTION_LOG_TABLE;
    if (!table) throw new Error('QUESTION_LOG_TABLE is not configured');
    await dynamo.send(new PutItemCommand({
      TableName: table,
      Item: {
        id: { S: id }, election: { S: election }, question: { S: question.trim() },
        outcome: { S: outcome }, answered: { BOOL: outcome === 'answered' },
        receivedAt: { S: new Date().toISOString() }, source: { S: 'browser' },
      },
      ConditionExpression: 'attribute_not_exists(#id)', ExpressionAttributeNames: { '#id': 'id' },
    }));
    return response(201);
  } catch (error) {
    if (error instanceof SyntaxError) return response(400);
    if ((error as { name?: string })?.name === 'ConditionalCheckFailedException') return response(204);
    console.error('Question recording failed');
    return response(503);
  }
}
