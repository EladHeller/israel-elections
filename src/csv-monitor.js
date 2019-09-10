const phin = require('phin');
const encoding = require('encoding');
const xlsx = require('xlsx');
const {calcVotesResults} = require('./calc-elections');
const {csvUrl, notPartiesKeys, blockPercentage, agreements, elections} = require('./config');
const {upload, isFileAlreadyExists} = require('./s3');

const getCsvData = (csv) => {
  const wb = xlsx.read(csv, {type: 'string'});
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  return data.reduce((acc, city) => {
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
};

const uploadCsv = async (csvData) => {
  await upload(`${elections}/elections.csv`, csvData);
  await upload(`${elections}/${new Date().toJSON()}_elections.csv`, csvData);
};

const uploadResults = async ({finnalResults, finnalResultsWithoutAgreements, beforeBaderOffer, voteData}) => {
  await upload(`${elections}/voteData.json`, JSON.stringify(voteData));
  await upload(`${elections}/results.json`, JSON.stringify(finnalResults));
  await upload(`${elections}/resultsWithoutAgremments.json`,
    JSON.stringify(finnalResultsWithoutAgreements));
  await upload(`${elections}/beforeBaderOffer.json`, JSON.stringify(beforeBaderOffer));
  await upload(`${elections}/${new Date().toJSON()}_results.json`, JSON.stringify(finnalResults));
  await upload(`${elections}/${new Date().toJSON()}_resultsWithoutAgremments.json`,
    JSON.stringify(finnalResultsWithoutAgreements));
  await upload(`${elections}/${new Date().toJSON()}_beforeBaderOffer.json`,
    JSON.stringify(beforeBaderOffer));
  await upload(`${elections}/${new Date().toJSON()}_voteData.json`, JSON.stringify(voteData));
};

const csvMonitor = async () => {
  const fetchRes = await phin({url: csvUrl});
  const csvData = `\ufeff${encoding.convert(fetchRes.body, 'utf8', 'windows-1255').toString().replace(/"/g, '\'\'')}`;
  const exists = (await isFileAlreadyExists(`${elections}/elections.csv`, Buffer.from(csvData)));
  if (!exists) {
    const electionsData = getCsvData(csvData);
    const results = calcVotesResults(electionsData, blockPercentage, agreements);
    await uploadResults(results);
    await uploadCsv(csvData);
  }
};

module.exports = {
  csvMonitor,
};
