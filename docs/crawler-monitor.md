# Crawler health and email alerts

When prod `CRAWLER_ENABLED=true`, production CD on `master` deploys `Israel-elections-crawler-monitor` in `il-central-1`, then passes its private status bucket to the EC2 publisher. The EC2 instance and its boot configuration are unchanged by this stack. The usual application release activation runs a health check and supports rollback.

## Enable email

Set **Settings → Environments → prod → Variables → `CRAWLER_ALERT_EMAIL`** to the desired address before merging, or set it afterwards and rerun the production CD workflow. Open the **AWS Notifications subscription confirmation** email and confirm the SNS subscription. An unconfirmed subscription receives no alerts.

A blank variable deploys the monitor and alarm without an email subscriber and prints a CD warning. The CloudFormation `AlertTopicArn` output identifies the topic; verify the subscription is confirmed in SNS in Israel. Keep the variable set on future deployments. Changing the address creates a new subscription requiring confirmation.

For a manual deployment from the repository with AWS credentials and PyYAML:

```bash
export CRAWLER_ALERT_EMAIL='your-address@example.com'
bash scripts/deploy-crawler-monitor.sh
```

The EC2 publisher must also be deployed from the same commit using the usual CD step, which passes `CRAWLER_STATUS_BUCKET`. Deploying the monitoring stack alone does not instrument an old publisher.

## What counts as a successful run

* `last-attempt.json`: start time and `running`; then finish time and `success` or `failed`, with a bounded error message on failure.
* `last-success.json`: advances only after download, parsing/validation and the existing publication flow finish successfully. An unchanged but valid CSV also advances it.
* `monitor-state.json`: independent Lambda check time, consecutive unhealthy checks, recovery progress, and incident state.

These objects are in a dedicated encrypted S3 bucket with all public access blocked. The EC2 role can write only the two run records. Only the monitoring Lambda writes its state. There is no public status endpoint. A process killed or hung mid-run leaves `running` visible; missing success still triggers an alert. A failed S3 status write fails the run and cannot silently mark it healthy.

## Timing and spam prevention

The Lambda checks every minute. A missing/invalid success, a future timestamp, or a success older than one hour is unhealthy. Two unhealthy checks open an incident. Closing requires three distinct new successful run timestamps observed in fresh checks; a single successful run cannot close the incident. Duplicate invocations within 55 seconds cannot advance counters. State is stored in S3 across cold starts and releases; reserved concurrency of one prevents concurrent state writers.

The Lambda emits `IsraelElections/Crawler / Unhealthy` after reading and persisting its state. The CloudWatch alarm `israel-elections-crawler-health` uses two one-minute breaching periods, `Maximum`, and `FILL(raw, 1)`: missing monitor output is unhealthy too, including access errors, crashes, throttling, or a disabled schedule. Allow roughly 62–64 minutes after the last successful run for crawler alerts, including scheduling and CloudWatch evaluation. This is not a strict delivery deadline.

Only CloudWatch **ALARM** and **OK** transitions publish to SNS: there is one fault notification while the alarm remains open and one recovery notification after it closes. There are no periodic reminder emails. Hysteresis reduces flapping; a later genuine incident can alert again. SNS email delivery is best effort and can duplicate messages, so this is not an exactly-once delivery guarantee. An initial OK notification or an alarm during an uninstrumented initial rollout is possible.

## Inspect a failure

In the AWS console select **Israel (Tel Aviv)**:

1. CloudWatch → Alarms → `israel-elections-crawler-health` shows incident/recovery history and the SNS action.
2. Lambda → `israel-elections-crawler-monitor` → Monitor → CloudWatch logs shows each check with last attempt, last success and recovery progress (30-day retention).
3. CloudFormation → `Israel-elections-crawler-monitor` → Outputs → `StatusBucket`; open the three JSON objects for the current status.
4. Connect to the EC2 crawler through Session Manager and run `sudo journalctl -u election-publisher.service -n 100 --no-pager` for the underlying browser/publisher failure.

The email is the standard CloudWatch message with alarm name, reason, time and console link. The error detail is private in the status object and monitor logs. Monitoring detects problems; it does not restart Chrome automatically.

## Verify after deployment

Confirm the subscription, check a fresh `last-success.json`, and check that the alarm settles at OK. To exercise notifications, temporarily stop `election-publisher.timer`, wait for ALARM/email, then restart it and observe three new successful runs and recovery. This intentionally suspends crawling; use an agreed maintenance window. To exercise monitor silence, disable the EventBridge rule and verify the same alarm, then re-enable it. These fault injections are not part of CD.

The monitor uses the AWS SDK v3 included in the pinned Node.js 22 Lambda runtime; local tests use the repository SDK dependencies. The generated inline template contains the tested handler and health logic; there is no separate uploaded artifact. Deployment is a separate CloudFormation update with empty-change-set success. Bucket contents are retained if the monitoring stack is deleted.

For shutdown and next-election restart, see [ec2-crawler.md](ec2-crawler.md#election-shutdown-and-restart). Disabled production CD removes both stacks; the small status bucket is retained.
