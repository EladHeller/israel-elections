const xlsx = require('xlsx');
const cloneDeep = require('lodash.clonedeep');
const flatMap = require('lodash.flatmap');
const reduce = require('lodash.reduce');
const sumBy = require('lodash.sumby');
const {notPartiesKeys, agreements, blockPercentage} = require('../elections-api/config');

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
  partiesAgreements.forEach(({a, b}) => {
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

const filterNotPassBlockPersentage = (percentage, voteData) => {
  const sumVotes = reduce(voteData, (acc, {votes}) => acc + votes, 0);
  return fromEntries(Object.entries(voteData).filter(([letter, {votes}]) => sumVotes * percentage <= votes));
};

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

const calc = (voteData) => {
  const passBlockPercntage = filterNotPassBlockPersentage(blockPercentage, voteData);

  const withMandats = calcMandats(MANDATS, passBlockPercntage);

  // Bader Offer
  const withAgreements = convertToAgreements(agreements, withMandats);
  const resultWithAgreements = baderOffer(MANDATS, withAgreements);
  const finnalResults = splitAgreements(withMandats, resultWithAgreements);
  // Bader Offer without agreements
  const finnalResultsWithoutAgreements = baderOffer(MANDATS, withMandats);
  // Before Bader Offer
  const beforeBaderOffer = ceilRound(MANDATS, withMandats);

  return {finnalResults, finnalResultsWithoutAgreements, beforeBaderOffer};
};

const calcElectionResults = (csv) => {
  const wb = xlsx.read(csv, {type: 'string'});
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const results = data.reduce((acc, city) => {
    Object.entries(city).forEach(([k, v]) => {
      if (notPartiesKeys.every(key => key.localeCompare(k) !== 0)) {
        if (!acc[k]) {
          acc[k] = {votes: 0};
        }
        acc[k].votes += v;
      }
    });
    return acc;
  }, {});
  return calc(results);
};

module.exports = {
  calcElectionResults,
};
