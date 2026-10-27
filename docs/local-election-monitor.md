# Local election results monitor for macOS

The official election-results host challenges requests from cloud/datacenter networks. This monitor runs the existing `csvMonitor()` code on a Mac so the CSV fetch uses the Mac's normal internet connection, while publishing through the same S3 and CloudFront path as the Lambda.

## Install

From the repository root:

```bash
npm run monitor:local:install -- prod
```

The installer:

1. uses the `default` AWS profile unless another profile is supplied;
2. runs one real end-to-end poll first, so installation fails if the CSV fetch or AWS access does not work;
3. installs a user LaunchAgent that starts on login and is restarted by `launchd` if it exits;
4. polls every 15 seconds by default.

To use another AWS profile or interval:

```bash
npm run monitor:local:install -- prod my-profile 10000
```

For the development environment:

```bash
npm run monitor:local:install -- dev
```

No AWS secret is stored in the plist. Only the AWS profile name is stored; credentials continue to come from the standard AWS SDK credential chain under the user's account.

## Check it

```bash
launchctl print gui/$(id -u)/com.eladheller.israel-elections-results
```

```bash
tail -f ~/Library/Logs/israel-elections/results-monitor.log \
  ~/Library/Logs/israel-elections/results-monitor.error.log
```

The process emits a heartbeat at most once every five minutes and logs errors when their message changes, so normal operation does not flood the log.

## Uninstall

```bash
npm run monitor:local:uninstall
```

Logs are intentionally kept after uninstalling.

## Election-night note

The LaunchAgent resumes when the Mac wakes, but it cannot fetch while the machine is asleep or disconnected. Keep the Mac powered and awake while it is the active results source.
