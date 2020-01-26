const phin = require('phin');
const encoding = require('encoding');
const xlsx = require('xlsx');
const {calcVotesResults} = require('./calc-elections');
const {notPartiesKeys, currElections, electionsConfig} = require('./config');
const {upload, isFileAlreadyExists} = require('./s3');

const {csvUrl, agreements, blockPercentage} = electionsConfig[currElections];

const getCsvData = csv => {
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

const uploadCsv = async (csvData, elections) => {
  await upload(`${elections}/elections.csv`, csvData);
  await upload(`${elections}/${new Date().toJSON()}_elections.csv`, csvData);
};

const uploadResults = async (results, elections) => {
  await upload(`${elections}/allResults.json`, JSON.stringify({...results, time: new Date().toJSON()}));
  await upload(`${elections}/${new Date().toJSON()}_allResults.json`,
    JSON.stringify({...results, time: new Date().toJSON()}));
};

const csvMonitor = async () => {
  const fetchRes = await phin({url: csvUrl});
  const csvData = `\ufeff${encoding.convert(fetchRes.body, 'utf8', 'windows-1255').toString().replace(/"/g, '\'\'')}`;
  const exists = (await isFileAlreadyExists(`${currElections}/elections.csv`, Buffer.from(csvData)));
  if (!exists) {
    const electionsData = getCsvData(csvData);
    const results = calcVotesResults(electionsData, blockPercentage, agreements);
    await uploadResults(results, currElections);
    await uploadCsv(csvData, currElections);
  }
};

module.exports = {
  csvMonitor,
  uploadResults,
};
