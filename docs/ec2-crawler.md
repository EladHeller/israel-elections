# Israel EC2 browser crawler

This experiment runs ordinary, headed Google Chrome on Ubuntu 24.04 in `il-central-1`. Chrome runs as an unprivileged `crawler` user with a persistent profile. Xvfb, Openbox and noVNC expose the same browser desktop to an operator; Playwright connects to that browser over loopback CDP. No Lambda-specific launch flags are used.

The CloudFormation stack creates a dedicated VPC, public subnet, outbound internet route, security group with **no inbound rules**, encrypted 20 GiB root disk and a `t3.medium`. Its instance role only has `AmazonSSMManagedInstanceCore`; publishing permissions are deliberately absent during diagnosis. VNC, noVNC and CDP bind to localhost. Access requires an authenticated SSM port-forwarding session. Do not open those ports publicly.

## Deploy

Requirements: AWS CLI, permissions for CloudFormation/EC2/IAM/SSM, Python 3 with PyYAML, and the Session Manager plugin for desktop access.

```bash
bash scripts/deploy-ec2-crawler.sh
```

The script embeds `bootstrap.sh` into the template, verifies AWS identity, validates and deploys into Israel, and prints the instance ID. CloudFormation completion indicates instance provisioning, not bootstrap readiness. Through an SSM shell, check:

```bash
sudo tail -50 /var/log/election-crawler-bootstrap.log
sudo test -f /opt/election-crawler/bootstrap-ready
sudo systemctl status election-desktop
```

The initial bootstrap schedules a shutdown after 120 minutes. This stops compute, retains the disk and profile, and leaves the stack available for investigation. Subsequent starts do not automatically repeat that deadline. Stop the instance when done; EBS storage continues to incur charges until the stack is deleted.

## Desktop and manual check

Replace INSTANCE_ID with the stack output. Keep this command running locally:

```bash
aws ssm start-session --region il-central-1 --target INSTANCE_ID \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["6080"],"localPortNumber":["6080"]}'
```

Open `http://localhost:6080/vnc.html`. Chrome starts at the official results homepage. First verify that it loads and that clicking the city CSV download succeeds. Record any error page before changing the browser or network. A 404 alone does not establish bot detection. Interactive verification requires operator involvement; there is no CAPTCHA solver, fingerprint spoofing or proxy rotation.

## Automation check

The deployment script installs `crawl.mjs` into `/opt/election-crawler`. Run through an SSM shell:

```bash
sudo -u crawler bash -c 'cd /opt/election-crawler && node crawl.mjs'
```

The script attaches to the already running Chrome, saves a before screenshot, clicks `DownloadCSVCities`, listens for downloads from the opener and popup, saves the received CSV under `/home/crawler/downloads`, checks the city-result headers/data rows and returns a SHA-256 and row count. It does not make a separate CSV HTTP request. Failure returns a diagnostic message and nonzero exit code. Raw files remain on the encrypted instance disk for inspection.

This phase is one-shot. Scheduling and integration with the existing election parser/publisher follow only after a successful real download. Header checks here are diagnostic, not a substitute for the publisher's full validation.

## Cleanup

```bash
aws cloudformation delete-stack --region il-central-1 --stack-name Israel-elections-ec2-crawler
aws cloudformation wait stack-delete-complete --region il-central-1 --stack-name Israel-elections-ec2-crawler
```

Deleting the stack removes its instance, root disk (including profile, CSVs and screenshots), networking and SSM role. Export required evidence first. Closing the old Lambda experiment PR does not delete its separate AWS stacks.

## Verified result — 28 October 2026

The stack reached CREATE_COMPLETE and the instance registered online with SSM. The headed Chrome desktop started successfully. The one-shot crawler clicked the homepage city-download link and downloaded `expc.csv?` with **1,181 data rows**. SHA-256: `b5fd6b141a8854f767806994d6d0e9c024562280b4c67eedcb3ec8429a975665`. SSM command: `f7b6f2ac-c876-46b2-82a5-02d521623e7f`.

This establishes real browser download capability on EC2 in Israel. It does not isolate whether the successful difference from Lambda was geography, network address, browser mode or configuration. No results were published.

The downloaded file also passed the existing `getCsvResults` parser: **38 parties**, **4,854,102 valid votes**, and **4,875,751 counted votes including invalid votes**. Validation SSM command: `13adc30d-fdd6-406b-b17b-2a9dcf611af3`.

## Continuous production publishing

The publisher reuses `publishResultsCsv` from the existing listener, including full CSV validation, empty-result protection, unchanged-data suppression, S3 archives and cache invalidation. `election-publisher.timer` starts a new cycle 60 seconds after the previous cycle finishes. systemd prevents overlapping executions. Successful and failed cycles are visible in `journalctl -u election-publisher.service`; failures preserve the last published data. Temporary downloaded CSVs are removed after publishing attempts.

`PublishingBucket` and `DistributionId` enable a scoped CloudFormation policy: object read/write and multipart abort only under the selected bucket's `data/26/`, and invalidation only on the selected distribution. Empty parameters keep diagnostic-only access.

On master deployment, GitHub CD deploys the EC2 stack, installs the exact deployed source commit, starts a validated publishing cycle, cancels the diagnostic shutdown and enables the persistent timer. `scripts/configure-ec2-publisher.sh` can perform the same deployment with INSTANCE_ID, SOURCE_REF, BUCKET, DISTRIBUTION_ID and REGION set. SOURCE_REF must be a public commit SHA. The timer remains disabled if the first publishing cycle fails.

To stop updates: `sudo systemctl disable --now election-publisher.timer`. To stop compute: stop the EC2 instance. Production operation cancels the initial two-hour shutdown and therefore incurs continuous EC2/public IPv4/EBS costs.

Production verification on 28 October: deployment command `d87038aa-9b3c-4c32-9e3a-8e0b8b761e08` succeeded; two consecutive publisher cycles completed successfully. The timer is enabled/active and the scheduled shutdown was canceled. The public `/data/26/allResults.json` endpoint returned 4,875,751 counted votes and 38 parties. The source data was unchanged, so the existing deduplication correctly retained its previous publication timestamp. 219 local tests and GitHub CI passed.
