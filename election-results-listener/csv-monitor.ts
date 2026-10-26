import { getCsvResults, fetchResultsCsv } from './csv-data';
import { calcVotesResults } from './calc-elections';
import { upload, isFileAlreadyExists } from './s3';
import config from './config';
import { invalidCache } from './cloudfront';
import { resultsMatch, assertCanPublishEmptyResults } from './result-state';

const {
  notPartiesKeys, currElections, electionsConfig, distributionID,
} = config;

const { csvUrl, agreements, blockPercentage } = electionsConfig[currElections];

async function uploadCsv(csvData: string, time: string) {
  await upload(`data/${currElections}/elections.csv`, csvData, true);
  await invalidCache([`data/${currElections}/elections.csv`], distributionID);
  await upload(`data/${currElections}/${time}_elections.csv`, csvData);
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
  const { voteData, countedVotes } = getCsvResults(csvData, notPartiesKeys);
  if (!Object.values(voteData).some(({ votes }) => votes > 0) && !countedVotes) {
    await assertCanPublishEmptyResults(`data/${currElections}/allResults.json`);
  }
  const results = { ...calcVotesResults(voteData, blockPercentage, agreements), countedVotes };
  if (exists && await resultsMatch(`data/${currElections}/allResults.json`, results)) return;
  await uploadResults(results, currElections, time);
  if (!exists) await uploadCsv(csvData, time);
}

