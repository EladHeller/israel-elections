/* eslint-disable no-param-reassign */
import config from './config';
import { ElectionsConfig, ResultsData, VoteData } from './types';

const { currElections, electionsConfig } = config;

const currElectionsConfig: ElectionsConfig = electionsConfig[currElections];

const MANDATS = 120;

const cloneDeep = <T>(data: T): T => JSON.parse(JSON.stringify(data));
function sumBy(arr: any[], prop: string): number {
  return arr.reduce((acc, curr) => acc + (Number(curr[prop]) ?? 0), 0);
}

export function baderOffer(allMandats: number, voteData: ResultsData) {
  const res = cloneDeep(voteData);
  while (sumBy(Object.values(res), 'mandats') < allMandats) {
    const [winLetter] = Object.entries(res)
      .reduce(([letter, votesPerMandats], [currLetter, { votes, mandats }]) => {
        const currVotesPerMandat = votes / (mandats + 1);
        if (currVotesPerMandat > votesPerMandats) {
          return [currLetter, currVotesPerMandat];
        }
        return [letter, votesPerMandats];
      }, ['x', 0]);
    res[winLetter].mandats += 1;
  }
  return res;
}

export function convertToAgreements(partiesAgreements: string[][], voteData: ResultsData) {
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
}

export function calcMandats(mandats: number, voteData: VoteData): ResultsData {
  const sumVotes = sumBy(Object.values(voteData), 'votes');

  return Object.fromEntries(Object.entries(voteData).map(([letter, partyData]) => ([
    letter,
    {
      votes: partyData.votes,
      mandats: Math.floor((partyData.votes / sumVotes) * mandats),
    },
  ])));
}

export function filterNotPassBlockPersentage(
  percentage: number,
  voteData: VoteData,
  sumVotes: number,
): VoteData {
  const blockPercentageMinimum = sumVotes * percentage;
  return Object.fromEntries(Object.entries(voteData)
    .filter(([, { votes }]) => blockPercentageMinimum <= votes));
}

export function splitAgreements(
  voteData: ResultsData,
  agreementsVoteData: ResultsData,
  splitAlgorithm:(mandats: number, vData: ResultsData) => ResultsData = baderOffer,
): ResultsData {
  const agreementArray = Object.entries(agreementsVoteData)
    .flatMap(([letter, { mandats, votes }]) => {
      if (letter.includes('+')) {
        const [a, b] = letter.split('+');
        const result = splitAlgorithm(mandats, { [a]: voteData[a], [b]: voteData[b] });
        return [[a, result[a]], [b, result[b]]];
      }
      return [[letter, { votes, mandats }]];
    });
  return Object.fromEntries(agreementArray);
}
const ceilRound = (mandats: number, voteData: ResultsData) => {
  const res = cloneDeep(voteData);

  const mandatVotes = sumBy(Object.values(res), 'votes') / mandats;
  const mandatsForDistribution = mandats - sumBy(Object.values(res), 'mandats');
  const sortedParties = Object.entries(res).sort(
    ([, v1], [, v2]) => (v2.votes % mandatVotes) - (v1.votes % mandatVotes),
  );
  sortedParties.forEach(([, partyData], i) => {
    if (mandatsForDistribution > i) {
      partyData.mandats += 1;
    }
  });
  return res;
};

export function calcVotesResults(
  voteData: VoteData,
  blockPercentage = currElectionsConfig.blockPercentage,
  agreements = currElectionsConfig.agreements,
  algorithm = currElectionsConfig.algorithm,
) {
  const sumVotes = sumBy(Object.values(voteData), 'votes');
  if (sumVotes === 0) {
    return {
      realResults: {}, withoutAgreements: {}, beforeBaderOffer: {}, voteData,
    };
  }
  const passBlockPercntage = filterNotPassBlockPersentage(blockPercentage, voteData, sumVotes);

  const withMandats = calcMandats(MANDATS, passBlockPercntage);
  const withAgreements = convertToAgreements(agreements, withMandats);
  const baderOfferWithAgreements = baderOffer(MANDATS, withAgreements);
  const baderOfferResults = splitAgreements(withMandats, baderOfferWithAgreements, baderOffer);

  if (algorithm === 'baderOffer') {
    // Bader Offer without agreements
    const withoutAgreements = baderOffer(MANDATS, withMandats);
    // Before Bader Offer
    const beforeBaderOffer = ceilRound(MANDATS, withMandats);

    return {
      realResults: baderOfferResults, withoutAgreements, beforeBaderOffer, voteData,
    };
  }
  // Ceil round
  const resultWithAgreements = ceilRound(MANDATS, withAgreements);
  const realResults = splitAgreements(withMandats, resultWithAgreements, ceilRound);

  // Ceil round without agreements
  const withoutAgreements = ceilRound(MANDATS, withMandats);

  return {
    realResults, withoutAgreements, afterBaderOffer: baderOfferResults, voteData,
  };
}
