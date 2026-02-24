/* eslint-disable import/no-unresolved */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeScenarioResults,
  computeSeatDeltas,
  isScenarioEdited,
  normalizeScenarioInput,
  validateAgreements,
} from './scenario.js';

describe('validateAgreements', () => {
  it('accepts valid agreements', () => {
    const result = validateAgreements([
      ['a', 'b'],
      ['c', 'd'],
    ], {
      a: { votes: 100 },
      b: { votes: 200 },
      c: { votes: 300 },
      d: { votes: 400 },
    });

    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, []);
  });

  it('rejects duplicate and reused parties', () => {
    const result = validateAgreements([
      ['a', 'b'],
      ['b', 'c'],
      ['b', 'a'],
      ['x', 'x'],
      ['z', 'a'],
    ], {
      a: { votes: 100 },
      b: { votes: 200 },
      c: { votes: 300 },
      x: { votes: 50 },
    });

    assert.equal(result.isValid, false);
    assert.equal(result.errors.length, 4);
  });
});

describe('normalizeScenarioInput', () => {
  it('normalizes votes and block percentage bounds', () => {
    const normalized = normalizeScenarioInput({
      baseVoteData: { a: { votes: 100 } },
      scenarioVoteData: {
        a: { votes: '-20' },
        b: { votes: '33.9' },
      },
      baseConfig: {
        blockPercentage: 0.0325,
        agreements: [['a', 'b']],
        algorithm: 'baderOffer',
      },
      scenarioConfig: {
        blockPercentage: '2',
        agreements: [['b', 'a']],
      },
    });

    assert.equal(normalized.config.blockPercentage, 1);
    assert.deepEqual(normalized.voteData, {
      a: { votes: 0 },
      b: { votes: 33 },
    });
  });
});

describe('computeSeatDeltas', () => {
  it('returns positive and negative deltas', () => {
    const deltas = computeSeatDeltas(
      { a: { mandats: 5 }, b: { mandats: 3 } },
      { a: { mandats: 4 }, c: { mandats: 2 } },
    );
    assert.deepEqual(deltas, { a: -1, b: -3, c: 2 });
  });
});

describe('isScenarioEdited', () => {
  it('treats agreement order as same scenario', () => {
    const base = {
      voteData: { a: { votes: 10 }, b: { votes: 20 } },
      config: { blockPercentage: 0.0325, agreements: [['a', 'b']], algorithm: 'baderOffer' },
    };
    const scenario = {
      voteData: { a: { votes: 10 }, b: { votes: 20 } },
      config: { blockPercentage: 0.0325, agreements: [['b', 'a']], algorithm: 'baderOffer' },
    };

    assert.equal(isScenarioEdited(base, scenario), false);
  });

  it('detects vote changes', () => {
    const base = {
      voteData: { a: { votes: 10 }, b: { votes: 20 } },
      config: { blockPercentage: 0.0325, agreements: [['a', 'b']], algorithm: 'baderOffer' },
    };
    const scenario = {
      voteData: { a: { votes: 11 }, b: { votes: 20 } },
      config: { blockPercentage: 0.0325, agreements: [['a', 'b']], algorithm: 'baderOffer' },
    };

    assert.equal(isScenarioEdited(base, scenario), true);
  });
});

describe('computeScenarioResults', () => {
  it('drops parties below threshold in scenario', () => {
    const res = computeScenarioResults({
      a: { votes: 1000 },
      b: { votes: 100 },
    }, {
      blockPercentage: 0.2,
      agreements: [],
      algorithm: 'baderOffer',
    });

    assert.deepEqual(Object.keys(res.realResults), ['a']);
  });
});
