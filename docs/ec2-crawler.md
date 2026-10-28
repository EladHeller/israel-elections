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

Copy `infra/ec2-crawler/crawl.mjs` to `/opt/election-crawler/crawl.mjs` using SSM Run Command (base64 encoding the file avoids shell interpolation). Run:

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
