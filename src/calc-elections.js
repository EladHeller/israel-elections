const cloneDeep = require('lodash.clonedeep');
const flatMap = require('lodash.flatmap');
const reduce = require('lodash.reduce');
const sumBy = require('lodash.sumby');
const {currElections, electionsConfig} = require('./config');

const currElectionsConfig = electionsConfig[currElections];

const MANDATS = 120;

const fromEntries = entries => entries.reduce((acc, [k, v]) => ({
  ...acc,
  [k]: v,
}), {});

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
  Object.values(res).forEach((partyData) => {
    partyData.mandats = Math.floor(partyData.votes / sumVotes * mandats);
  });
  return res;
};

const filterNotPassBlockPersentage = (percentage, voteData, sumVotes) => fromEntries(Object.entries(voteData)
  .filter(([letter, {votes}]) => sumVotes * percentage <= votes));

const splitAgreements = (voteData, agreementsVoteData) => fromEntries(flatMap(agreementsVoteData, ({mandats, votes}, letter) => {
  if (letter.includes('+')) {
    const [a, b] = letter.split('+');
    const result = baderOffer(mandats, {[a]: voteData[a], [b]: voteData[b]});
    return [[a, result[a]], [b, result[b]]];
  }
  return [[letter, {votes, mandats}]];
}));

const ceilRound = (mandats, voteData) => {
  const res = cloneDeep(voteData);

  const mandatVotes = sumBy(Object.values(res), 'votes') / mandats;
  const mandatsForDistribution = mandats - sumBy(Object.values(res), 'mandats');
  const sortedParties = Object.entries(res).sort(
    ([k1, v1], [k2, v2]) => (v2.votes % mandatVotes) - (v1.votes % mandatVotes)
  );
  sortedParties.forEach(([letter, partieData], i) => {
    if (mandatsForDistribution > i) {
      partieData.mandats += 1;
    }
  });
  return res;
};

const calcVotesResults = (voteData, blockPercentage = currElectionsConfig.blockPercentage,
  agreements = currElectionsConfig.agreements) => {
  const sumVotes = reduce(voteData, (acc, {votes}) => acc + votes, 0);
  if (sumVotes === 0) {
    return {finnalResults: {}, finnalResultsWithoutAgreements: {}, beforeBaderOffer: {}, voteData};
  }
  const passBlockPercntage = filterNotPassBlockPersentage(blockPercentage, voteData, sumVotes);

  const withMandats = calcMandats(MANDATS, passBlockPercntage);

  // Bader Offer
  const withAgreements = convertToAgreements(agreements, withMandats);
  const resultWithAgreements = baderOffer(MANDATS, withAgreements);
  const finnalResults = splitAgreements(withMandats, resultWithAgreements);
  // Bader Offer without agreements
  const finnalResultsWithoutAgreements = baderOffer(MANDATS, withMandats);
  // Before Bader Offer
  const beforeBaderOffer = ceilRound(MANDATS, withMandats);

  return {finnalResults, finnalResultsWithoutAgreements, beforeBaderOffer, voteData};
};

module.exports = {
  calcVotesResults,
};
