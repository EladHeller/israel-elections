const { csvMonitor, uploadResults } = require('./csv-monitor');
const { calcVotesResults } = require('./calc-elections');
const { electionsConfig } = require('./config');

const handler = async (req) => {
  try {
    if (req.source === 'aws.events') {
      return csvMonitor();
    }
    const { voteData, blockPercentage, agreements } = JSON.parse(req.body);
    const res = calcVotesResults(voteData, blockPercentage, agreements);
    return {
      statusCode: 200,
      body: JSON.stringify(res),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify(e),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
};

const calcOldElectionsResults = async (electionsIndex) => {
  const {
    agreements, algorithm, blockPercentage, voteData,
  } = electionsConfig[electionsIndex];
  const votesData = Object.fromEntries(
    Object.entries(voteData).map(([k, votes]) => [k, { votes }]),
  );
  const res = calcVotesResults(votesData, blockPercentage, agreements, algorithm);
  await uploadResults(res, electionsIndex);
};

module.exports = {
  handler,
  calcOldElectionsResults,
};
