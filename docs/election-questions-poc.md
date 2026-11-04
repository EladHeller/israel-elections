# Election questions: research and browser-only POC

Research date: 2026-11-02. Entry points: `/questions` (choose an election) and `/questions/26`. This is a bounded Hebrew query interpreter, not general natural-language understanding. No model API, inference server or model weights are introduced. Follow-up work adds a question-recording API backed by DynamoDB; see [question recording](question-recording.md).

## Architecture and decision

The experiment separates **one-line question → typed query → deterministic execution → prose answer**. Calculations reuse the existing `computeScenarioResults`, `rankLocalities`, CSV parsers, election metadata and selector. A model must never generate numeric answers or executable JS/SQL. The page is dynamically imported; its parser and research dependencies are loaded only when needed. Merely opening the question page does not fetch geographic CSVs. `/questions` does not load national results until an election is chosen. Geographic files are fetched only when executing a geographic query. CloudFront supports direct GET/HEAD entry, preserves query strings, and rejects invalid election IDs.

| Approach | What it buys | Costs / unknowns | Decision |
| --- | --- | --- | --- |
| Local domain grammar and election-scoped entity dictionary | Deterministic, small, fast; inspectable failures; no inference charges | Limited paraphrases and compositions; grammar maintenance | Implemented baseline |
| Small semantic intent classifier or embeddings | More paraphrases without a generative model | Hebrew training/evaluation needed; intent classification alone does not resolve entities, transfer direction, negation or amounts | Possible intermediate experiment, not implemented |
| Browser LLM via WebLLM | Local generation, WebGPU acceleration, structured JSON, workers | Device/browser support, model download, memory, cold start and Hebrew semantic quality must be measured | Separate opt-in experiment after collecting evaluation questions |
| Browser model via Transformers.js | ONNX inference; WebGPU and WASM paths depending on model/runtime | Model conversion/support, download and quantization tradeoffs; no evidence yet that a small chosen model understands this Hebrew domain | Alternative local-model experiment |
| Cheap hosted structured-output model | Potentially wider language coverage and no client model download | Nonzero spend, network dependency, proxy for API key, rate limits and hard spend controls; semantic validation still needed | Optional fallback only; not wired into this POC |

Primary documentation reviewed:

- [WebLLM overview and capabilities](https://github.com/mlc-ai/web-llm), [getting started](https://webllm.mlc.ai/docs/user/get_started.html), [worker/runtime overview](https://llm.mlc.ai/docs/deploy/webllm.html): browser WebGPU inference, model-artifact download and structured generation are supported. JSON validity does not establish semantic correctness or Hebrew accuracy.
- [Transformers.js](https://huggingface.co/docs/transformers.js/en/index), [WebGPU](https://huggingface.co/docs/transformers.js/guides/webgpu), [quantization](https://huggingface.co/docs/transformers.js/guides/dtypes): browser ONNX inference and quantized models are supported. No model has been benchmarked in this repository.
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing): the reviewed Gemini 2.5 Flash-Lite standard text rate is $0.10/M input tokens and $0.40/M output tokens. Illustratively, **10,000 requests × (1,000 input + 200 output tokens) = $1.80** for tokens alone. At 3,000 input + 300 output, the same traffic is **$4.20**. These are calculations, not measured request costs: Hebrew tokenization, list dictionaries, prompts, thinking/output, retries and proxy costs can change them. No free tier or caching is assumed. Availability, terms and pricing need rechecking before implementation.

The cheap-API option may fit a few-dollar budget with tightly bounded requests; that does not establish quality, guarantee a spend cap or justify making it mandatory. A hosted fallback would need a small authenticated/rate-limited proxy, output limits, a global enforced budget and a local-only path when exhausted. All election execution would remain in the browser.

## Implemented capability combinations

The supported set is deliberately finite. Every accepted sentence must match a complete grammar; extra clauses and unsupported filters cause refusal instead of a partial answer. Actual names/ballot IDs come from the selected election. Punctuation, niqqud and Hebrew quote variants are normalized. Short aliases are election-scoped; current-list shorthand is displayed back using the full list name. Historical faction membership is not inferred. Duplicate names are rejected; full name or ballot letters can disambiguate.

| Family | Combinable axes | Examples / behavior |
| --- | --- | --- |
| National result | One actual list × votes/share/seats | `כמה קולות קיבלה הליכוד?` returns votes, valid-vote share and computed seats together |
| National comparison | Two lists, in textual order | `השווה בין הליכוד לעמך ישראל` |
| Geographic ranking | List × locality/station × absolute votes/local valid-vote percentage × 1–100 rows | `באילו 5 יישובים הליכוד קיבלה הכי הרבה קולות?`; `באיזה קלפי הליכוד קיבלה האחוז הגבוה ביותר?` |
| Threshold gap | List × fixed national valid total/new additional valid votes | `כמה קולות היו חסרים לעמך ישראל לעבור את אחוז החסימה?`; `כמה קולות נוספים הייתה צריכה עמך ישראל כדי לעבור את אחוז החסימה?` |
| Seat scenario | Optional custom threshold [0–100%] × optional removal of all surplus agreements × optional single directed transfer (0–100%] between two lists | `מה היה קורה אם הציונות הדתית הייתה מקבלת 50% מהקולות של עמך ישראל וגם אחוז החסימה היה 2% וגם בלי הסכמי עודפים?` |

Transfer direction is taken from the sentence, not dictionary iteration order. A transfer subtracts from the donor, preserves the valid-vote total, rounds down to whole ballots, and leaves the original data untouched. Existing agreements remain unless explicitly removed; the full interpretation says so. Transfer is not interpreted as a merger, additional turnout or double-counting. A no-threshold result uses the original election's allocation algorithm, including historical algorithms.

The fixed-total threshold gap is `max(0, ceil(t × V − v))`. With new valid ballots it is `max(0, ceil((t × V − v) / (1 − t)))`. Here `V` is **valid party votes only**, never total turnout or invalid ballots. Crossing the threshold is not a general guarantee of winning a seat, especially under custom very low thresholds. An unreachable 100% additional-votes question is rejected.

Geographic coverage follows existing verified source availability (localities from elections 15–26; station sources vary and the separate file can be missing). Zero-support places and empty valid-vote rows are excluded by existing ranking semantics. The UI states there is no minimum-size filter; small places can lead percentage rankings. Station number and split identify separate rows. CSV errors/HTML fallback, missing files and unsupported elections are handled explicitly with retry. A national result snapshot and a subsequently loaded geographic file need not have the same update time.

## Combination map for subsequent work

These axes describe the larger domain; they are **not a claim of POC support**. “All possible questions” is unbounded, so coverage should be defined over explicit combinations and ambiguity policies.

| Dimension | Cases to distinguish | POC / next step |
| --- | --- | --- |
| Election | Explicit chosen election, election mentioned in text, year, historical comparison, cross-election identity changes | Selector plus explicit national comparison source or previous election; other conflicting election text is rejected |
| Scope | Country, specific settlement, specific station/split, district, arbitrary set of places | Country and ranking of places; place filters need entity resolution |
| Target | One list, multiple lists, joint list, faction, bloc, user-customized bloc | One list, pairwise results, two-list transfer, national comparisons and restoration/removal scenarios for configured blocs; no inferred factions |
| Measure | Votes, valid-vote share, seats, turnout, invalid votes, wasted votes | First three plus threshold gap; no unsupported turnout claims |
| Aggregation | Lookup, top/bottom N, count, sum, mean, median, leader, tie, margin | Lookup/top N; other aggregations need separate typed operators |
| Predicate | Minimum valid votes, percentage bound, threshold pass/fail, list leading alone/tied, combined-list leadership | Refuse extra filters; do not silently discard them |
| Scenario edit | Transfer fixed count/percentage, add/remove ballots, merge lists, threshold, add/remove/replace agreements, algorithm | One fractional transfer, threshold and all-agreement removal; merger semantics deferred |
| Composition | Independent edits, sequential transfers, simultaneous transfers, repeated sources, cycles, contradictory edits | One transfer; repeated/contradictory edits rejected |
| Outcome | Entire seat map, one list delta, bloc majority, next seat, minimum edit achieving an outcome | Entire map and deltas only; minimal-change search belongs to existing scenario-search work |
| Language | Paraphrases, spelling errors, abbreviations, Hebrew/Arabic/English, negation, fractions, relative expressions, follow-up pronouns | Hebrew finite patterns/known aliases only; unresolved content rejected |

Important unresolved choices: full versus partial transfers; fixed count versus percentage; additional ballots versus redistributed existing ballots; joint-list merger agreement inheritance; fixed-other-shares assumptions in next-seat questions; how ties count in “won a place”; whether zero-support places belong in lowest-rank/count queries; rounding, split-station aggregation and missing data. Each future operator needs an explicit semantic decision and a test corpus before supporting its language.

## Evaluation and next experiment

The test corpus checks positive paraphrases and cross-products, every election's name dictionary against common Hebrew syntax (ballot letters collide with ordinary words), transfer directions, conservation/nonmutation, exact threshold boundaries, denominator changes, unavailable entities, unknown trailing clauses, contradictory edits, bad limits and data errors. UI tests cover election selection, interpretation review, local execution, delayed geographic loading, missing/malformed files, retry, selection change and cancelled stale work.

These are synthetic deterministic tests, **not an independently sampled Hebrew-language accuracy benchmark**. Do not report their pass rate as natural-language accuracy. Collect 100–200 real anonymized questions, label their typed queries or “clarify/unsupported”, hold out paraphrases, and measure exact-query match, safe refusal versus wrong accepted interpretation, cold/warm latency and payload size. Add borderline/negative variants for every operator. For an optional model, compare the identical held-out corpus and include mobile/non-WebGPU devices and failed downloads. Record actual downloaded bytes, peak memory and startup time rather than estimates. Run inference off the UI thread, load it only after explicit opt-in, and validate its output against a strict runtime schema and election entities before showing the interpretation alongside the answer. Never let a model output execute arbitrary code.

## Follow-up UX

One Enter press now performs interpretation and execution. Answers use prose with textual and color-coded seat changes, without confirmation or JSON screens. Assumptions accompany the answer. Recording is asynchronous and documented above. Shared rules live in [UI guidelines](ui-guidelines.md) and AGENTS.md.


## National cross-election comparisons

`election-comparisons.ts` provides typed national list/bloc comparisons and vote edits; `comparison-data.ts` loads a historical national snapshot only when a parsed query needs it. No locality CSV is fetched for a national comparison. Requests use the existing cancellation and question-recording lifecycle. Selecting an election or editing the question prevents stale historical answers from rendering. An omitted comparison election means the previous Knesset; explicit older Knesset numbers and Hebrew ordinal names 21–26 are supported. Years and same/future elections are refused.

Supported examples:

- `בכמה אחוזים עלתה רשימת ישראל ביתנו לעומת הבחירות הקודמות?`
- `בכמה נקודות אחוז הליכוד עלתה לעומת הכנסת ה־25?`
- `בכמה אחוזים הרשימות הערביות עלו לעומת הבחירות הקודמות?`
- `איזו רשימה עלתה הכי הרבה באחוז הקולות לעומת הבחירות הקודמות?`
- `איזו רשימה ירדה הכי הרבה באחוזים יחסיים?`
- `מה היה קורה אם המפלגות הערביות לא היו מקבלות קולות בכלל?`
- `מה היה קורה אם הרשימות הערביות היו מקבלות אותו מספר קולות כמו בכנסת העשרים וחמש?`
- `מה היה קורה אם הליכוד הייתה מקבלת אותו אחוז מהקולות כמו הבחירות הקודמות?`

Generic “percent change” returns both percentage-point and relative **vote-share** change, with the before/after shares: 15% → 18% is +3 percentage points and +20% relative. An explicit percentage-point or relative request returns only that change measure. Relative growth from a zero historical share is undefined and reported as such; it is excluded from relative-change rankings. Votes and seats are separate measures. Rankings without an explicit relative measure sort by percentage points and report all ties. Only uniquely matched lists participate; exclusions are disclosed.

List identity requires a unique normalized full name on each side. Ballot-letter reuse, mergers, splits and missing/duplicate names never establish continuity automatically. Identical names do not prove unchanged composition; the answer discloses this limit. Bloc identity uses each election's configured bloc key and membership, including below-threshold lists. Both memberships are printed in the answer note. A missing historical bloc definition causes refusal rather than treating it as zero. User-customized bloc preferences are not used.

Historical-count scenarios replace the current target count with the historical count while keeping other lists fixed. Historical-share scenarios solve `target / (otherVotes + target) = historicalShare`, then round to the nearest whole vote. Removing a target removes its votes from the national valid total. For a bloc, the target count is distributed among its current lists in proportion to current support, using largest remainders and deterministic ballot-ID tie breaking. A positive target for a bloc with no current support is refused because that distribution is undefined. A zero national total, unsafe integer allocation, or impossible 100% share with other lists unchanged is refused. These are calculated scenarios, not turnout forecasts or claims about voter transfers. Seat allocation always uses the selected election's threshold, agreements and algorithm.

Tests cover Hebrew variants and negative clauses, distinct historical denominators, identity ambiguity, changed bloc membership, both percentage measures, zero bases, ties, integer allocation, unchanged non-target votes via the seat engine, missing/malformed historical responses, failed fetches, cancellation, Enter submission, prose rendering and recording outcomes.

## Unanswered-question coverage

The parser also accepts plural voting verbs (`קבלו`, `קיבלו`, `הצביעו ... לרשימה`), `גדלה`/`עלו` in comparisons, `כדי שהיא תאבד מנדט`, outgoing transfers (`הקולות של X היו עוברים ל־Y`), and threshold clauses with `על`. Only the exact scenario opener typo `מה היה קורב אם` is corrected; there is no general fuzzy spelling replacement. `רעמ` is an explicit alias for a competing list named `רע"ם`, not a global final-letter substitution. In a comparison, `הבחירות האחרונות` means the Knesset immediately preceding the selected election; the answer identifies both election numbers.

- `כמה קולות קיבלה רע"ם בנתניה?` uses the locality CSV; adding `בקלפי 2` uses the station CSV. Counts and percentages come from that place alone. Exact locality names take priority; `תל אביב` may uniquely match `תל אביב - יפו`. Missing or ambiguous places and split stations are refused rather than summed implicitly.
- `איזו רשימה קבלה הכי הרבה קולות?` uses national results without loading geographic data and reports all tied winners, regardless of threshold eligibility.
- `באיזו קלפי יש הכי הרבה בעלי זכות הצבעה?` ranks positive integer `eligibleVoters` counts, independently of turnout rates and valid-vote minimums. Missing eligibility data is excluded, or reported as unavailable if no usable data exists. Ties use stable place identity; plural questions return up to ten results.

Regression tests exercise the observed wording families, local versus national denominators, ties, aliases, absent data, ambiguity, transfer direction and conservation, unsupported suffixes, and the UI's choice of geographic data source. Recorded questions are not modified by these changes.
