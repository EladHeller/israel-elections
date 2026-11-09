# Social sharing previews

Normal browser requests still receive the static Vite application from the
existing S3/CloudFront cache. Preview detection requires an exact, case-sensitive
facebookexternalhit 1.1, WhatsApp 2.x or Twitterbot 1.0 User-Agent. Any Sec-Fetch
header vetoes detection. Missing, embedded, duplicate or unknown agents fall
back to the application. This deliberately favors false negatives; User-Agent
matching cannot prove a caller's identity.

## Election images

The Vite build generates 1200×630 PNGs from each election's checked-in
`realResults`, using its own list names. General election previews show the
Knesset number and the three leading lists, including ties at third place.
No bloc assignment is inferred. The image does not depict simulator edits.
Question previews render the question and its calculated answer. Unsupported
questions show only the question. The neutral static Knesset image is a fallback
if rendering fails; real results never stand in for a hypothetical answer.

Images are emitted under `/social/elections-{id}-v2.png` and
`/social/question-{id}-v2.png`. The SVG renderer runs only at build time and uses
a bundled Hebrew font with its license, independent of system fonts. Browsers
do not download a renderer or font for these images. The initial application
HTML uses the latest available election image. Recognized crawlers on numbered
results, simulator, research or locality pages receive the matching election
image. `/summary` retains the initial site metadata.

Bump the image version in the generator, edge function and server handler when
changing the design: sharing services can retain their own image caches.

## Questions and answers

For a valid question link, the viewer-request function explicitly selects the
existing API origin with `cf.selectRequestOriginById('scenario-api')`, then
rewrites to `/api/question-preview/v1/{election}` and keeps only a canonical `q`.
Changing the URI alone would not change the origin. The original default cache
behavior remains in force, including query-string forwarding. The internal
URI separates answer metadata from application HTML; normal navigation can
never receive cached preview HTML. Cookies are removed only on preview requests.

On a cache miss, a dedicated read-only Lambda loads the deployed
`election-config.json` and required results from the same environment's S3
bucket. It uses the browser's parser, calculation engine, metadata cleanup and
shared geographic/comparison orchestration. Geographic files are loaded only
when required. Reads are deduplicated within an invocation; warm invocations
must not retain mutable election data. The handler does not record question
attempts or create shared scenarios.

The question becomes the Open Graph/Twitter title and a bounded answer summary
becomes the description. Engine notes are omitted from previews. The answer
is also typeset as a dynamic 1200×630 SVG and rasterized to PNG with Resvg,
using the bundled Hebrew font. Social clients receive a PNG image rather than
requiring SVG support. Questions and answers wrap within fixed bounds; longer
text ends in an ellipsis. The image URL preserves the canonical question and
has its own query-aware CloudFront behavior, with the same cache lifetime as
the answer HTML. Ordinary page loads remain static. The build copies the font
into the compiled runtime; the renderer is a production dependency. The body contains the full answer text and a link to
the existing question page. Unsupported questions, empty results and data
failures return question-only metadata, without inventing an answer. During
initial provisioning or backend updates, answer routing is enabled only after
the Lambda and routes are ready. Until then, the edge function can still
generate question-only metadata directly.

Cache lifetimes: 24 hours for final/historical answers; 30 seconds for active
counting or question-only fallbacks. Browsers receive `max-age=0` and the CDN
uses `s-maxage`. Deployments invalidate `/api/question-preview/*` after backend
updates as well as on client/data uploads. Live counting answers can therefore
lag the data by up to 30 seconds; external sharing services may cache longer.
The Lambda has bounded concurrency and a six-second S3 deadline inside its
ten-second execution limit, and can only read election data and write its own
logs. Failures are logged without the question text.

## Verification after deployment

Fetch the same question URL with an exact supported crawler agent and a normal
mobile/desktop/in-app browser agent in both orders. Also test a crawler agent
with `Sec-Fetch-Mode: navigate`: it must receive the static app. Confirm the API
origin is selected on a preview miss, that the next fetch can hit CloudFront's
preview cache, and that a different question/election has a distinct cache key.
Check a newly shared link on a real WhatsApp device; old previews may remain
cached by the sharing service. Verify PNG MIME types and that question images
contain no real-results chart.

## Lambda module compatibility

The CommonJS preview build uses the Node entry point `csv-parse/sync`. The
browser continues to use `csv-parse/browser/esm/sync`. The preparation step adapts
exactly one import in the emitted server runtime and fails the build if that
import is missing or ambiguous. It does not alter shared source or browser code.

The runtime smoke test starts the compiled handler with
`--no-experimental-require-module --no-experimental-detect-module`, matching
Lambda's disabled experimental features. It executes a polling-station question
and requires a nonempty calculated answer description, catching module-init
failures before deployment.
