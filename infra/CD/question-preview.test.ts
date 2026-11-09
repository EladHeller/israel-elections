import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const template = readFileSync('infra/CD/t01.cf.yaml', 'utf8');
const deploy = readFileSync('infra/CD/deploy-all.ts', 'utf8');

test('preview Lambda is isolated, read-only, bounded, and connected for both crawler methods', () => {
  const role = template.split('  QuestionPreviewRole:')[1].split('  QuestionPreviewLambda:')[0];
  assert.match(role, /Action: s3:GetObject/);
  assert.match(role, /ClientCodeName}\/data\/\*/);
  assert.match(role, /ClientCodeName}\/election-config.json/);
  assert.doesNotMatch(role, /s3:\*|s3:Put|dynamodb:|Resource: "\*"/);
  const lambda = template.split('  QuestionPreviewLambda:')[1].split('  QuestionPreviewIntegration:')[0];
  assert.match(lambda, /ReservedConcurrentExecutions: 2/); assert.match(lambda, /Timeout: 10/);
  assert.match(lambda, /CLIENT_BUCKET: !Ref ClientCodeName/); assert.match(lambda, /SITE_URL: !Ref SiteUrl/);
  assert.match(template, /GET \/api\/question-preview\/v1\/\{election\}/);
  assert.match(template, /HEAD \/api\/question-preview\/v1\/\{election\}/);
  const stage = template.split('  ScenarioApiStage:')[1];
  assert.match(stage, /- QuestionPreviewGetRoute/); assert.match(stage, /- QuestionPreviewHeadRoute/);
});

test('deploy refreshes preview code and invalidates cached answers after code is updated', () => {
  assert.match(deploy, /getOutput\(backendOutputs, 'QuestionPreviewFunctionName'\)/);
  assert.match(deploy, /for \(const FunctionName of \[[^\]]*previewFunctionName\]/);
  assert.match(deploy, /ParameterKey: 'SiteUrl', ParameterValue: siteUrl/);
  const update = deploy.lastIndexOf('UpdateFunctionCodeCommand');
  const invalidate = deploy.lastIndexOf("Items: ['/api/question-preview/*']");
  assert.ok(invalidate > update);
});
