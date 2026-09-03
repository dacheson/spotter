# Why I built Spotter

Visual regression testing has an adoption problem, and it is not the screenshots.

Playwright will happily compare two images. The hard part is deciding *which* states are worth
photographing in the first place. That decision is usually made by hand, once, by whoever set the
suite up — and then it rots. The states most likely to break are the ones nobody thought to add:
the empty cart, the validation error, the admin gate, the loading skeleton that only appears for
400ms on a slow connection. None of them is a page you can navigate to directly, so none of them
ends up in the suite.

Spotter is an attempt to derive that list from the codebase instead of from memory.

## The core bet: deterministic first, LLM second

The obvious way to build this in 2026 is to hand the repository to a model and ask it what to
test. I deliberately did not do that, and the whole design falls out of the reason why.

A visual regression suite is a trust artifact. The moment it produces a test that a developer
cannot explain, they stop reading the output — and a test suite nobody reads is worse than no
suite, because it still costs CI minutes and still blocks merges. Anything speculative in the
core loop poisons the part that has to be believed.

So the truth model is ordered, and it is enforced in the code rather than stated in the README:

1. User config and overrides
2. Framework adapter truth (file-based routing, route config declarations)
3. Deterministic scanner heuristics (AST signals via `ts-morph`)
4. LLM suggestions — clearly labelled as *suggested*, never merged silently into the trusted set

Route discovery runs through per-framework adapters (`src/scanner/adapters.ts`) for Next.js app
and pages routers, Remix, Nuxt, React Router and Vue Router. State discovery walks TS/TSX/JS/JSX
and Vue single-file components and extracts loading, error, empty, modal, form, auth and role
signals from the syntax tree. Both are reproducible: the same commit produces the same manifest,
every time, on any machine.

The LLM layer exists — there is a provider abstraction, JSON-schema validation of responses, and
deduplication against the deterministic set — but it is opt-in, it is capped, and its output is
routed back through the deterministic priority engine so it comes back normalised rather than
trusted on its own authority. If you never configure a provider, Spotter still works. That was
the requirement.

## What was actually hard

**Narrowing a changed-run without lying about it.** Running the full suite on every commit is
useless at any real size, so `spotter changed` maps changed files to impacted scenarios. That is
easy when someone edits `app/checkout/page.tsx`. It is not easy when they edit
`components/Button.tsx`, which every route touches.

The tempting answers are both wrong. Fall back to the full suite and the feature is pointless.
Guess at the blast radius and you have quietly invented confidence you do not have.

What Spotter does instead is split the output. Files that map cleanly to a route produce
*trusted* scenarios. Shared-component changes produce a separate, explicitly bounded
`Possible Additional Impact` set — capped at two routes per changed file and six scenarios total
(`src/playwright/impact.ts`), with generic path segments like `components/`, `lib/` and `shared/`
excluded from route inference so they cannot masquerade as evidence. Low confidence is shown
next to the trusted set, never blended into it.

That cap is arbitrary, and I know it is arbitrary. It is there because an unbounded uncertain set
is indistinguishable from a full run, and a bounded one is at least reviewable.

**Making "found nothing" a real answer.** When deterministic route discovery fails, the honest
output is not an empty route inventory presented as success. Spotter records the inferred
framework, says explicitly what it searched and did not find, and points at the correction path.
Silent empty results were the single failure mode I most wanted to prevent, because they are the
ones that teach people the tool is broken without telling them why.

**Deciding what the reviewable artifact is.** Generated tests are machinery. The manifest — route
identity, scenario name, why it was included, confidence, provenance, execution scope, correction
hint — is the thing a skeptical engineer actually opens, so it is what gets committed to git and
what the report renders first. Tests are treated as derived, and as stale when they drift from
it.

## What I would change

The README grew by accretion. Each capability got a paragraph as it landed, and the result now
reads like a changelog rather than a pitch — it tells you everything Spotter does before it has
convinced you why you would want any of it.

Framework breadth was also the wrong instinct. Five route adapters is a nice bullet list, but the
depth of the trust loop is what would make a team keep this switched on after week one, and every
adapter is surface area that has to keep working. The stated rule now is that breadth gets cut
first under scope pressure. I would have written that rule earlier.

The scenario naming rule — name the user-visible state (`empty-cart`, `validation-error`,
`logged-out`), never the implementation mechanism — is the small decision I am most confident
about. Names tied to hooks or branch structure break the moment the code is refactored, which is
exactly when you need the baseline to still mean something.

## Where it stands

Published on npm as [`@dcacheson/spotter`](https://www.npmjs.com/package/@dcacheson/spotter).
TypeScript, 27 test files, CI on Node 20 and 22 across Ubuntu and Windows. The bundled
`examples/fixture-next-ux` app is the working proof: eleven scenarios derived from routes and
component ASTs alone, no configuration and no model involved, five of which are states you cannot
reach by typing a URL.

It is not finished. Auth and session handling for arbitrary apps, feature-flag state inference
and non-file-based routing are all explicit v1 non-goals, and React/Vite deserves the same
first-class treatment Next.js has. But the loop it was built to prove — changed files, to
human-readable intent, to executable checks — closes.
