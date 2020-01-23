const {csvMonitor} = require('./csv-monitor');
const {calcVotesResults} = require('./calc-elections');

const handler = async req => {
  try {
    if (req.source === 'aws.events') {
      return csvMonitor();
    }
    const {voteData, blockPercentage, agreements} = JSON.parse(req.body);
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

module.exports = {
  handler,
};
