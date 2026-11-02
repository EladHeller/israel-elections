import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const template = readFileSync('infra/CD/t01.cf.yaml', 'utf8');
test('question recording uses an indexed on-demand table and a dedicated write-only Lambda', () => {
  const table = template.split('  QuestionLogTable:')[1].split('  QuestionLogGroup:')[0];
  assert.match(table, /DeletionPolicy: Retain/); assert.match(table, /UpdateReplacePolicy: Retain/);
  assert.match(table, /BillingMode: PAY_PER_REQUEST/); assert.match(table, /SSEEnabled: true/);
  assert.match(table, /IndexName: by-outcome-time/); assert.match(table, /AttributeName: outcome/); assert.match(table, /AttributeName: receivedAt/);
  const role = template.split('  QuestionLogRole:')[1].split('  QuestionLogLambda:')[0];
  assert.match(role, /Action: dynamodb:PutItem\n\s+Resource: !GetAtt QuestionLogTable.Arn/);
  assert.doesNotMatch(role, /dynamodb:(?:Get|Scan|Query|Update|Delete|\*)/);
  assert.match(template, /QUESTION_LOG_TABLE: !Ref QuestionLogTable/);
  assert.match(template, /Handler: dist\/question-log.handler/); assert.match(template, /ReservedConcurrentExecutions: 2/);
  assert.match(template, /RouteKey: "POST \/api\/questions"/); assert.match(template, /ThrottlingRateLimit: 2/);
  assert.match(template, /QuestionLogTableName:/);
  assert.match(readFileSync('infra/CD/t00.cf.yaml', 'utf8'), /PathPattern: \/api\/\*/);
  assert.match(readFileSync('infra/CD/deploy-all.ts', 'utf8'), /getOutput\(backendOutputs, 'QuestionLogFunctionName'\)/);
});
