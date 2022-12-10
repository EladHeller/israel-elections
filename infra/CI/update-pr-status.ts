import { coveragePercents } from '../coverage';
import { parsePullRequestId, sendRequest } from '../github-api';

const token = process.argv[2];
const bucketCodeName = process.env.CODE_BUCKET;
const COMMIT_SHA = process.env.GITHUB_SHA;

async function updatePullRequestCoverageStatus() {
  const coverage = await coveragePercents();

  const status = coverage >= 100 ? 'success' : 'failure';
  const description = `Coverage is ${coverage}%`;
  const context = 'code-coverage';
  const targetUrl = `https://${bucketCodeName}.s3.amazonaws.com/${COMMIT_SHA}/lcov-report/index.html`;

  const res = await sendRequest(
    `/repos/${process.env.GITHUB_REPOSITORY}/statuses/${COMMIT_SHA}`,
    'POST',
    token,
    {
      state: status,
      description,
      context,
      target_url: targetUrl,
    },
  );
  console.log(res);
}

async function main() {
  if (!token) {
    console.error('Missing token');
    return;
  }
  if (!bucketCodeName) {
    console.error('Bucket code variable is empty!');
    return;
  }
  const targetBranch = process.env.GITHUB_BASE_REF;
  const pullRequestId = parsePullRequestId();
  if (!targetBranch || !pullRequestId) {
    console.log('Not a pull request, skipping');
    return;
  }
  await updatePullRequestCoverageStatus();
}

main().catch((e: Error) => {
  console.error(e.toString());
  process.exit(1);
});
