import { getCsvData, fetchResultsCsv } from './csv-data';
import { calcVotesResults } from './calc-elections';
import { upload, isFileAlreadyExists } from './s3';
import config from './config';
import { invalidCache } from './cloudfront';

const {
  notPartiesKeys, currElections, electionsConfig, distributionID,
} = config;

const { csvUrl, agreements, blockPercentage } = electionsConfig[currElections];

async function uploadCsv(csvData: string, elections: number, time: string = new Date().toISOString()) {
  await upload(`data/${elections}/elections.csv`, csvData, elections === currElections);
  await invalidCache([`data/${elections}/elections.csv`], distributionID);
  await upload(`data/${elections}/${time}_elections.csv`, csvData);
}

export async function uploadResults(results, elections: number, time: string = new Date().toISOString()) {
  await upload(`data/${elections}/allResults.json`, JSON.stringify({ ...results, time }), elections === currElections);
  await invalidCache([`data/${elections}/allResults.json`], distributionID);
  await upload(`data/${elections}/${time}_allResults.json`, JSON.stringify({ ...results, time }));
}

export async function csvMonitor() {
  if (csvUrl == null) {
    throw new Error('CSV url is missing');
  }
  const { csv: csvData, time } = await fetchResultsCsv(csvUrl);
  const exists = (await isFileAlreadyExists(`data/${currElections}/elections.csv`, Buffer.from(csvData)));
  if (!exists) {
    const electionsData = await getCsvData(csvData, notPartiesKeys);
    const results = calcVotesResults(electionsData, blockPercentage, agreements);
    await uploadResults(results, currElections, time);
    await uploadCsv(csvData, currElections, time);
  }
}
