import { calcVotesResults, type CalcVoteData, type CalcResults } from './calc';
import type { AgreementValidation, ScenarioState } from '../types';

const cloneAgreements = (agreements: [string, string][] = []): [string, string][] =>
  agreements.map(([a, b]) => [a, b]);

const normalizeVotes = (voteData: CalcVoteData = {} as CalcVoteData): CalcVoteData =>
  Object.fromEntries(
    Object.entries(voteData).map(([party, data]) => {
      const nextVotes = Number.parseInt(String(data?.votes), 10);
      return [party, { votes: Number.isFinite(nextVotes) && nextVotes > 0 ? nextVotes : 0, mandats: 0 }];
    }),
  ) satisfies CalcVoteData;

const normalizeBlockPercentage = (value: number, fallback: number = 0): number => {
  const next = Number.parseFloat(String(value));
  if (!Number.isFinite(next)) return fallback;
  if (next < 0) return 0;
  if (next > 1) return 1;
  return next;
};

const makeAgreementKey = (a: string, b: string): string => [a, b].sort().join('|');

export const normalizeScenarioInput = ({
  baseVoteData,
  scenarioVoteData,
  baseConfig,
  scenarioConfig,
}: {
  baseVoteData: CalcVoteData;
  scenarioVoteData?: CalcVoteData | null;
  baseConfig: {
    algorithm: 'baderOffer' | 'ceilRound';
    blockPercentage: number;
    agreements: [string, string][];
  };
  scenarioConfig?: {
    algorithm?: 'baderOffer' | 'ceilRound';
    blockPercentage?: number;
    agreements?: [string, string][];
  } | null;
}): ScenarioState => {
  const normalizedVoteData = normalizeVotes(scenarioVoteData || baseVoteData);
  return {
    voteData: normalizedVoteData,
    config: {
      algorithm: scenarioConfig?.algorithm || baseConfig.algorithm,
      blockPercentage: normalizeBlockPercentage(
        scenarioConfig?.blockPercentage ?? baseConfig.blockPercentage,
        baseConfig.blockPercentage,
      ),
      agreements: cloneAgreements(scenarioConfig?.agreements || baseConfig.agreements || []),
    },
  };
};

export const validateAgreements = (
  agreements: [string, string][],
  voteData: CalcVoteData,
): AgreementValidation => {
  if (!Array.isArray(agreements)) {
    return { isValid: false, errors: ['פורמט הסכמי העודפים אינו תקין.'] };
  }

  const existingParties = new Set(Object.keys(voteData));
  const usedParties = new Set<string>();
  const seenPairs = new Set<string>();
  const errors: string[] = [];

  agreements.forEach((pair, index) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      errors.push(`הסכם #${index + 1} אינו זוג מפלגות תקין.`);
      return;
    }
    const [a, b] = pair;
    if (!a || !b) {
      errors.push(`הסכם #${index + 1} כולל מפלגה חסרה.`);
      return;
    }
    if (a === b) {
      errors.push(`הסכם #${index + 1} כולל את אותה מפלגה פעמיים (${a}).`);
      return;
    }
    if (!existingParties.has(a) || !existingParties.has(b)) {
      errors.push(`הסכם #${index + 1} כולל מפלגה שלא קיימת בבחירות הנוכחיות.`);
      return;
    }

    const key = makeAgreementKey(a, b);
    if (seenPairs.has(key)) {
      errors.push(`הסכם #${index + 1} הוא כפילות של הסכם עודפים קיים (${a}+${b}).`);
      return;
    }
    seenPairs.add(key);

    if (usedParties.has(a) || usedParties.has(b)) {
      errors.push(`אי אפשר לשייך מפלגה ליותר מהסכם אחד (${a}, ${b}).`);
      return;
    }
    usedParties.add(a);
    usedParties.add(b);
  });

  return { isValid: errors.length === 0, errors };
};

export const computeScenarioResults = (
  voteData: CalcVoteData,
  config: {
    blockPercentage: number;
    agreements: [string, string][];
    algorithm: 'baderOffer' | 'ceilRound';
  },
): CalcResults =>
  calcVotesResults(voteData, config.blockPercentage, config.agreements, config.algorithm);

export const computeSeatDeltas = (
  baseResults: CalcResults['realResults'],
  scenarioResults: CalcResults['realResults'],
): Record<string, number> => {
  const parties = new Set([
    ...Object.keys(baseResults || {}),
    ...Object.keys(scenarioResults || {}),
  ]);
  return Object.fromEntries(
    Array.from(parties).map((party) => {
      const baseSeats = baseResults?.[party]?.mandats || 0;
      const scenarioSeats = scenarioResults?.[party]?.mandats || 0;
      return [party, scenarioSeats - baseSeats];
    }),
  );
};

export const isScenarioEdited = (base: ScenarioState, scenario: ScenarioState): boolean => {
  if (base.config.algorithm !== scenario.config.algorithm) {
    return true;
  }

  if (
    normalizeBlockPercentage(base.config.blockPercentage) !==
    normalizeBlockPercentage(scenario.config.blockPercentage)
  ) {
    return true;
  }

  const baseParties = new Set([
    ...Object.keys(base.voteData || {}),
    ...Object.keys(scenario.voteData || {}),
  ]);
  const hasVoteChange = Array.from(baseParties).some(
    (p) => (base.voteData?.[p]?.votes || 0) !== (scenario.voteData?.[p]?.votes || 0),
  );
  if (hasVoteChange) return true;

  if ((base.config.agreements || []).length !== (scenario.config.agreements || []).length) {
    return true;
  }

  const baseKeys = new Set(
    (base.config.agreements || []).map(([a, b]) => makeAgreementKey(a, b)),
  );
  const scenarioKeys = new Set(
    (scenario.config.agreements || []).map(([a, b]) => makeAgreementKey(a, b)),
  );

  if (baseKeys.size !== scenarioKeys.size) {
    return true;
  }
  return Array.from(baseKeys).some((key) => !scenarioKeys.has(key));
};

