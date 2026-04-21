# Spotter UX Fixture Findings

## Summary

This file records an end-to-end Spotter run against a purpose-built Next.js UX fixture app in `fixture-next-ux`.

The fixture includes:

- Next.js app router routes
- a dynamic route
- a route group
- a parallel route
- loading, error, form, auth, role, empty, modal, validation, localization, and feature-flag style code branches

Result:

- the fixture app itself builds successfully
- Spotter `init`, `scan`, and `generate` complete
- Spotter `baseline`, `changed`, and `report` expose multiple product bugs on Windows
- a direct Playwright workaround proves the generated specs can run when Spotter's broken runner/config path is bypassed

## Environment

- OS: Windows
- Node: `v22.19.0`
- npm: `10.9.3`
- Spotter package: `@dcacheson/spotter@0.1.0`
- Playwright: `1.59.1`

## Fixture Setup

Created a small Next app at `fixture-next-ux` with these notable routes:

- `/`
- `/checkout`
- `/products`
- `/admin`
- `/settings`
- `/pricing` from a route group
- `/blog/[slug]` dynamic route
- `app/@modal/intercepted/page.jsx` parallel route for discovery testing

The app deliberately includes:

- explicit loading branches
- explicit error branches
- explicit form validation states
- explicit auth and role gates
- an explicit empty state on products
- a modal branch
- localized copy
- feature-flag-like conditional content

## Commands Run

```powershell
npm install
npm run build
npm install -D @dcacheson/spotter @playwright/test
npx playwright install chromium
node .\node_modules\@dcacheson\spotter\dist\cli.js --version
node .\node_modules\@dcacheson\spotter\dist\cli.js init
node .\node_modules\@dcacheson\spotter\dist\cli.js scan
node .\node_modules\@dcacheson\spotter\dist\cli.js generate
node .\node_modules\@dcacheson\spotter\dist\cli.js baseline
node .\node_modules\@dcacheson\spotter\dist\cli.js changed
node .\node_modules\@dcacheson\spotter\dist\cli.js report
```

Workaround verification command:

```powershell
npx playwright test --config .\playwright.relative.config.mjs --update-snapshots
```

That workaround run passed all generated specs.

## What Worked

### Route discovery

Spotter correctly discovered these 7 routes:

- `/`
- `/admin`
- `/blog/[slug]`
- `/checkout`
- `/pricing`
- `/products`
- `/settings`

It correctly did not include the parallel route as a user-facing route.

### Baseline workaround validation

Using a temporary relative-path Playwright config, all 14 generated specs ran and passed.

This matters because it shows:

- the fixture app is valid
- the generated specs are at least broadly executable
- several failures below are Spotter product bugs, not app bugs

## Confirmed Bugs

### 1. `baseline` fails on Windows with `spawn EINVAL`

- Severity: high
- Area: CLI runner / Windows support

#### Repro

```powershell
node .\node_modules\@dcacheson\spotter\dist\cli.js baseline
```

Observed:

- command throws `Error: spawn EINVAL`
- failure occurs before Playwright can run

Root cause evidence:

- Spotter uses a Node spawn call with `npx.cmd` on Windows
- a direct shell call works:

```powershell
npx playwright --version
```

- but a Node-level spawn of `npx.cmd` fails in this environment with the same `EINVAL`

Impact:

- `baseline` is unusable on this Windows setup

Likely fix direction:

- use `shell: true` for Windows command invocation
- or invoke `cmd.exe /c npx ...`
- or avoid `npx.cmd` spawning directly on Windows

### 2. `changed` fails on Windows with the same `spawn EINVAL`

- Severity: high
- Area: CLI runner / Windows support

#### Repro

```powershell
node .\node_modules\@dcacheson\spotter\dist\cli.js changed
```

Observed:

- same `spawn EINVAL` failure pattern as `baseline`

Impact:

- diff-based workflow is blocked on Windows

Likely fix direction:

- same runner fix as `baseline`

### 3. Generated absolute-path Playwright config fails on Windows with `Requiring @playwright/test second time`

- Severity: high
- Area: Playwright config generation / Windows path handling

#### Repro

```powershell
npx playwright test --config .\.spotter\artifacts\playwright.baseline.config.mjs --update-snapshots
```

Observed:

- Playwright throws repeated `Requiring @playwright/test second time` errors
- generated tests do not run under Spotter's emitted config

Important discriminator:

- a temporary config using relative paths works:

```powershell
npx playwright test --config .\playwright.relative.config.mjs --update-snapshots
```

- all 14 tests passed under the relative-path config

Interpretation:

- the failure is not a general incompatibility between Spotter specs and Playwright
- it is likely caused by the generated absolute paths on Windows, possibly with path casing or loader identity issues

Impact:

- even if the spawn bug is fixed, the emitted Playwright config is still broken on this Windows setup

Likely fix direction:

- prefer relative `testDir` and snapshot paths in generated config
- audit Windows path normalization and path casing

### 4. `generate` reports 28 test files, but only 14 unique files are written

- Severity: high
- Area: test generation / viewport-locale expansion

#### Repro

```powershell
node .\node_modules\@dcacheson\spotter\dist\cli.js generate
```

Observed:

- CLI output says:

```txt
Generated 28 Playwright test files from 14 scenarios.
```

- actual `.spotter/tests` directory contains 14 spec files
- generated files contain only one viewport per scenario, usually mobile

Evidence:

- scenario plan contains both `desktop` and `mobile` targets
- file naming appears to depend only on route plus scenario id, not viewport or locale target
- later writes overwrite earlier writes for the same scenario

Impact:

- advertised coverage expansion across viewports/locales is not actually preserved as separate test files
- one target silently replaces another
- effective visual coverage is reduced without warning

Likely fix direction:

- include viewport and locale identity in the generated spec file name
- or group multiple tests into one file per scenario instead of overwriting
- adjust CLI counts to reflect files actually written

### 5. Empty-state detection missed an explicit empty state

- Severity: medium-high
- Area: AST signal scanning

#### Fixture case

`/products` contains an explicit empty-state branch based on `products.length === 0` and renders `No products found`.

Observed:

- scan found 11 signals
- no `empty` signal or empty-state scenario was generated for `/products`
- only `products-default` was generated

Expected:

- README claims scanner can extract signals such as loading, error, empty, modal, form, auth, and role checks
- `/products` should produce an `empty` signal and likely a `Products Empty State` scenario

Impact:

- a documented UX state class is missed on a simple and common pattern

Likely fix direction:

- add detection for array-length zero and similar empty-data branches
- include copy-based signals like `No products found` only as a fallback, not the primary mechanism

### 6. Dynamic-route tests use the literal template path `/blog/[slug]`

- Severity: medium
- Area: scenario generation / route execution realism

#### Observed

Generated test example:

```ts
await page.goto('/blog/[slug]');
```

Expected:

- generated dynamic-route scenarios should use a concrete sample path or fixture params
- examples: `/blog/sample-post` or user-configurable route params

Notes:

- this did not fail in the fixture app because Next treats `[slug]` as a literal slug value
- it is still low-quality execution because it does not represent realistic route data

Impact:

- generated coverage for dynamic routes may be misleading or unusable in real apps

Likely fix direction:

- require or infer sample params for dynamic segments
- emit a clear placeholder mechanism if no fixture data exists

### 7. `report` fails with a raw `ENOENT` stack trace when no changed artifact exists

- Severity: medium
- Area: UX / error handling

#### Repro

```powershell
node .\node_modules\@dcacheson\spotter\dist\cli.js report
```

Observed:

- command throws a raw Node stack trace for missing `.spotter/artifacts/changed-run.json`

Expected:

- a user-facing error like:
  - `No changed-run artifact found. Run 'spotter changed' first.`

Impact:

- workflow prerequisites are not communicated clearly

Likely fix direction:

- catch missing artifact errors and emit actionable CLI guidance

### 8. CLI version still reports `0.0.0`

- Severity: medium
- Area: CLI metadata

#### Repro

```powershell
node .\node_modules\@dcacheson\spotter\dist\cli.js --version
```

Observed:

- output is `0.0.0`

Expected:

- output should match the published version `0.1.0`

## Coverage Gaps Observed In This Fixture

These are not all necessarily bugs yet, but they are worth retesting after fixes:

- empty-state detection for array-driven UIs
- success-state detection from `submitted` or similar form completion branches
- mobile-nav and responsive-state discovery from boolean layout flags
- localization and RTL specific scenario generation beyond configured locale expansion
- feature-flag branch discovery

## Recommended Fix Order

1. Fix Windows process spawning for `baseline` and `changed`
2. Fix generated Playwright config to avoid absolute-path loader issues on Windows
3. Fix generated file collisions across viewport/locale targets
4. Improve empty-state detection
5. Improve dynamic-route execution strategy
6. Improve prerequisite error messages for `report`

## Useful Artifacts

- Fixture app: `fixture-next-ux`
- Spotter config: `fixture-next-ux/spotter.config.json`
- Generated route manifest: `fixture-next-ux/.spotter/artifacts/route-manifest.json`
- Generated signals: `fixture-next-ux/.spotter/artifacts/component-signals.json`
- Generated scenarios: `fixture-next-ux/.spotter/artifacts/scenarios.json`
- Generated scenario plan: `fixture-next-ux/.spotter/artifacts/scenario-plan.json`
- Generated tests: `fixture-next-ux/.spotter/tests`
- Temporary workaround config: `fixture-next-ux/playwright.relative.config.mjs`


# Spotter Test Plan And Bug Backlog

## Scope

This document is for testing the published npm package `@dcacheson/spotter` and recording bugs to fix later.

Sources used:

- Published npm package metadata and tarball for `@dcacheson/spotter@0.1.0`
- Published README on npm and GitHub
- Smoke tests run locally on Windows with Node `v22.19.0` and npm `10.9.3`

## Confirmed Bugs

### 1. `npx @dcacheson/spotter@latest --help` exits without showing help

- Severity: high
- Area: packaging / CLI execution
- Status: confirmed on Windows

#### Repro

```powershell
npx @dcacheson/spotter@latest --help
```

Observed:

- `npx` prompts to install `@dcacheson/spotter@0.1.0`
- after confirming, the command exits non-zero
- no help text is printed

Expected:

- the standard CLI help output should print successfully
- exit code should be `0`

#### Evidence

- The published tarball contains `dist/cli.js` as the `bin` target.
- The published `dist/cli.js` does not include a shebang such as `#!/usr/bin/env node`.
- Running the installed file directly with Node works:

```powershell
node .\node_modules\@dcacheson\spotter\dist\cli.js --help
```

This strongly suggests the package contents are mostly valid, but the published executable entrypoint is not packaged in a form that `npx` can execute reliably.

#### Likely Fix Direction

- ensure the published CLI entrypoint includes a shebang
- verify `npx @dcacheson/spotter@latest --help` on Windows and macOS/Linux before publishing

### 2. CLI reports version `0.0.0` instead of the published package version

- Severity: medium
- Area: CLI metadata
- Status: confirmed

#### Repro

```powershell
node .\node_modules\@dcacheson\spotter\dist\cli.js --version
```

Observed:

- output is `0.0.0`

Expected:

- output should be `0.1.0` for the currently published package

#### Evidence

- npm metadata reports package version `0.1.0`
- the source also appears to hard-code `0.0.0` in the exported package version and CLI program version

#### Likely Fix Direction

- source the CLI version from `package.json` at build time or inject it during bundling
- add a release test that compares `--version` output with the published package version

### 3. README install and `npx` usage are inconsistent across published docs

- Severity: medium
- Area: documentation
- Status: confirmed

#### Observed

The docs are inconsistent about the package name:

- some docs correctly refer to `@dcacheson/spotter`
- GitHub README excerpts still show unscoped commands like:

```bash
npm install -D spotter @playwright/test
npx spotter@latest init
```

Expected:

- all install and run instructions should consistently use the actual published package name or the actual installed bin flow

#### Why This Matters

- users may try to install the wrong package
- users may assume `npx spotter@latest` works when the published package is scoped
- this will create false bug reports and onboarding friction

#### Likely Fix Direction

- normalize README examples to the scoped package name or to the local installed binary flow
- verify every command in docs against a clean machine before publishing

## Recommended Test Matrix

## A. Install And Packaging

### A1. Fresh `npx` help on Windows

- command: `npx @dcacheson/spotter@latest --help`
- verify install prompt appears once
- verify help text prints
- verify exit code is `0`

### A2. Fresh `npx` help on macOS/Linux

- command: `npx @dcacheson/spotter@latest --help`
- verify help text prints
- verify exit code is `0`

### A3. Local dependency install

- command: `npm install -D @dcacheson/spotter @playwright/test`
- verify package installs cleanly
- verify no missing runtime dependency errors when running commands

### A4. Local bin after install

- command: `npx spotter --help`
- verify command resolves to the installed local package
- verify exit code is `0`

### A5. Version output

- command: `npx spotter --version`
- verify it matches the package version in `package.json` and npm

### A6. Tarball integrity

- command: `npm pack @dcacheson/spotter@latest`
- verify tarball contains:
  - `dist/cli.js`
  - `dist/index.js`
  - type declarations
  - README
  - package metadata
- verify `dist/cli.js` is executable as a node CLI

## B. CLI Surface

### B1. Top-level help

- command: `npx spotter --help`
- confirm commands listed:
  - `init`
  - `scan`
  - `generate`
  - `baseline`
  - `changed`
  - `report`

### B2. Command help pages

- run `npx spotter <command> --help` for each command
- verify each command has meaningful description text
- verify no command throws or exits unexpectedly

### B3. Invalid command

- command: `npx spotter nope`
- verify clear error message
- verify help hint is shown
- verify non-zero exit code

### B4. Running in an empty folder

- run `init`, `scan`, `generate`, `baseline`, `changed`, `report` one by one in an empty directory
- verify errors are clear and actionable where commands require prior artifacts

## C. Config Handling

### C1. `init` creates default config

- command: `npx spotter init`
- verify `spotter.config.json` is created
- verify contents include:
  - `appUrl`
  - `devServer`
  - `rootDir`
  - `locales`
  - `viewports`
  - `paths`

### C2. `init` in a directory with existing config

- run `npx spotter init` twice
- verify second run fails with a clear message and does not overwrite config

### C3. JSON config override

- create `spotter.config.json` with custom `appUrl`, `paths`, `viewports`, and `locales`
- verify subsequent commands use those values

### C4. TypeScript config loading

- create `spotter.config.ts`
- verify it loads correctly
- verify JSON and TS precedence is documented and deterministic

### C5. `devServer: null`

- set `devServer` to `null`
- verify baseline and changed commands do not try to start a server

### C6. Custom `devServer.cwd`

- point `devServer.cwd` at a nested app directory
- verify generated Playwright config resolves the path correctly

### C7. Broken config JSON

- introduce invalid JSON
- verify error is explicit and points to the config file

### C8. Broken TS config

- throw inside `spotter.config.ts`
- verify error is explicit and includes the stack or cause

## D. Route Discovery

Use small sample repos for each case.

### D1. Next.js app router root route

- fixture: `app/page.tsx`
- expected route: `/`

### D2. Nested app router routes

- fixture: `app/dashboard/page.tsx`
- expected route: `/dashboard`

### D3. Dynamic app routes

- fixture: `app/blog/[slug]/page.tsx`
- expected dynamic route metadata for `[slug]`

### D4. Catch-all routes

- fixture: `app/docs/[...parts]/page.tsx`
- verify catch-all segment metadata

### D5. Optional catch-all routes

- fixture: `app/docs/[[...parts]]/page.tsx`
- verify optional catch-all segment metadata

### D6. Route groups ignored in URL

- fixture: `app/(marketing)/pricing/page.tsx`
- expected route: `/pricing`

### D7. Parallel routes ignored in URL

- fixture: `app/@modal/intercepted/page.tsx`
- verify they do not become top-level URLs

### D8. Pages router root route

- fixture: `pages/index.tsx`
- expected route: `/`

### D9. Nested pages routes

- fixture: `pages/docs/getting-started.tsx`
- expected route: `/docs/getting-started`

### D10. Pages dynamic routes

- fixture: `pages/blog/[slug].tsx`
- expected dynamic route metadata

### D11. API and underscore files ignored

- fixtures:
  - `pages/api/health.ts`
  - `pages/_app.tsx`
  - `pages/_document.tsx`
- verify no user-facing routes are produced

### D12. Mixed `app` and `pages` repos

- include both directory styles
- verify deduping is deterministic if equivalent routes exist

### D13. Monorepo rootDir support

- set `rootDir` to `apps/web`
- verify discovered file paths are normalized correctly relative to that root

### D14. Non-Next repo

- run against a Vite or plain React repo
- verify behavior is clear:
  - either no routes with good messaging
  - or a supported-framework warning

## E. Component Signal Scanning

### E1. Loading state detection

- component contains `loading` flag and loading branch
- verify loading signal is emitted

### E2. Error state detection

- component contains `error` branch
- verify error signal is emitted

### E3. Empty state detection

- component contains empty-list or empty-data branch
- verify empty signal is emitted

### E4. Modal detection

- component uses `isOpen` or modal render branch
- verify modal signal is emitted

### E5. Form detection

- component contains a form and validation branch
- verify form signal is emitted

### E6. Auth gate detection

- component checks `user`, `session`, or auth role
- verify auth or role signal is emitted

### E7. JS and JSX files

- test `.js` and `.jsx` source files
- verify they are scanned, not just TS and TSX

### E8. False positives

- use variable names like `loadingColor` or `errorCount`
- verify signal detection does not over-trigger on unrelated identifiers

### E9. Large file performance

- run scan against a large component tree
- verify execution time stays reasonable
- verify output remains deterministic across repeated runs

## F. Heuristics And Scenario Generation

### F1. Base route scenario generation

- one route with no signals
- verify at least the default route scenario is generated

### F2. Loading heuristic

- route with loading signal
- verify loading scenario exists with expected tags or recipe hints

### F3. Error heuristic

- route with error signal
- verify error scenario exists

### F4. Form heuristic

- route with form signal
- verify validation scenario exists

### F5. Auth and role priority effects

- route protected by auth or role checks
- verify priority changes deterministically

### F6. Scenario deduplication

- create overlapping signals and heuristics
- verify duplicate scenarios are not produced

### F7. Stable ordering

- run `generate` twice without code changes
- verify scenario JSON and generated test ordering are identical

### F8. Locale expansion

- configure multiple locales including RTL
- verify scenario plan multiplies per locale

### F9. Viewport expansion

- configure desktop, mobile, tablet
- verify scenario plan multiplies per viewport

### F10. Locale x viewport cross-product

- verify total plan count equals scenarios x locales x viewports

## G. Playwright Test Generation

### G1. Tests directory output

- run `npx spotter generate`
- verify generated specs land in configured `testsDir`

### G2. Generated file naming

- verify filenames are deterministic and readable
- verify names are stable across repeated runs

### G3. Screenshot assertion settings

- inspect generated tests
- verify screenshot assertions use:
  - disabled animations
  - hidden carets
  - CSS scale
  - full-page capture

### G4. Base URL usage

- verify generated baseline/changed Playwright config uses `appUrl` as `use.baseURL`

### G5. No overwrite surprises

- add a manual file under generated test output
- verify generation behavior is clear and documented

## H. Baseline Command

### H1. Baseline run on working sample app

- after `generate`, run `npx spotter baseline`
- verify screenshots are written to configured `screenshotsDir`
- verify artifact JSON is written

### H2. Auto web server startup

- with valid `devServer.command`
- verify baseline starts server when needed

### H3. Reuse existing server

- with `reuseExistingServer: true`
- start app manually, then run baseline
- verify command reuses running server

### H4. Invalid server command

- break `devServer.command`
- verify failure is explicit and actionable

### H5. Missing Playwright dependency

- install spotter without `@playwright/test`
- verify error clearly tells user what is missing

### H6. Missing browser install

- do not run `npx playwright install`
- verify failure clearly tells user how to fix it

## I. Changed Command And Diff Collection

### I1. No visual changes

- run `changed` immediately after successful baseline
- verify changed count is `0`
- verify exit behavior is intentional and documented

### I2. Real UI change

- change CSS or layout visibly
- run `changed`
- verify changed artifacts include diff, current, and baseline paths

### I3. Multiple changed screenshots

- trigger multiple scenario diffs
- verify summary counts are correct

### I4. Missing baseline directory

- run `changed` before `baseline`
- verify error is explicit

### I5. Corrupted Playwright results

- simulate malformed results output
- verify Spotter handles it gracefully or reports a clear parse failure

### I6. Changed run artifact structure

- inspect `.spotter/artifacts/changed-run.json`
- verify it contains command, args, config path, results path, pass/fail, and summary

## J. Report Command

### J1. Report after successful changed run

- run `npx spotter report`
- verify markdown report is generated

### J2. Report with changed screenshots

- verify report includes:
  - priority
  - scenario name
  - diff path
  - baseline path
  - current path

### J3. Report with zero diffs

- verify markdown still renders usefully and does not look broken

### J4. Report without scenarios artifact

- delete `scenarios.json`
- verify report degrades gracefully or produces a clear error

### J5. Report before changed run exists

- run `report` without `changed-run.json`
- verify error is explicit and actionable

## K. Determinism And Repeatability

### K1. Repeated `scan`

- run `scan` twice in a row
- verify artifacts are byte-stable or meaningfully stable aside from timestamp fields

### K2. Repeated `generate`

- run `generate` twice in a row
- verify no churn in generated files beyond expected timestamps

### K3. Cross-platform paths

- compare Windows and POSIX outputs
- verify stored file paths are normalized consistently

### K4. Git-friendliness

- inspect generated JSON and markdown in git diff
- verify artifacts are reviewable and low-noise

## L. Edge Cases Worth Testing Early

### L1. Dynamic routes without fixtures

- verify generated tests for `/blog/[slug]` do not become unusable without parameter handling

### L2. Auth-gated pages that redirect immediately

- verify baseline and changed behavior is understandable

### L3. Routes requiring seeded data

- verify generated tests either fail clearly or provide extension points for setup

### L4. Locale-specific URLs

- test apps where locale is part of pathname rather than app state

### L5. Very large repos

- verify scan time and memory use remain acceptable

### L6. Symlinked monorepo packages

- verify `rootDir` and scanning do not break on common workspace layouts

## Suggested Order To Test

1. Packaging and CLI help/version
2. `init` and config handling
3. Route discovery against tiny fixtures
4. Signal scanning and deterministic scenario generation
5. Generated Playwright tests
6. Baseline run on a simple Next.js sample app
7. Changed-run diff capture after a visual change
8. Markdown reporting
9. Cross-platform and monorepo cases

## Useful Sample Repos To Build For Testing

### Sample 1. Tiny happy-path Next app

- app router only
- one static route
- one loading branch
- one form

### Sample 2. Dynamic route repo

- app router with `[slug]`, `[...parts]`, and `[[...parts]]`

### Sample 3. Auth-heavy repo

- routes that branch on session, admin role, and permissions

### Sample 4. Monorepo

- root config with `rootDir: apps/web`

### Sample 5. Non-Next repo

- Vite React app to validate unsupported-stack behavior

## Bug Report Template

Use this format when filing issues for yourself later.

```md
### Title

### Severity

### Environment
- OS:
- Node:
- npm/pnpm/yarn:
- Spotter version:

### Repro Steps
1.
2.
3.

### Expected

### Actual

### Logs / Output

### Artifacts Affected
- config:
- route manifest:
- signals:
- heuristics:
- scenarios:
- scenario plan:
- baseline run:
- changed run:
- report:

### Notes
```

## Immediate Priorities

If you only fix a few things first, I would start with:

1. Package executable correctness for `npx`
2. Correct CLI version output
3. README command consistency
4. Clear failures when baseline or changed is run out of order
5. Dynamic route handling and test generation on real sample apps

## Updated Remaining Priorities After Example Fixture Pass

Added persistent fixture repos under `examples/`:

- `examples/fixture-next-ux`
- `examples/fixture-react-vite`
- `examples/fixture-vue-vite`

Automated verification now covers those fixtures in `tests/example-fixtures.test.ts`.

Current fixture results:

- `fixture-next-ux`: `scan` and deterministic test generation behave as expected after the recent fixes.
- `fixture-react-vite`: Spotter does not crash, scans TSX signals, and does not invent routes.
- `fixture-vue-vite`: Spotter now scans `.vue` SFC loading, empty, form, responsive, and locale states instead of silently skipping them.

New local status after the latest changes:

- explicit unsupported-framework messaging is implemented for `scan` and `generate`
- Vue SFC signal scanning is implemented and covered by fixture tests
- `generate` can now load an explicit LLM fallback from `spotter.config.*` or `--llm-*` CLI overrides when deterministic routes are absent
- deterministic success, feature-flag, responsive-layout, and localization heuristics are implemented and covered by unit tests
- these latest changes are validated locally but are not published in a newer npm package yet

Backlog structure at this point:

### Fixed Historical Bugs

- Windows `baseline` spawn failure is fixed.
- Windows `changed` spawn failure is fixed.
- Windows absolute-path Playwright config issue is fixed.
- Generated file collisions across viewport and locale targets are fixed.
- Empty-state detection for array-length comparisons is fixed.
- Dynamic-route sample path generation is fixed.
- `report` now gives actionable missing-artifact guidance.
- CLI shebang and version metadata issues are fixed.
- Unsupported-framework CLI messaging is fixed.
- Vue SFC signal scanning is fixed.
- Success-state deterministic heuristics are fixed.
- Feature-flag deterministic heuristics are fixed.
- Responsive nav or layout deterministic heuristics are fixed.
- Localization-specific deterministic heuristics are fixed.

### Confirmed Remaining Bugs Or Product Gaps

No remaining deterministic scanner gaps are currently confirmed in this backlog slice. The previous top four gaps for success-state, feature-flag, responsive-layout, and localization-specific coverage are now implemented and validated locally.

### High-Risk Paths Still Needing Real Validation

1. The new CLI-configured LLM fallback has now been exercised end to end against a real local Ollama provider, but small-model output quality remains a product risk.
  - Severity: medium-high
  - Why it matters: the provider transport and schema validation path are working, but `qwen2.5:0.5b` returned empty scenario sets for the React and Vue fixtures and produced an invalid scenario object during direct provider probing. The remaining risk is model quality and prompt robustness, not endpoint wiring.

2. The newest local fixes are not yet published in a newer npm package.
  - Severity: medium-high
  - Why it matters: until the next release is published, `@latest` does not include the Vue SFC scanner or the new CLI-configured LLM fallback.

3. The next published package still needs clean-install smoke tests for the Windows baseline or changed workflow and the new `generate --llm-*` path.
  - Severity: medium
  - Why it matters: those are integration-heavy flows where packaging, config loading, and runtime dependencies can still regress.

Priority order to fix or validate from here:

1. Publish the next npm version and rerun clean-install smoke tests, including Windows baseline or changed and the new `generate --llm-*` flow.
2. Improve fallback prompt robustness or recommend a stronger local model before treating route-less LLM fallback as production-ready.

Recommended next manual verification order:

1. Publish the next npm version.
2. Re-run the Next, React, and Vue fixtures from a clean install using the published package on Windows.
3. Re-run the React and Vue fixtures with a stronger local or hosted model to benchmark fallback scenario quality.