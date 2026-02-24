import { calcVotesResults } from './calc.js';

const cloneAgreements = (agreements = []) => agreements.map(([a, b]) => [a, b]);

const normalizeVotes = (voteData = {}) => Object.fromEntries(
  Object.entries(voteData).map(([party, data]) => {
    const nextVotes = Number.parseInt(data?.votes, 10);
    return [party, { votes: Number.isFinite(nextVotes) && nextVotes > 0 ? nextVotes : 0 }];
  }),
);

const normalizeBlockPercentage = (value, fallback = 0) => {
  const next = Number.parseFloat(value);
  if (!Number.isFinite(next)) return fallback;
  if (next < 0) return 0;
  if (next > 1) return 1;
  return next;
};

const makeAgreementKey = (a, b) => [a, b].sort().join('|');

export const normalizeScenarioInput = ({
  baseVoteData,
  scenarioVoteData,
  baseConfig,
  scenarioConfig,
}) => {
  const normalizedVoteData = normalizeVotes(scenarioVoteData || baseVoteData);
  return {
    voteData: normalizedVoteData,
    config: {
      algorithm: scenarioConfig?.algorithm || baseConfig.algorithm,
      blockPercentage: normalizeBlockPercentage(
        scenarioConfig?.blockPercentage,
        baseConfig.blockPercentage,
      ),
      agreements: cloneAgreements(scenarioConfig?.agreements || baseConfig.agreements || []),
    },
  };
};

export const validateAgreements = (agreements, voteData) => {
  if (!Array.isArray(agreements)) {
    return { isValid: false, errors: ['פורמט הסכמי העודפים אינו תקין.'] };
  }

  const existingParties = new Set(Object.keys(voteData));
  const usedParties = new Set();
  const seenPairs = new Set();
  const errors = [];

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

export const computeScenarioResults = (voteData, config) => calcVotesResults(
  voteData,
  config.blockPercentage,
  config.agreements,
  config.algorithm,
);

export const computeSeatDeltas = (baseResults, scenarioResults) => {
  const parties = new Set([
    ...Object.keys(baseResults || {}),
    ...Object.keys(scenarioResults || {}),
  ]);
  return Object.fromEntries(Array.from(parties).map((party) => {
    const baseSeats = baseResults?.[party]?.mandats || 0;
    const scenarioSeats = scenarioResults?.[party]?.mandats || 0;
    return [party, scenarioSeats - baseSeats];
  }));
};

export const isScenarioEdited = (base, scenario) => {
  if (base.config.algorithm !== scenario.config.algorithm) {
    return true;
  }

  if (normalizeBlockPercentage(base.config.blockPercentage) !== normalizeBlockPercentage(
    scenario.config.blockPercentage,
  )) {
    return true;
  }

  const baseParties = new Set([
    ...Object.keys(base.voteData || {}),
    ...Object.keys(scenario.voteData || {}),
  ]);
  const hasVoteChange = Array.from(baseParties)
    .some((p) => (base.voteData?.[p]?.votes || 0) !== (scenario.voteData?.[p]?.votes || 0));
  if (hasVoteChange) return true;

  if ((base.config.agreements || []).length !== (scenario.config.agreements || []).length) {
    return true;
  }

  const baseKeys = new Set((base.config.agreements || []).map(([a, b]) => makeAgreementKey(a, b)));
  const scenarioKeys = new Set(
    (scenario.config.agreements || []).map(([a, b]) => makeAgreementKey(a, b)),
  );

  if (baseKeys.size !== scenarioKeys.size) {
    return true;
  }
  return Array.from(baseKeys).some((key) => !scenarioKeys.has(key));
};
