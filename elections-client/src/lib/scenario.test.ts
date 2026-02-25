/* eslint-disable import/no-unresolved */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeScenarioResults,
  computeSeatDeltas,
  isScenarioEdited,
  normalizeScenarioInput,
  validateAgreements,
} from './scenario';
import type { CalcVoteData } from './calc';

describe('validateAgreements', () => {
  it('accepts valid agreements', () => {
    const result = validateAgreements(
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      {
        a: { votes: 100, mandats: 0 },
        b: { votes: 200, mandats: 0 },
        c: { votes: 300, mandats: 0 },
        d: { votes: 400, mandats: 0 },
      } satisfies CalcVoteData,
    );

    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, []);
  });

  it('rejects duplicate and reused parties', () => {
    const result = validateAgreements(
      [
        ['a', 'b'],
        ['b', 'c'],
        ['b', 'a'],
        ['x', 'x'],
        ['z', 'a'],
      ],
      {
        a: { votes: 100, mandats: 0 },
        b: { votes: 200, mandats: 0 },
        c: { votes: 300, mandats: 0 },
        x: { votes: 50, mandats: 0 },
      } satisfies CalcVoteData,
    );

    assert.equal(result.isValid, false);
    assert.equal(result.errors.length, 4);
  });
});

describe('normalizeScenarioInput', () => {
  it('normalizes votes and block percentage bounds', () => {
    const normalized = normalizeScenarioInput({
      baseVoteData: { a: { votes: 100, mandats: 0 } } as CalcVoteData,
      scenarioVoteData: {
        a: { votes: '-20', mandats: 0 } as any,
        b: { votes: '33.9', mandats: 0 } as any,
      } as unknown as CalcVoteData,
      baseConfig: {
        blockPercentage: 0.0325,
        agreements: [['a', 'b']],
        algorithm: 'baderOffer',
      },
      scenarioConfig: {
        blockPercentage: 2 as unknown as number,
        agreements: [['b', 'a']],
      },
    });

    assert.equal(normalized.config.blockPercentage, 1);
    assert.deepEqual(normalized.voteData, {
      a: { votes: 0, mandats: 0 },
      b: { votes: 33, mandats: 0 },
    });
  });
});

describe('computeSeatDeltas', () => {
  it('returns positive and negative deltas', () => {
    const deltas = computeSeatDeltas(
      { a: { mandats: 5, votes: 0 }, b: { mandats: 3, votes: 0 } },
      { a: { mandats: 4, votes: 0 }, c: { mandats: 2, votes: 0 } },
    );
    assert.deepEqual(deltas, { a: -1, b: -3, c: 2 });
  });
});

describe('isScenarioEdited', () => {
  it('treats agreement order as same scenario', () => {
    const base: any = {
      voteData: { a: { votes: 10, mandats: 0 }, b: { votes: 20, mandats: 0 } },
      config: {
        blockPercentage: 0.0325,
        agreements: [['a', 'b']] as [string, string][],
        algorithm: 'baderOffer',
      },
    };
    const scenario: any = {
      voteData: { a: { votes: 10, mandats: 0 }, b: { votes: 20, mandats: 0 } },
      config: {
        blockPercentage: 0.0325,
        agreements: [['b', 'a']] as [string, string][],
        algorithm: 'baderOffer',
      },
    };

    assert.equal(isScenarioEdited(base, scenario), false);
  });

  it('detects vote changes', () => {
    const base: any = {
      voteData: { a: { votes: 10, mandats: 0 }, b: { votes: 20, mandats: 0 } },
      config: {
        blockPercentage: 0.0325,
        agreements: [['a', 'b']] as [string, string][],
        algorithm: 'baderOffer',
      },
    };
    const scenario: any = {
      voteData: { a: { votes: 11, mandats: 0 }, b: { votes: 20, mandats: 0 } },
      config: {
        blockPercentage: 0.0325,
        agreements: [['a', 'b']] as [string, string][],
        algorithm: 'baderOffer',
      },
    };

    assert.equal(isScenarioEdited(base, scenario), true);
  });
});

describe('computeScenarioResults', () => {
  it('drops parties below threshold in scenario', () => {
    const res = computeScenarioResults(
      {
        a: { votes: 1000, mandats: 0 },
        b: { votes: 100, mandats: 0 },
      } satisfies CalcVoteData,
      {
        blockPercentage: 0.2,
        agreements: [],
        algorithm: 'baderOffer',
      },
    );

    assert.deepEqual(Object.keys(res.realResults), ['a']);
  });
});

