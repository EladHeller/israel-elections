# Manual live update rehearsal (develop only)

These are synthetic votes, not real election results. Do not promote this test configuration to master.

1. Merge the first PR into `develop` and wait for its CD workflow to succeed.
2. Open the development site's `/results/26` page and keep the tab visible.
3. Invoke **Israel-elections-function in the dev AWS environment** with `{"source":"aws.events"}`.
4. Within the next polling cycle (30 seconds, plus CDN invalidation propagation), expect 200,000 counted ballots (4%), Likud 36 seats and Yashar 0.
5. Merge the second PR into `develop` and wait for its CD workflow to succeed. Leave the original browser tab open.
6. Invoke the same dev Lambda with the same event. Expect 1,000,000 counted ballots (20%), Likud 31 seats and Yashar 4. The early-counting warning should disappear.
7. Invoking again without changing the CSV should skip uploads and keep the result timestamp unchanged.

The input URL stays `https://dlse5y3mjhky6.cloudfront.net/test-data/live-results.csv`. The fixture is deployed from `elections-client/public/test-data/live-results.csv`; the normal deployment uploads it and invalidates its CloudFront cache. Wait for CD to finish before invoking the Lambda.

The dev environment already selects election 26 through its existing CURR_ELECTIONS secret. The manifest enables counting/polling, and the 5,000,000-voter estimate is emitted into `election-config.json` by Vite. The scheduler stays disabled; only manual invocations ingest results. The deployment archive includes runtime dependencies, and deployment explicitly updates Lambda code even though the S3 ZIP key is unchanged.

The source fixture is served from `/test-data/live-results.csv`, outside `/data/26` so it does not overwrite the monitor's processed CSV. Deployment only seeds missing current-election `allResults.json` and `elections.csv` objects using conditional S3 writes; existing live data is preserved. Invoke the Lambda after each test-source deployment to ingest that new snapshot. An unchanged source deliberately skips publication. Clean up this rehearsal configuration and replace the source URL, counting phase and voter estimate as appropriate before using official results.
