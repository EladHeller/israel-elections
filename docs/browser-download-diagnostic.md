# Browser CSV download diagnostic

This experiment tests the official UI flow inside an isolated Lambda container:

1. Open `https://votes26.bechirot.gov.il/` in Chromium.
2. Wait for the visible `#DownloadCSVCities` link and click it.
3. Capture the download from the opener or popup in the same browser context.
4. Save the completed file under a unique `/tmp` directory, decode UTF-8 or Windows-1255, and validate it using the existing election parser.
5. Return the filename, source URL, byte count, SHA-256, row and party counts, vote totals, and navigation response metadata. Return `502` with page diagnostics on failure. Always close Chromium and delete the temporary directory.

No follow-up HTTP request is used to retrieve the CSV. Browser profiles and tokens are not persisted or logged. This is a single attempt; it does not attempt to solve interactive verification or change the browser fingerprint.

## Run

The `Browser CSV diagnostic` workflow uses the existing **dev** environment credentials. It runs when opening the same-repository `test/lambda-city-download` PR into `develop`, or by `workflow_dispatch` once the workflow is available on the default branch. It validates the templates, builds the x86-64 image, deploys dedicated ECR and Lambda stacks, invokes the function once, prints the response, and retains response JSON artifacts for three days. Re-running the job makes one additional diagnostic attempt.

The experiment does not deploy the application, alter EventBridge, or publish election results. Its execution role can only write to its own log group. The function has 2 GiB RAM and `/tmp`, a 300-second timeout, and concurrency limited to one. CloudWatch logs expire after three days; ECR retains the two newest images. The two diagnostic stacks remain until explicitly removed.

For a trusted shell with Docker and AWS CLI already configured for the dev account:

```bash
AWS_REGION=your-dev-region GITHUB_SHA=$(git rev-parse HEAD) bash scripts/test-browser-download.sh
```

A successful result requires `statusCode: 200`, `ok: true`, at least one result row, and valid election columns and vote counts. A successful container build or successful Lambda invocation alone does not establish that the download works. Only after a real Lambda success should this flow be considered for integration with the normal results publisher.

## Cleanup

Delete `Israel-elections-city-download` when the experiment ends. To remove `Israel-elections-city-download-ecr`, first remove its disposable diagnostic images; CloudFormation will not delete a nonempty repository. Cleanup intentionally remains explicit so diagnostic evidence is available for review.

## Observed Lambda result (28 October 2026)

[Run 40709678126](https://github.com/EladHeller/israel-elections/actions/runs/40709678126) successfully built the container, pushed it to ECR, deployed the function, and launched Chromium. The initial navigation to `https://votes26.bechirot.gov.il/` returned HTTP 404 with content type `text/html`. The page title was `שגיאה` and its body was:

> מצטערים, העמוד שחיפשת לא נמצא
> יתכן שהכתובת הוחלפה או הוזנה לא נכון
> (7)

The link never appeared, so the function returned 502 after the 45-second selector timeout. No CSV was downloaded or published. This does not establish the cause of the 404 and is not, by itself, evidence of bot detection. The same page loaded in the separate cloud-browser inspection earlier in this investigation.

Synchronizing later test/documentation changes does not automatically redeploy or retry this experiment. The diagnostic workflow is limited to PR opening and manual dispatch.
