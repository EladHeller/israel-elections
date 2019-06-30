const phin = require('phin');
const encoding = require('encoding');
const {csvUrl} = require('./config');
const {calcElectionResults} = require('./calc-elections');
const {upload, isFileAlreadyExists} = require('./s3');


const uploadCsv = async (csvData) => {
  await upload('2019_2/elections.csv', 'text/csv', csvData);
  await upload(`2019_2/${new Date().toJSON()}_elections.csv`, 'text/csv', csvData);
};

const uploadResults = async ({finnalResults, finnalResultsWithoutAgreements, beforeBaderOffer}) => {
  await upload('2019_2/results.json', 'text/json', finnalResults);
  await upload('2019_2/resultsWithoutAgremments.json', 'text/json', finnalResultsWithoutAgreements);
  await upload('2019_2/beforeBaderOffer.json', 'text/json', beforeBaderOffer);
  await upload(`2019_2/${new Date().toJSON()}_results.json`, 'text/json', finnalResults);
  await upload(`2019_2/${new Date().toJSON()}_resultsWithoutAgremments.json`, 'text/json',
    finnalResultsWithoutAgreements);
  await upload(`2019_2/${new Date().toJSON()}_beforeBaderOffer.json', 'text/json`, beforeBaderOffer);
};

const csvMonitor = async () => {
  const fetchRes = await phin({url: csvUrl});
  const csvData = `\ufeff${encoding.convert(fetchRes.body, 'utf8', 'windows-1255').toString().replace(/"/g, '\'\'')}`;
  const exists = await isFileAlreadyExists('2019_2/elections.csv', Buffer.from(csvData));
  if (!exists) {
    await uploadCsv(csvData);
    await uploadResults(calcElectionResults(csvData));
  }
};

module.exports = {
  handler: csvMonitor,
};
