import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import config from '../config';

describe('config', () => {
  it('should have default properties', () => {
    assert.equal(typeof config.currElections, 'number');
    assert.equal(typeof config.bucket, 'string');
    assert.ok(Array.isArray(config.notPartiesKeys));
  });

  it('should have electionsConfig', () => {
    assert.ok(config.electionsConfig);
    assert.equal(typeof config.currElections, 'number');
    assert.ok(config.electionsConfig[config.currElections]);
  });
});
