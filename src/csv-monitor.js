const phin = require('phin');
const encoding = require('encoding');
const xlsx = require('xlsx');
const {calcVotesResults} = require('./calc-elections');
const {csvUrl, notPartiesKeys, blockPercentage, agreements} = require('./config');
const {upload, isFileAlreadyExists} = require('./s3');

const calcCsvData = (csv) => {
  const wb = xlsx.read(csv, {type: 'string'});
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const electionsData = data.reduce((acc, city) => {
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
  return calcVotesResults(electionsData, blockPercentage, agreements);
};

const uploadCsv = async (csvData) => {
  await upload('2019_2/elections.csv', 'text/csv', csvData);
  await upload(`2019_2/${new Date().toJSON()}_elections.csv`, 'text/csv', csvData);
};

const uploadResults = async ({finnalResults, finnalResultsWithoutAgreements, beforeBaderOffer}) => {
  await upload('2019_2/results.json', 'text/json', JSON.stringify(finnalResults));
  await upload('2019_2/resultsWithoutAgremments.json', 'text/json',
    JSON.stringify(finnalResultsWithoutAgreements));
  await upload('2019_2/beforeBaderOffer.json', 'text/json', JSON.stringify(beforeBaderOffer));
  await upload(`2019_2/${new Date().toJSON()}_results.json`, 'text/json', JSON.stringify(finnalResults));
  await upload(`2019_2/${new Date().toJSON()}_resultsWithoutAgremments.json`, 'text/json',
    JSON.stringify(finnalResultsWithoutAgreements));
  await upload(`2019_2/${new Date().toJSON()}_beforeBaderOffer.json`, 'text/json',
    JSON.stringify(beforeBaderOffer));
};

const csvMonitor = async () => {
  const fetchRes = await phin({url: csvUrl});
  const csvData = `\ufeff${encoding.convert(fetchRes.body, 'utf8', 'windows-1255').toString().replace(/"/g, '\'\'')}`;
  const exists = (await isFileAlreadyExists('2019_2/elections.csv', Buffer.from(csvData)));
  if (!exists) {
    const results = calcCsvData(csvData);
    await uploadResults(results);
    await uploadCsv(csvData);
  }
};

module.exports = {
  handler: csvMonitor,
};
