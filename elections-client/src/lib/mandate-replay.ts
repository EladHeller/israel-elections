import type { CalcSteps } from './calcSteps';

export type ReplayChapter = 'threshold' | 'quota' | 'whole' | 'agreements' | 'surplus' | 'split' | 'result';

interface Allocation {
  party: string;
  seats: number;
}

export interface ReplayCandidate {
  party: string;
  score: number;
  votes: number;
  divisor?: number;
}

export interface ReplayFrame {
  chapter: ReplayChapter;
  allocation: Allocation[];
  seatOwners: string[];
  award?: { round: number; winner: ReplayCandidate; runnerUp?: ReplayCandidate };
}

function expandSeats(allocation: Allocation[]): string[] {
  return allocation.flatMap(({ party, seats }) => Array<string>(seats).fill(party));
}

export function buildMandateReplay(steps: CalcSteps): ReplayFrame[] {
  const frames: ReplayFrame[] = [{ chapter: 'threshold', allocation: [], seatOwners: [] }];
  if (!steps.totalMandats) return frames;

  const wholeSeats = steps.wholeMandatesRows.map(({ party, wholeMandats }) => ({ party, seats: wholeMandats }));
  const groups = Object.entries(steps.allocationGroups)
    .map(([party, { mandats }]) => ({ party, seats: mandats }));
  const finalSeats = steps.finalResults.map(({ party, total }) => ({ party, seats: total }));

  const membersByGroup = new Map(steps.agreementSplits.map(({ parties }) => [parties.join('+'), parties]));
  const groupByMember = new Map(steps.agreementSplits.flatMap(({ parties }) =>
    parties.map(party => [party, parties.join('+')] as const)));
  const wholeOwners = expandSeats(wholeSeats);
  const groupOwners = wholeOwners.map(party => groupByMember.get(party) ?? party);

  frames.push(
    { chapter: 'quota', allocation: [], seatOwners: [] },
    { chapter: 'whole', allocation: wholeSeats, seatOwners: wholeOwners },
  );

  if (steps.agreementsInfo.length) {
    frames.push({ chapter: 'agreements', allocation: groups, seatOwners: groupOwners });
  }

  const seats = new Map(groups.map(({ party, seats }) => [party, seats]));
  let seatOwners = groupOwners;
  let roundNumber = 0;
  const addAward = (winner: ReplayCandidate, runnerUp?: ReplayCandidate) => {
    roundNumber += 1;
    seats.set(winner.party, seats.get(winner.party)! + 1);
    seatOwners = [...seatOwners, winner.party];
    const allocation = groups.map(({ party }) => ({ party, seats: seats.get(party)! }));
    frames.push({ chapter: 'surplus', allocation, seatOwners, award: { round: roundNumber, winner, runnerUp } });
  };

  const rankedRemainders = steps.remainderRounds.flatMap(round => {
    if ('allCandidates' in round) {
      const [winner, runnerUp] = round.allCandidates.map(({ party, votes, ratio, divisor }) => ({
        party, votes, score: ratio, divisor,
      }));
      addAward(winner, runnerUp);
      return [];
    }
    return [{ party: round.party, votes: round.votes, score: round.remainder, getsBonus: round.getsBonus }];
  });

  // A remainder winner leaves the running after receiving one additional seat.
  rankedRemainders.forEach((candidate, index) => {
    if (candidate.getsBonus) addAward(candidate, rankedRemainders[index + 1]);
  });

  if (steps.agreementSplits.length) {
    const remainingByParty = new Map(finalSeats.map(({ party, seats }) => [party, seats]));
    seatOwners = seatOwners.map((group, index) => {
      const members = membersByGroup.get(group);
      if (!members) return group;

      // The original whole seats stay with their lists. Assign only the seats
      // won by the agreement using the final split already computed by calc.
      const party = wholeOwners[index] ?? members.find(member => (remainingByParty.get(member) ?? 0) > 0)!;
      remainingByParty.set(party, remainingByParty.get(party)! - 1);
      return party;
    });
    frames.push({ chapter: 'split', allocation: finalSeats, seatOwners });
  }
  frames.push({ chapter: 'result', allocation: finalSeats, seatOwners });
  return frames;
}
