import config from './config';
import type { ElectionsConfig, ResultsData, VoteData } from './types';

const { currElections, electionsConfig } = config;
const currElectionsConfig: ElectionsConfig = electionsConfig[currElections];

const MANDATS = 120;

const cloneDeep = <T>(data: T): T => JSON.parse(JSON.stringify(data));

export const sumBy = (arr: any[], prop: string): number =>
  arr.reduce((acc, curr) => acc + (Number(curr[prop]) || 0), 0);

export const baderOffer = (allMandats: number, voteData: ResultsData): ResultsData => {
  const res = cloneDeep(voteData);
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
  partiesAgreements: string[][],
  voteData: ResultsData,
): ResultsData => {
  const res = cloneDeep(voteData);
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

export const calcMandats = (mandats: number, voteData: VoteData): ResultsData => {
  const sumVotes = sumBy(Object.values(voteData), 'votes');
  return Object.fromEntries(
    Object.entries(voteData).map(([letter, partyData]) => [
      letter,
      {
        votes: partyData.votes,
        mandats: Math.floor((partyData.votes / sumVotes) * mandats),
      },
    ]),
  );
};

export const filterNotPassBlockPersentage = (
  percentage: number,
  voteData: VoteData,
  sumVotes: number,
): VoteData => {
  const blockPercentageMinimum = sumVotes * percentage;
  return Object.fromEntries(
    Object.entries(voteData).filter(([, { votes }]) => blockPercentageMinimum <= votes),
  );
};

export const splitAgreements = (
  voteData: ResultsData,
  agreementsVoteData: ResultsData,
  splitAlgorithm: (mandats: number, voteData: ResultsData) => ResultsData = baderOffer,
): ResultsData => {
  const agreementArray = Object.entries(agreementsVoteData).flatMap(
    ([letter, { mandats, votes }]) => {
      if (letter.includes('+')) {
        const [a, b] = letter.split('+');
        const result = splitAlgorithm(mandats, { [a]: voteData[a], [b]: voteData[b] });
        return [
          [a, result[a]],
          [b, result[b]],
        ];
      }
      return [[letter, { votes, mandats }]];
    },
  );
  return Object.fromEntries(agreementArray);
};

export const ceilRound = (mandats: number, voteData: ResultsData): ResultsData => {
  const res = cloneDeep(voteData);

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

export function calcVotesResults(
  voteData: VoteData,
  blockPercentage?: number,
  agreements?: string[][],
  algorithm?: string,
  mandats?: number,
) {
  const finalBlockPercentage = blockPercentage ?? currElectionsConfig.blockPercentage;
  const finalAgreements = agreements ?? currElectionsConfig.agreements;
  const finalAlgorithm = algorithm ?? currElectionsConfig.algorithm;
  const finalMandats = mandats ?? MANDATS;

  const sumVotes = sumBy(Object.values(voteData), 'votes');
  if (sumVotes === 0) {
    return {
      realResults: {},
      withoutAgreements: {},
      beforeBaderOffer: {},
      voteData,
    };
  }
  const passBlockPercntage = filterNotPassBlockPersentage(finalBlockPercentage, voteData, sumVotes);

  const withMandats = calcMandats(finalMandats, passBlockPercntage);
  const withAgreements = convertToAgreements(finalAgreements, withMandats);
  const baderOfferWithAgreements = baderOffer(finalMandats, withAgreements);
  const baderOfferResults = splitAgreements(withMandats, baderOfferWithAgreements, baderOffer);

  const isBader = finalAlgorithm === 'baderOffer';
  const withoutAgreements = isBader
    ? baderOffer(finalMandats, withMandats)
    : ceilRound(finalMandats, withMandats);

  const realResults = isBader
    ? baderOfferResults
    : splitAgreements(withMandats, ceilRound(finalMandats, withAgreements), ceilRound);

  const extra = isBader
    ? { beforeBaderOffer: ceilRound(finalMandats, withMandats) }
    : { afterBaderOffer: baderOfferResults };

  return {
    realResults,
    withoutAgreements,
    voteData,
    ...extra,
  };
}
