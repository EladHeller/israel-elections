const cloneDeep = require('lodash.clonedeep');
const flatMap = require('lodash.flatmap');
const reduce = require('lodash.reduce');
const sumBy = require('lodash.sumby');
const {currElections, electionsConfig} = require('./config');

const currElectionsConfig = electionsConfig[currElections];

const MANDATS = 120;

const baderOffer = (allMandats, voteData) => {
  const res = cloneDeep(voteData);
  while (sumBy(Object.values(res), 'mandats') < allMandats) {
    const [winLetter] = reduce(res, ([letter, votesPerMandats], {votes, mandats}, currLetter) => {
      const currVotesPerMandat = votes / (mandats + 1);
      if (currVotesPerMandat > votesPerMandats) {
        return [currLetter, currVotesPerMandat];
      }
      return [letter, votesPerMandats];
    }, ['x', 0]);
    res[winLetter].mandats += 1;
  }
  return res;
};

const convertToAgreements = (partiesAgreements, voteData) => {
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

const calcMandats = (mandats, voteData) => {
  const res = cloneDeep(voteData);

  const sumVotes = sumBy(Object.values(res), 'votes');
  Object.values(res).forEach(partyData => {
    partyData.mandats = Math.floor((partyData.votes / sumVotes) * mandats);
  });
  return res;
};

const filterNotPassBlockPersentage = (percentage, voteData, sumVotes) => {
  const blockPercentageMinimum = sumVotes * percentage;
  return Object.fromEntries(Object.entries(voteData)
    .filter(([, {votes}]) => blockPercentageMinimum <= votes));
};

const splitAgreements = (voteData, agreementsVoteData, splitAlgorithm = baderOffer) => {
  const agreementArray = flatMap(agreementsVoteData, ({mandats, votes}, letter) => {
    if (letter.includes('+')) {
      const [a, b] = letter.split('+');
      const result = splitAlgorithm(mandats, {[a]: voteData[a], [b]: voteData[b]});
      return [[a, result[a]], [b, result[b]]];
    }
    return [[letter, {votes, mandats}]];
  });
  return Object.fromEntries(agreementArray);
};
const ceilRound = (mandats, voteData) => {
  const res = cloneDeep(voteData);

  const mandatVotes = sumBy(Object.values(res), 'votes') / mandats;
  const mandatsForDistribution = mandats - sumBy(Object.values(res), 'mandats');
  const sortedParties = Object.entries(res).sort(
    ([, v1], [, v2]) => (v2.votes % mandatVotes) - (v1.votes % mandatVotes),
  );
  sortedParties.forEach(([, partieData], i) => {
    if (mandatsForDistribution > i) {
      partieData.mandats += 1;
    }
  });
  return res;
};

const calcVotesResults = (voteData, blockPercentage = currElectionsConfig.blockPercentage,
  agreements = currElectionsConfig.agreements, algorithm = currElectionsConfig.algorithm) => {
  const sumVotes = reduce(voteData, (acc, {votes}) => acc + votes, 0);
  if (sumVotes === 0) {
    return {realResults: {}, withoutAgreements: {}, beforeBaderOffer: {}, voteData};
  }
  const passBlockPercntage = filterNotPassBlockPersentage(blockPercentage, voteData, sumVotes);

  const withMandats = calcMandats(MANDATS, passBlockPercntage);
  const withAgreements = convertToAgreements(agreements, withMandats);
  const BaderOfferWithAgreements = baderOffer(MANDATS, withAgreements);
  const baderOfferResults = splitAgreements(withMandats, BaderOfferWithAgreements, baderOffer);

  if (algorithm === 'baderOffer') {
    // Bader Offer without agreements
    const withoutAgreements = baderOffer(MANDATS, withMandats);
    // Before Bader Offer
    const beforeBaderOffer = ceilRound(MANDATS, withMandats);

    return {realResults: baderOfferResults, withoutAgreements, beforeBaderOffer, voteData};
  }
  // Ceil round
  const resultWithAgreements = ceilRound(MANDATS, withAgreements);
  const realResults = splitAgreements(withMandats, resultWithAgreements, ceilRound);

  // Ceil round without agreements
  const withoutAgreements = ceilRound(MANDATS, withMandats);

  return {realResults, withoutAgreements, afterBaderOffer: baderOfferResults, voteData};
};

module.exports = {
  calcVotesResults,
};
