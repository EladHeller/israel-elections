import { calcVotesResults } from './calc.js';

export const computeBlocMap = (blocsConfig) => {
  const partyToBloc = {};
  Object.entries(blocsConfig.blocks).forEach(([blocKey, bloc]) => {
    bloc.parties.forEach((party) => {
      partyToBloc[party] = blocKey;
    });
  });
  return partyToBloc;
};

export const computeBlocTotals = (results, blocsConfig) => {
  const partyToBloc = computeBlocMap(blocsConfig);
  const totals = {};
  Object.keys(blocsConfig.blocks).forEach((blocKey) => {
    totals[blocKey] = 0;
  });
  Object.entries(results).forEach(([party, { mandats }]) => {
    const blocKey = partyToBloc[party] || 'other';
    if (!totals[blocKey]) totals[blocKey] = 0;
    totals[blocKey] += mandats;
  });
  return totals;
};

const hasSeatChange = (voteData, config, party, delta) => {
  const nextVoteData = { ...voteData, [party]: { votes: voteData[party].votes + delta } };
  const next = calcVotesResults(
    nextVoteData,
    config.blockPercentage,
    config.agreements,
    config.algorithm,
  );
  return next.realResults[party]?.mandats || 0;
};

const findGainMargin = (voteData, config, party, currentSeats, sumVotes) => {
  const maxDelta = sumVotes;
  const seatsAtMax = hasSeatChange(voteData, config, party, maxDelta);
  if (seatsAtMax <= currentSeats) return null;

  let low = 0;
  let high = maxDelta;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const seatsAtMid = hasSeatChange(voteData, config, party, mid);
    if (seatsAtMid > currentSeats) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return high;
};

const findLoseMargin = (voteData, config, party, currentSeats) => {
  const maxDelta = voteData[party].votes;
  const seatsAtMax = hasSeatChange(voteData, config, party, -maxDelta);
  if (seatsAtMax >= currentSeats) return null;

  let low = 0;
  let high = maxDelta;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const seatsAtMid = hasSeatChange(voteData, config, party, -mid);
    if (seatsAtMid < currentSeats) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return high;
};

export const computeSeatMargins = (results, voteData, config) => {
  const sumVotes = Object.values(voteData).reduce((acc, { votes }) => acc + votes, 0);
  const margins = Object.entries(results).map(([party, { mandats }]) => {
    const gain = findGainMargin(voteData, config, party, mandats, sumVotes);
    const lose = findLoseMargin(voteData, config, party, mandats);
    return {
      party,
      mandats,
      gain,
      lose,
    };
  });
  return margins;
};
