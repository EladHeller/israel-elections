import {
    sumBy,
    filterNotPassBlockPercentage,
    calcMandats,
    convertToAgreements,
    baderOffer,
    ceilRound,
    splitAgreements,
} from './calc.js';

const MANDATS = 120;
const cloneDeep = (d) => JSON.parse(JSON.stringify(d));

/**
 * Simulate baderOffer step‑by‑step and return detailed rounds array.
 * Each round records the winner and ALL candidates sorted by ratio descending.
 * `startingMandats` is optional — defaults to counting from voteData.mandats.
 */
const simulateBaderOfferRounds = (numRounds, voteData) => {
    const state = cloneDeep(voteData);
    const rounds = [];

    for (let i = 0; i < numRounds; i += 1) {
        const candidates = Object.entries(state).map(([letter, { votes, mandats }]) => ({
            party: letter,
            votes,
            mandats,
            divisor: mandats + 1,
            ratio: votes / (mandats + 1),
        })).sort((a, b) => b.ratio - a.ratio);

        const winner = candidates[0].party;
        rounds.push({ round: i + 1, winner, allCandidates: candidates });
        state[winner].mandats += 1;
    }

    return rounds;
};

/**
 * Simulate ceilRound and return sorted candidates with "gets bonus" flag.
 */
const simulateCeilRoundDetails = (totalMandats, voteData) => {
    const mandatVotes = sumBy(Object.values(voteData), 'votes') / totalMandats;
    const candidates = Object.entries(voteData)
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

/**
 * Returns all intermediate calculation steps for use in CalcDetailsCard.
 * @param {Object} voteData  – raw { [party]: { votes } }
 * @param {Object} config    – { blockPercentage, agreements, algorithm }
 * @returns {Object} steps
 */
export const buildCalcSteps = (voteData, config) => {
    const { blockPercentage, agreements = [], algorithm } = config;

    // ── Step 1: block percentage filter ──────────────────────────────────────
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
    const passedPartyKeys = new Set(Object.keys(filterNotPassBlockPercentage(blockPercentage, voteData, sumVotes)));

    const passBlockPercentage = filterNotPassBlockPercentage(blockPercentage, voteData, sumVotes);

    // ── Step 2: מודד למנדט ──────────────────────────────────────────────────
    const participatingVotes = sumBy(Object.values(passBlockPercentage), 'votes');
    const votesPerMandat = participatingVotes > 0 ? participatingVotes / MANDATS : 0;

    // ── Step 3: whole mandates ────────────────────────────────────────────────
    const withMandats = calcMandats(MANDATS, passBlockPercentage);
    const totalWhole = sumBy(Object.values(withMandats), 'mandats');
    const remainingMandats = MANDATS - totalWhole;

    const wholeMandatesByParty = Object.fromEntries(
        Object.entries(withMandats).map(([party, { mandats }]) => [party, mandats]),
    );

    const wholeMandatesRows = Object.entries(withMandats)
        .map(([party, { votes, mandats }]) => ({
            party,
            votes,
            wholeMandats: mandats,
            remainder: votes - mandats * votesPerMandat,
        }))
        .sort((a, b) => b.votes - a.votes);

    // ── Step 4: agreements – ALL configured (valid + invalid) ─────────────────
    const agreementsInfo = agreements.map(([a, b]) => {
        const aPass = passedPartyKeys.has(a);
        const bPass = passedPartyKeys.has(b);
        const valid = aPass && bPass;
        const invalidParties = [!aPass && a, !bPass && b].filter(Boolean);
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

    // ── Step 5: remainder distribution ──────────────────────────────────────
    let remainderRounds = [];
    let afterRemainders;

    if (algorithm === 'baderOffer') {
        remainderRounds = simulateBaderOfferRounds(remainingMandats, withAgreements);

        // Rebuild final state from simulation (avoids duplicate logic)
        afterRemainders = cloneDeep(withAgreements);
        remainderRounds.forEach(({ winner }) => {
            afterRemainders[winner].mandats += 1;
        });
    } else {
        remainderRounds = simulateCeilRoundDetails(MANDATS, withAgreements);
        afterRemainders = ceilRound(MANDATS, withAgreements);
    }

    const splitAlgo = algorithm === 'baderOffer' ? baderOffer : ceilRound;
    const realResults = splitAgreements(withMandats, afterRemainders, splitAlgo);

    // ── Step 6: split agreements ─────────────────────────────────────────────
    const agreementSplits = agreements
        .filter(([a, b]) => a in withMandats && b in withMandats)
        .map(([a, b]) => {
            const agreementKey = `${a}+${b}`;
            const totalMandats = afterRemainders[agreementKey]?.mandats ?? 0;

            // Start from the global whole mandates (step 3) as a fallback baseline
            const globalAWhole = wholeMandatesByParty[a] ?? 0;
            const globalBWhole = wholeMandatesByParty[b] ?? 0;

            const aVotes = withMandats[a]?.votes ?? 0;
            const bVotes = withMandats[b]?.votes ?? 0;
            const pairVotes = aVotes + bVotes;

            // Re‑compute the "whole mandates" *inside* the agreement, based on the
            // pair's total mandates. For two parties this guarantees that the number
            // of spare mandates is at most 1.
            let aWholeInAgreement = globalAWhole;
            let bWholeInAgreement = globalBWhole;
            let remainingAfterWhole = 0;
            let agreementModed = 0;

            if (totalMandats > 0 && pairVotes > 0) {
                agreementModed = pairVotes / totalMandats;
                aWholeInAgreement = Math.floor(aVotes / agreementModed);
                bWholeInAgreement = Math.floor(bVotes / agreementModed);

                // Guard against rare floating‑point overflow of whole mandates
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

            const pairVoteData = {
                [a]: { votes: aVotes, mandats: aWholeInAgreement },
                [b]: { votes: bVotes, mandats: bWholeInAgreement },
            };

            // For baderOffer: only simulate the DELTA rounds (the whole mandates are
            // already in pairVoteData.mandats, so simulateBaderOfferRounds runs the
            // remaining rounds from that baseline state).
            const splitRounds = algorithm === 'baderOffer'
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
                aResult: realResults[a] ?? { votes: withMandats[a]?.votes ?? 0, mandats: aWholeInAgreement },
                bResult: realResults[b] ?? { votes: withMandats[b]?.votes ?? 0, mandats: bWholeInAgreement },
                splitRounds,
                algorithmUsed: algorithm,
            };
        });

    // ── Step 7: final results ─────────────────────────────────────────────────
    const finalResults = Object.entries(realResults)
        .map(([party, { mandats }]) => {
            const wholeMandats = withMandats[party]?.mandats ?? 0;
            const remainderMandats = mandats - wholeMandats;
            return { party, wholeMandats, remainderMandats, total: mandats };
        })
        .sort((a, b) => b.total - a.total);

    return {
        // step 1
        sumVotes,
        blockThreshold,
        blockPercentage,
        aboveBlock,
        belowBlock,
        // step 2
        participatingVotes,
        votesPerMandat,
        // step 3
        wholeMandatesRows,
        totalWhole,
        remainingMandats,
        // step 4
        agreementsInfo,
        // step 5
        remainderRounds,
        algorithmUsed: algorithm,
        // step 6
        agreementSplits,
        // step 7
        finalResults,
        // total mandates
        totalMandats: MANDATS,
    };
};
