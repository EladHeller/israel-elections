import { promisify } from 'util';
import { parse } from 'csv-parse';
import { calcVotesResults } from './calc-elections';
import { upload, isFileAlreadyExists } from './s3';
import config from './config';
import { invalidCache } from './cloudfront';

const {
  notPartiesKeys, currElections, electionsConfig, distributionID,
} = config;

const promisifyParse: (input: Buffer | string) => Promise<any> = promisify(parse);

const { csvUrl, agreements, blockPercentage } = electionsConfig[currElections];

async function getCsvData(csv: string) {
  const data = await promisifyParse(csv);
  const keys = data.shift();
  return data.reduce((acc, city) => {
    city.forEach((v, i) => {
      const key = keys[i];
      if (!key || notPartiesKeys.includes(key)) {
        return;
      }
      if (!acc[key]) {
        acc[key] = { votes: 0 };
      }
      acc[key].votes += Number(v);
    });
    return acc;
  }, {});
}

async function uploadCsv(csvData: string, elections: number, time: string) {
  await upload(`${elections}/elections.csv`, csvData);
  await invalidCache([`${elections}/elections.csv`], distributionID);
  await upload(`${elections}/${time}_elections.csv`, csvData);
}

export async function uploadResults(results, elections: number, time: string) {
  await upload(`${elections}/allResults.json`, JSON.stringify({ ...results, time }));
  await invalidCache([`${elections}/allResults.json`], distributionID);
  await upload(`${elections}/${time}_allResults.json`, JSON.stringify({ ...results, time }));
}

export async function csvMonitor() {
  const fetchRes = await fetch(csvUrl);
  const csvData = await fetchRes.text();
  const exists = (await isFileAlreadyExists(`${currElections}/elections.csv`, Buffer.from(csvData)));
  if (!exists) {
    const electionsData = await getCsvData(csvData);
    const results = calcVotesResults(electionsData, blockPercentage, agreements);
    const time = new Date(fetchRes.headers['last-modified'] ?? '').toJSON();
    await uploadResults(results, currElections, time);
    await uploadCsv(csvData, currElections, time);
  }
}
