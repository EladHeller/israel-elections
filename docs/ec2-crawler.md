# Israel EC2 browser crawler

The crawler runs ordinary headed Google Chrome on Ubuntu in `il-central-1`. Chrome uses the unprivileged `crawler` user and a persistent profile under `/home/crawler/profile`. Playwright attaches over loopback CDP to the same desktop exposed by noVNC.

CloudFormation manages a dedicated VPC/public subnet, no-ingress security group, encrypted root disk, `t3.medium` and SSM access. VNC, noVNC and CDP listen on localhost. Publishing permissions are limited to the configured bucket's `data/26/*` and invalidation on the selected CloudFront distribution.

## Infrastructure deployment

Requirements: AWS CLI, Python 3 with PyYAML and suitable CloudFormation/EC2/IAM/SSM permissions.

```bash
BUCKET=your-results-bucket DISTRIBUTION_ID=YOURDISTRIBUTION bash scripts/deploy-ec2-crawler.sh
```

On a **new stack**, deployment resolves Canonical's Ubuntu 24.04 AMI once (or uses an explicit `AMI_ID`) and passes the resulting concrete image ID to CloudFormation. UserData contains only OS/browser provisioning from `bootstrap.sh`; application code is installed separately.

On an **existing stack**, deployment reads the actual running instance's AMI and preserves the deployed UserData node verbatim. It does not resolve a newer image from the public `current` parameter, and application changes cannot alter UserData. This also migrates the original stack without removing its legacy embedded code and causing a one-time reboot. Existing instances keep that frozen bootstrap until an explicitly planned infrastructure migration. A different `AMI_ID` is rejected by normal deployment.

Deployment creates a change set and inspects it before execution. An empty change set is a successful no-op. Any removal or definite/conditional replacement of the `Instance` is rejected and the change set deleted. Errors reading the stack or creating the change set fail closed; they are not interpreted as permission to create a new stack.

The scripts do not prevent every possible interruption caused by deliberate infrastructure changes such as resizing an instance. They prevent the application/AMI bootstrap coupling and accidental instance replacement. OS/Chrome/bootstrap changes to an existing instance require a separate planned migration; a normal application deployment does not apply them.

## Application deployment

Production CD invokes `scripts/configure-ec2-publisher.sh` with `INSTANCE_ID`, `SOURCE_REF` (public commit SHA), `BUCKET`, `DISTRIBUTION_ID` , `REGION` and `CRAWLER_STATUS_BUCKET` (from the monitoring stack output). Its SSM command executes `infra/ec2-crawler/install-release.sh` on the instance.

The installer:

1. Acquires an exclusive deployment lock.
2. Skips installation when the same commit and publishing configuration are already marked deployed, the active symlink matches, and the timer is active.
3. Downloads and builds a new release in a separate staging directory **while the old publisher continues running**. A prepared release may be reused on retry. New releases use `releases/SHA-v2` so the previous installer's active `releases/SHA` directory cannot be overwritten.
4. Captures the prior release pointer, publisher files, environment, units, deployment marker and timer state. Briefly stops publishing, atomically switches the application pointer, and installs the new runtime files/configuration.
5. Runs a full validated publishing cycle. On success, enables the timer, commits the deployment marker and cancels the initial diagnostic shutdown.
6. On activation failure, restores the previous release pointer, files/configuration and prior timer enablement/running state, and checks the restored publisher. The deployment still reports failure. A preparation failure never stops the old publisher. A failed first install removes newly activated files and leaves the timer disabled.

Rollback concerns the runtime/configuration; it does not undo external data writes already completed by a health-check cycle. Abrupt host/power loss is outside the shell exit-trap guarantee. Persistent profile/download directories are not replaced during application deployment.

The timer starts a new cycle 60 seconds after the previous one finishes; cycles cannot overlap. CSVs pass the existing parser, empty-result protection, unchanged-data suppression, result calculations, S3 archival and cache invalidation. Temporary CSVs are removed. Unchanged source data preserves the previous publication timestamp.

## Observe and control

Connect through EC2 → Connect → Session Manager, or with AWS CLI/Session Manager plugin:

```bash
aws ssm start-session --region il-central-1 --target INSTANCE_ID
```

Then:

```bash
sudo journalctl -u election-publisher.service -f
systemctl list-timers election-publisher.timer
sudo systemctl disable --now election-publisher.timer
```

A successful cycle logs `ok: true` and row count. `active` on the timer alone does not establish successful crawling. To inspect the desktop, forward remote port 6080 with `AWS-StartPortForwardingSession` and open `http://localhost:6080/vnc.html`. Never open those ports publicly.

For a fresh instance, wait for `/opt/election-crawler/bootstrap-ready` and check `/var/log/election-crawler-bootstrap.log` before installing the application. Bootstrap schedules a diagnostic shutdown after two hours; the first successful application deployment cancels it. Production operation incurs continuous compute/public IPv4/EBS costs.

## Verification and cleanup

The original headed Chrome download yielded 1,181 data rows; the existing parser accepted 38 parties, 4,854,102 valid votes and 4,875,751 counted votes. Persistent production cycles were subsequently verified. Live-site changes, independent monitoring and browser hang recovery are separate from deployment idempotence.

Tests execute the real deployment/installer shell scripts with fake AWS/system services in isolated temporary filesystems. They cover repeated deployments, preparation failure, activation rollback, first-install failure, legacy release migration, configuration changes, pinned image/bootstrap preservation, empty change sets, access/validation errors and replacement rejection. They do not restart a real instance or publish test election results.

To remove the crawler, export required evidence/profile first and delete `Israel-elections-ec2-crawler` in `il-central-1`. The stack owns its instance and root disk; deleting it removes those contents. Closing a PR does not delete AWS resources.

Crawler health records and alerts are described in [crawler-monitor.md](crawler-monitor.md).

### Browser connection recovery

A failed publisher invocation triggers `election-browser-recovery.service`. The recovery script examines only that invocation's journal and restarts the desktop only for `browserType.connectOverCDP` failures. It waits for Chrome's local debugging endpoint to respond before returning. Systemd permits at most two recovery attempts in five minutes; source/download/publishing failures remain visible without restarting Chrome.

Deployment joins the recovery job and retries its publisher health check once before rolling back. Both the recovery script and unit are installed and restored with the rest of the release.
