import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { handler } from '../../dist/question-log.js';
const attempt = { id: 'cdb92f14-2fe9-4d93-bfc0-41e1edb4ea39', election: '26', question: ' מה היה קורה אם לא היה אחוז חסימה? ', outcome: 'answered' };
const event = (value: unknown) => ({ rawPath: '/api/questions', requestContext: { http: { method: 'POST' } }, body: JSON.stringify(value) });
test('stores one bounded terminal record with server time and rejects extra client metadata', async context => {
  const original = process.env.QUESTION_LOG_TABLE;
  process.env.QUESTION_LOG_TABLE = 'questions-dev';
  const puts: PutItemCommand[] = [];
  context.mock.method(DynamoDBClient.prototype, 'send', async command => { puts.push(command as PutItemCommand); return {}; });
  try {
    for (const outcome of ['answered', 'unsupported', 'failed', 'empty', 'cancelled']) {
      assert.equal((await handler(event({ ...attempt, outcome, ip: 'must not persist', receivedAt: 'fake' }))).statusCode, 201);
      const input = puts.at(-1)!.input;
      assert.equal(input.TableName, 'questions-dev'); assert.equal(input.Item!.answered.BOOL, outcome === 'answered');
      assert.equal(input.Item!.question.S, attempt.question.trim());
      assert.ok(Number.isFinite(Date.parse(input.Item!.receivedAt.S!))); assert.equal(input.Item!.ip, undefined);
      assert.equal(input.ConditionExpression, 'attribute_not_exists(#id)');
    }
    assert.equal((await handler({ ...event(attempt), body: Buffer.from(JSON.stringify(attempt)).toString('base64'), isBase64Encoded: true })).statusCode, 201);
    context.mock.restoreAll();
    context.mock.method(DynamoDBClient.prototype, 'send', async () => { throw { name: 'ConditionalCheckFailedException' }; });
    assert.equal((await handler(event(attempt))).statusCode, 204);
    context.mock.restoreAll();
    context.mock.method(DynamoDBClient.prototype, 'send', async () => { throw new Error('offline'); });
    context.mock.method(console, 'error', () => {});
    assert.equal((await handler(event(attempt))).statusCode, 503);
    context.mock.restoreAll();
    context.mock.method(console, 'error', () => {});
    context.mock.method(DynamoDBClient.prototype, 'send', async () => { throw null; });
    assert.equal((await handler(event(attempt))).statusCode, 503);
    delete process.env.QUESTION_LOG_TABLE;
    assert.equal((await handler(event(attempt))).statusCode, 503);
  } finally { if (original === undefined) delete process.env.QUESTION_LOG_TABLE; else process.env.QUESTION_LOG_TABLE = original; }
});
test('rejects invalid routes, oversized bodies and invalid fields without writing', async context => {
  const send = context.mock.method(DynamoDBClient.prototype, 'send', async () => { throw new Error('should not write'); });
  for (const value of [null, [], 1, {}, { ...attempt, id: '../evil' }, { ...attempt, id: 3 }, { ...attempt, election: '999' }, { ...attempt, election: 26 }, { ...attempt, question: '' }, { ...attempt, question: ' ' }, { ...attempt, question: 3 }, { ...attempt, question: 'א'.repeat(601) }, { ...attempt, outcome: false }, { ...attempt, outcome: 'unknown' }]) assert.equal((await handler(event(value))).statusCode, 400);
  for (const body of [undefined, '{', 'x'.repeat(6001), 'א'.repeat(2100)]) assert.equal((await handler({ ...event({}), body })).statusCode, 400);
  for (const value of [{}, { requestContext: {} }, { requestContext: { http: { method: 'GET' } } }, { ...event(attempt), rawPath: '/api/other' }]) assert.equal((await handler(value)).statusCode, 404);
  assert.equal(send.mock.callCount(), 0);
});
