# Social sharing preview

The initial `elections-client/index.html` includes Open Graph and Twitter Card
metadata, so link previews work without executing JavaScript. Most routes use a
general site preview; recognized sharing crawlers receive question-specific
metadata for question links as described below.
Compact `/s/:id` links redirect to the simulator, which serves the same HTML.

The 120-seat illustration is decorative, not a result or poll. Its colors match
the site's navy and amber palette rather than political blocs.

- Published image: `elections-client/public/social/elections-preview-v1.png`
- Editable source: `elections-client/public/social/elections-preview-v1.svg`
- Size: 1200 × 630 pixels

Edit the SVG and export it to PNG at its original size (with Hebrew text shaping
and DejaVu Sans installed). Only the PNG is used for link previews. Increment
the version in both filenames and all image metadata when changing the image,
since social services cache preview images independently of CloudFront.

No fixed `og:url` is declared in the application shell: shared simulator and historical-election links
should keep their own destination rather than being identified as the homepage.
The build uses `VITE_SITE_URL` for absolute image URLs. Deployment obtains this
from the CloudFormation `SiteUrl` output: the custom domain in production and
the distribution domain in development. Local builds default to production.

After deploying to production, check a newly shared URL in WhatsApp and in
Facebook Sharing Debugger / LinkedIn Post Inspector. Existing previews can stay
cached until the sharing service fetches the page again. Confirm that the public
image URL returns `200` with `Content-Type: image/png`.

## Question links

`ClientRoutesFunction` generates question-only HTML for a deliberately narrow,
case-sensitive list of complete sharing User-Agent values: facebookexternalhit
1.1 (with its exact optional Facebook documentation URL), WhatsApp 2.x (with an
optional A/i platform suffix), and Twitterbot 1.0. Any `sec-fetch-*` header vetoes
this response, including browser navigation and fetch requests. Unknown agents,
embedded browser strings, duplicate headers or question parameters, malformed
encoding, control characters and questions over 512 characters receive the normal
static application. False negatives are preferred to broad browser detection.
User-Agent matching is not identity verification: a client can impersonate one
of these agents. No claim of mathematically zero false positives is made.

Only valid `/questions` and `/questions/:electionId` GET/HEAD requests with a
nonempty `q` qualify. The initial HTML includes the escaped question as the title,
the election number in the description, the shared question URL and the existing
image. It does not compute or claim to display an answer. Other pages retain the
general preview. The unnumbered questions route uses the latest supported election.

This response is generated in the existing viewer-request function, before the
CloudFront cache lookup. It does not invoke Lambda, read S3 or change the static
site's cache keys, cache policies, or origin. Generated responses use `no-store`;
they cannot populate the normal HTML cache. There is no CDN preview cache to
invalidate. Sharing services may still cache their own previews. HEAD responses
have the same headers and no body. The HTML includes a direct question link for
clients inspecting it; it is intentionally not a second application shell.

After deploying, fetch a fresh question URL with an exact supported crawler
User-Agent and verify its `og:title`. Fetch the identical URL with a desktop,
mobile or in-app browser User-Agent, and with the crawler agent plus
`Sec-Fetch-Mode: navigate`; all must receive the normal application HTML. Check
both orders to detect cache contamination, then verify sharing from WhatsApp on
an actual device. Unrecognized variants should be added only with concrete
request evidence and a corresponding browser-negative regression test.
