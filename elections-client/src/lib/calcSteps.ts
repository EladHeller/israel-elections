import {
  sumBy,
  filterNotPassBlockPercentage,
  calcMandats,
  convertToAgreements,
  baderOffer,
  ceilRound,
  splitAgreements,
  type CalcVoteData,
} from './calc';

const MANDATS = 120;

type Algorithm = 'baderOffer' | 'ceilRound';

interface BaderCandidate {
  party: string;
  votes: number;
  mandats: number;
  divisor: number;
  ratio: number;
}

interface BaderRound {
  round: number;
  winner: string;
  allCandidates: BaderCandidate[];
}

interface CeilCandidate {
  party: string;
  votes: number;
  wholeMandats: number;
  remainder: number;
  getsBonus?: boolean;
}

/**
 * Simulate baderOffer step‑by‑step and return detailed rounds array.
 * Each round records the winner and ALL candidates sorted by ratio descending.
 * `startingMandats` is optional — defaults to counting from voteData.mandats.
 */
const simulateBaderOfferRounds = (numRounds: number, voteData: CalcVoteData): BaderRound[] => {
  const state = structuredClone(voteData);
  const rounds: BaderRound[] = [];

  for (let i = 0; i < numRounds; i += 1) {
    const candidates: BaderCandidate[] = Object.entries(state)
      .map(([party, { votes, mandats }]) => ({
        party,
        votes,
        mandats,
        divisor: mandats + 1,
        ratio: votes / (mandats + 1),
      }))
      .sort((a, b) => b.ratio - a.ratio);

    const winner = candidates[0].party;
    rounds.push({ round: i + 1, winner, allCandidates: candidates });
    state[winner].mandats += 1;
  }

  return rounds;
};

/**
 * Simulate ceilRound and return sorted candidates with "gets bonus" flag.
 */
const simulateCeilRoundDetails = (
  totalMandats: number,
  voteData: CalcVoteData,
): (CeilCandidate & { getsBonus: boolean })[] => {
  const mandatVotes = sumBy(Object.values(voteData), 'votes') / totalMandats;
  const candidates: CeilCandidate[] = Object.entries(voteData)
    .map(([party, { votes, mandats }]) => ({
      party,
      votes,
      wholeMandats: mandats,
      remainder: votes % mandatVotes,
    }))
    .sort((a, b) => b.remainder - a.remainder);

  const mandatsForDistribution = totalMandats - sumBy(Object.values(voteData), 'mandats');
  return candidates.map((c, i) => ({
    ...c,
    getsBonus: i < mandatsForDistribution,
  }));
};

export interface AgreementInfo {
  parties: [string, string];
  valid: boolean;
  invalidParties: string[];
  votes: number | null;
  wholeMandats: number | null;
}

export interface AgreementSplit {
  parties: [string, string];
  totalMandats: number;
  aWholeMandats: number;
  bWholeMandats: number;
  remainingAfterWhole: number;
  aVotes: number;
  bVotes: number;
  pairVotes: number;
  agreementModed: number;
  aResult: { votes: number; mandats: number };
  bResult: { votes: number; mandats: number };
  splitRounds: (BaderRound | (CeilCandidate & { getsBonus: boolean }))[];
  algorithmUsed: Algorithm;
}

export interface FinalResultRow {
  party: string;
  wholeMandats: number;
  remainderMandats: number;
  total: number;
}

export interface CalcSteps {
  sumVotes: number;
  blockThreshold: number;
  blockPercentage: number;
  aboveBlock: {
    party: string;
    votes: number;
    pct: number;
    passed: boolean;
  }[];
  belowBlock: {
    party: string;
    votes: number;
    pct: number;
    passed: boolean;
  }[];
  participatingVotes: number;
  votesPerMandat: number;
  wholeMandatesRows: {
    party: string;
    votes: number;
    wholeMandats: number;
    remainder: number;
  }[];
  totalWhole: number;
  remainingMandats: number;
  agreementsInfo: AgreementInfo[];
  remainderRounds: (BaderRound | (CeilCandidate & { getsBonus: boolean }))[];
  algorithmUsed: Algorithm;
  agreementSplits: AgreementSplit[];
  finalResults: FinalResultRow[];
  totalMandats: number;
}

/**
 * Returns all intermediate calculation steps for use in CalcDetailsCard.
 * @param voteData  – raw { [party]: { votes } }
 * @param config    – { blockPercentage, agreements, algorithm }
 * @returns steps
 */
export const buildCalcSteps = (
  voteData: CalcVoteData,
  config: { blockPercentage: number; agreements?: [string, string][]; algorithm: Algorithm },
): CalcSteps => {
  const { blockPercentage, agreements = [], algorithm } = config;

  // Step 1: block percentage filter
  const sumVotes = sumBy(Object.values(voteData), 'votes');
  const blockThreshold = Math.ceil(sumVotes * blockPercentage);

  const allPartiesStep1 = Object.entries(voteData)
    .filter(([, { votes }]) => votes > 0)
    .map(([party, { votes }]) => ({
      party,
      votes,
      pct: sumVotes > 0 ? (votes / sumVotes) * 100 : 0,
      passed: votes >= blockThreshold,
    }))
    .sort((a, b) => b.votes - a.votes);

  const aboveBlock = allPartiesStep1.filter((p) => p.passed);
  const belowBlock = allPartiesStep1.filter((p) => !p.passed);
  const passedPartyKeys = new Set(
    Object.keys(filterNotPassBlockPercentage(blockPercentage, voteData, sumVotes)),
  );

  const passBlockPercentage = filterNotPassBlockPercentage(blockPercentage, voteData, sumVotes);

  // Step 2: מודד למנדט
  const participatingVotes = sumBy(Object.values(passBlockPercentage), 'votes');
  const votesPerMandat = participatingVotes > 0 ? participatingVotes / MANDATS : 0;

  // Step 3: whole mandates
  const withMandats = calcMandats(MANDATS, passBlockPercentage);
  const totalWhole = sumBy(Object.values(withMandats), 'mandats');
  const remainingMandats = MANDATS - totalWhole;

  const wholeMandatesByParty = Object.fromEntries(
    Object.entries(withMandats).map(([party, { mandats }]) => [party, mandats]),
  ) as Record<string, number>;

  const wholeMandatesRows = Object.entries(withMandats)
    .map(([party, { votes, mandats }]) => ({
      party,
      votes,
      wholeMandats: mandats,
      remainder: votes - mandats * votesPerMandat,
    }))
    .sort((a, b) => b.votes - a.votes);

  // Step 4: agreements – ALL configured (valid + invalid)
  const agreementsInfo: AgreementInfo[] = agreements.map(([a, b]) => {
    const aPass = passedPartyKeys.has(a);
    const bPass = passedPartyKeys.has(b);
    const valid = aPass && bPass;
    const invalidParties = [!aPass && a, !bPass && b].filter(Boolean) as string[];
    return {
      parties: [a, b],
      valid,
      invalidParties,
      votes: valid ? withMandats[a].votes + withMandats[b].votes : null,
      wholeMandats: valid ? withMandats[a].mandats + withMandats[b].mandats : null,
    };
  });

  const withAgreements = convertToAgreements(
    agreements.filter(([a, b]) => a in withMandats && b in withMandats),
    withMandats,
  );

  // Step 5: remainder distribution
  let remainderRounds: (BaderRound | (CeilCandidate & { getsBonus: boolean }))[] = [];
  let afterRemainders: CalcVoteData;

  if (algorithm === 'baderOffer') {
    remainderRounds = simulateBaderOfferRounds(remainingMandats, withAgreements);

    afterRemainders = structuredClone(withAgreements);
    (remainderRounds as BaderRound[]).forEach(({ winner }) => {
      afterRemainders[winner].mandats += 1;
    });
  } else {
    remainderRounds = simulateCeilRoundDetails(MANDATS, withAgreements);
    afterRemainders = ceilRound(MANDATS, withAgreements);
  }

  const splitAlgo = algorithm === 'baderOffer' ? baderOffer : ceilRound;
  const realResults = splitAgreements(withMandats, afterRemainders, splitAlgo);

  // Step 6: split agreements
  const agreementSplits: AgreementSplit[] = agreements
    .filter(([a, b]) => a in withMandats && b in withMandats)
    .map(([a, b]) => {
      const agreementKey = `${a}+${b}`;
      const totalMandats = afterRemainders[agreementKey]?.mandats ?? 0;

      const globalAWhole = wholeMandatesByParty[a] ?? 0;
      const globalBWhole = wholeMandatesByParty[b] ?? 0;

      const aVotes = withMandats[a]?.votes ?? 0;
      const bVotes = withMandats[b]?.votes ?? 0;
      const pairVotes = aVotes + bVotes;

      let aWholeInAgreement = globalAWhole;
      let bWholeInAgreement = globalBWhole;
      let remainingAfterWhole = 0;
      let agreementModed = 0;

      if (totalMandats > 0 && pairVotes > 0) {
        agreementModed = pairVotes / totalMandats;
        aWholeInAgreement = Math.floor(aVotes / agreementModed);
        bWholeInAgreement = Math.floor(bVotes / agreementModed);

        let sumWhole = aWholeInAgreement + bWholeInAgreement;
        if (sumWhole > totalMandats) {
          const overflow = sumWhole - totalMandats;
          if (aWholeInAgreement >= overflow) {
            aWholeInAgreement -= overflow;
          } else {
            bWholeInAgreement -= overflow;
          }
          sumWhole = aWholeInAgreement + bWholeInAgreement;
        }

        remainingAfterWhole = Math.max(0, totalMandats - sumWhole);
      }

      const pairVoteData: CalcVoteData = {
        [a]: { votes: aVotes, mandats: aWholeInAgreement },
        [b]: { votes: bVotes, mandats: bWholeInAgreement },
      };

      const splitRounds =
        algorithm === 'baderOffer'
          ? simulateBaderOfferRounds(remainingAfterWhole, pairVoteData)
          : simulateCeilRoundDetails(totalMandats, pairVoteData);

      return {
        parties: [a, b],
        totalMandats,
        aWholeMandats: aWholeInAgreement,
        bWholeMandats: bWholeInAgreement,
        remainingAfterWhole,
        aVotes,
        bVotes,
        pairVotes,
        agreementModed,
        aResult: realResults[a] ?? {
          votes: withMandats[a]?.votes ?? 0,
          mandats: aWholeInAgreement,
        },
        bResult: realResults[b] ?? {
          votes: withMandats[b]?.votes ?? 0,
          mandats: bWholeInAgreement,
        },
        splitRounds,
        algorithmUsed: algorithm,
      };
    });

  // Step 7: final results
  const finalResults: FinalResultRow[] = Object.entries(realResults)
    .map(([party, { mandats }]) => {
      const wholeMandats = withMandats[party]?.mandats ?? 0;
      const remainderMandats = mandats - wholeMandats;
      return { party, wholeMandats, remainderMandats, total: mandats };
    })
    .sort((a, b) => b.total - a.total);

  return {
    sumVotes,
    blockThreshold,
    blockPercentage,
    aboveBlock,
    belowBlock,
    participatingVotes,
    votesPerMandat,
    wholeMandatesRows,
    totalWhole,
    remainingMandats,
    agreementsInfo,
    remainderRounds,
    algorithmUsed: algorithm,
    agreementSplits,
    finalResults,
    totalMandats: MANDATS,
  };
};

