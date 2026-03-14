import type { VoteData } from '../types';

const MANDATS = 120;

export const sumBy = <T extends Record<string, any>>(arr: T[], prop: keyof T): number =>
  arr.reduce((acc, curr) => acc + (Number(curr[prop]) || 0), 0);

export type CalcVoteData = VoteData;

export const baderOffer = (allMandats: number, voteData: CalcVoteData): CalcVoteData => {
  const res = structuredClone(voteData);
  while (sumBy(Object.values(res), 'mandats') < allMandats) {
    const [winLetter] = Object.entries(res)
      .reduce<[string, number]>(
        ([letter, votesPerMandats], [currLetter, { votes, mandats }]) => {
          const currVotesPerMandat = votes / (mandats + 1);
          if (currVotesPerMandat > votesPerMandats) {
            return [currLetter, currVotesPerMandat];
          }
          return [letter, votesPerMandats];
        },
        ['x', 0],
      );
    res[winLetter].mandats += 1;
  }
  return res;
};

export const convertToAgreements = (
  partiesAgreements: [string, string][],
  voteData: CalcVoteData,
): CalcVoteData => {
  const res = structuredClone(voteData);
  partiesAgreements.forEach(([a, b]) => {
    if (a in res && b in res) {
      res[`${a}+${b}`] = {
        votes: res[a].votes + res[b].votes,
        mandats: res[a].mandats + res[b].mandats,
      };
      delete res[a];
      delete res[b];
    }
  });
  return res;
};

export const calcMandats = (mandats: number, voteData: CalcVoteData): CalcVoteData => {
  const sumVotes = sumBy(Object.values(voteData), 'votes');
  return Object.fromEntries(
    Object.entries(voteData).map(([letter, partyData]) => [
      letter,
      {
        votes: partyData.votes,
        mandats: Math.floor((partyData.votes / sumVotes) * mandats),
      },
    ]),
  ) as CalcVoteData;
};

export const filterNotPassBlockPercentage = (
  percentage: number,
  voteData: CalcVoteData,
  sumVotes: number,
): CalcVoteData => {
  const blockPercentageMinimum = sumVotes * percentage;
  return Object.fromEntries(
    Object.entries(voteData).filter(([, { votes }]) => blockPercentageMinimum <= votes),
  ) as CalcVoteData;
};

export const splitAgreements = (
  voteData: CalcVoteData,
  agreementsVoteData: CalcVoteData,
  splitAlgorithm: (mandats: number, voteData: CalcVoteData) => CalcVoteData = baderOffer,
): CalcVoteData => {
  const agreementArray = Object.entries(agreementsVoteData).flatMap(
    ([letter, { mandats, votes }]) => {
      if (letter.includes('+')) {
        const [a, b] = letter.split('+');
        const result = splitAlgorithm(mandats, { [a]: voteData[a], [b]: voteData[b] });
        return [
          [a, result[a]],
          [b, result[b]],
        ] as [string, CalcVoteData[string]][];
      }
      return [[letter, { votes, mandats }]] as [string, CalcVoteData[string]][];
    },
  );
  return Object.fromEntries(agreementArray) as CalcVoteData;
};

export const ceilRound = (mandats: number, voteData: CalcVoteData): CalcVoteData => {
  const res = structuredClone(voteData);

  const mandatVotes = sumBy(Object.values(res), 'votes') / mandats;
  const mandatsForDistribution = mandats - sumBy(Object.values(res), 'mandats');
  const sortedParties = Object.entries(res).sort(
    ([, v1], [, v2]) => (v2.votes % mandatVotes) - (v1.votes % mandatVotes),
  );
  sortedParties.forEach(([letter], i) => {
    if (mandatsForDistribution > i) {
      res[letter].mandats += 1;
    }
  });
  return res;
};

export interface CalcResults {
  realResults: CalcVoteData;
  withoutAgreements: CalcVoteData;
  beforeBaderOffer?: CalcVoteData;
  afterBaderOffer?: CalcVoteData;
  voteData: CalcVoteData;
}

export const calcVotesResults = (
  voteData: CalcVoteData,
  blockPercentage: number,
  agreements: [string, string][],
  algorithm: 'baderOffer' | 'ceilRound',
  mandats: number = MANDATS,
): CalcResults => {
  const sumVotes = sumBy(Object.values(voteData), 'votes');
  if (sumVotes === 0) {
    return {
      realResults: {},
      withoutAgreements: {},
      beforeBaderOffer: {},
      voteData,
    };
  }
  const passBlockPercentage = filterNotPassBlockPercentage(blockPercentage, voteData, sumVotes);

  const withMandats = calcMandats(mandats, passBlockPercentage);
  const withAgreements = convertToAgreements(agreements, withMandats);
  const baderOfferWithAgreements = baderOffer(mandats, withAgreements);
  const baderOfferResults = splitAgreements(withMandats, baderOfferWithAgreements, baderOffer);

  if (algorithm === 'baderOffer') {
    const withoutAgreements = baderOffer(mandats, withMandats);
    const beforeBaderOffer = ceilRound(mandats, withMandats);

    return {
      realResults: baderOfferResults,
      withoutAgreements,
      beforeBaderOffer,
      voteData,
    };
  }

  const resultWithAgreements = ceilRound(mandats, withAgreements);
  const realResults = splitAgreements(withMandats, resultWithAgreements, ceilRound);
  const withoutAgreements = ceilRound(mandats, withMandats);

  return {
    realResults,
    withoutAgreements,
    afterBaderOffer: baderOfferResults,
    voteData,
  };
};

