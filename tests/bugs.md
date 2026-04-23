# Spotter 0.1.3 Retest

## Scope

This is a retest of the newly published `@dcacheson/spotter@0.1.3` package.

It builds on the earlier findings in `SPOTTER_TEST_PLAN_AND_BUGS.md` and `SPOTTER_UX_FIXTURE_FINDINGS.md`.

## Environment

- OS: Windows
- Node: `v22.19.0`
- npm: `10.9.3`
- Spotter: `0.1.3`
- Playwright: `1.59.1`

## Test Surfaces

### 1. Published package smoke checks

- `npx -y @dcacheson/spotter@latest --help`
- `npx -y @dcacheson/spotter@latest --version`

### 2. Main UX fixture

- directory: `fixture-next-ux`
- purpose: realistic Next.js app with loading, error, empty, success, modal, auth, role, feature-flag, responsive, locale, route-group, and dynamic-route patterns

### 3. No-route fixture

- directory: `fixture-no-routes`
- purpose: verify behavior when Spotter can scan UX signals but cannot deterministically discover routes

## What Was Fixed In 0.1.3

### 1. Published `npx` help now works

Repro:

```powershell
npx -y @dcacheson/spotter@latest --help
```

Result:

- help text printed correctly
- no install-prompt failure
- the previous packaging regression appears fixed

### 2. Version output now matches the published version

Repro:

```powershell
npx -y @dcacheson/spotter@latest --version
```

Result:

- output is `0.1.3`
- the old `0.0.0` version bug appears fixed

### 3. Docs now use the scoped package correctly

Observed from npm README:

- install examples now use `@dcacheson/spotter`
- direct `npx` usage now shows `npx @dcacheson/spotter@latest init`

The major README inconsistency from the earlier version appears fixed.

### 4. Scanner coverage improved materially on the UX fixture

On the same fixture app, Spotter improved from:

- `11` signals to `17` signals
- `14` scenarios to `20` scenarios

Newly detected signal/scenario coverage now includes:

- `empty`
- `success`
- `responsive`
- `locale`
- `feature`

This is a real improvement over the prior version.

### 5. Generated file collisions across viewport targets are fixed

Observed:

- `generate` reported `40` test files from `20` scenarios
- the `.spotter/tests` directory actually contains `40` distinct files
- desktop and mobile variants are written separately

The earlier overwrite bug appears fixed.

### 6. Dynamic-route generation improved

Generated test sample now uses:

```ts
await page.goto('/blog/sample-slug');
```

instead of the old literal route template:

```ts
await page.goto('/blog/[slug]');
```

This is a meaningful improvement for dynamic-route realism.

### 7. Generated baseline config now uses relative paths

Observed generated config:

- `testDir: "../tests"`
- `snapshotPathTemplate: "../baselines/{testFilePath}/{arg}{ext}"`

This appears to fix the earlier Windows issue where the absolute-path config triggered Playwright's duplicate `@playwright/test` import error.

### 8. No-route messaging now matches the README claims

In the `fixture-no-routes` project:

```powershell
npx spotter scan
npx spotter generate
```

Result:

- `scan` reported `0 routes and 3 signals`
- Spotter printed a clear warning that no deterministic routes were found
- `generate` reported `0 Playwright test files from 0 scenarios`
- it also printed the same supported-adapters explanation

This is good behavior and a meaningful product improvement.

## Remaining Bugs In 0.1.3

### 1. Baseline is still unstable when using the default `npm run dev` server path

- Severity: medium-high
- Area: baseline reliability / default workflow

Observed on `fixture-next-ux` with the default Spotter config:

```powershell
npx spotter baseline
```

Result:

- Playwright started and ran, so the Windows spawn problem is fixed
- but two tests failed during baseline creation with:
  - `Failed to take two consecutive stable screenshots`

Interpretation:

- the failure appears tied to using the Next.js dev server path for screenshot capture
- when the fixture was switched to `npm run start` and built first, baseline succeeded cleanly

Impact:

- the default starter config may still produce flaky or failing baselines on common Next.js setups

Likely fix direction:

- prefer a more stable production-oriented workflow for baseline capture
- or detect and suppress dev-only UI noise
- or document that `npm run dev` may not be stable enough for reliable screenshot baselines

### 2. `changed` generates invalid Playwright config syntax

- Severity: high
- Area: changed-run config generation

Repro:

```powershell
npx spotter changed
```

Observed:

- Spotter writes `.spotter/artifacts/playwright.changed.config.mjs`
- that file is syntactically invalid because `outputDir` is inserted without a separating comma

Broken output example:

```js
  }
  outputDir: "./playwright-results"
});
```

Expected:

```js
  },
  outputDir: "./playwright-results"
});
```

Impact:

- `changed` cannot execute successfully even after `baseline` succeeds

### 3. `changed` masks Playwright parse failure as a 0-diff changed run

- Severity: high
- Area: changed-run result handling

Observed:

- Playwright throws a syntax parse error for the invalid changed config
- Spotter still prints:

```txt
Changed run failed with 0 changed screenshots.
Changed artifact written to ...changed-run.json
```

- the written artifact reports:
  - `passed: false`
  - `changed: 0`
  - `artifacts: []`

Why this is a bug:

- the run did not actually complete a valid diff check
- `0 changed screenshots` is misleading because the runner never reached a valid comparison phase

Impact:

- downstream tooling and humans may misread a config parse failure as a legitimate no-diff run

### 4. `report` trusts the misleading failed changed-run artifact too readily

- Severity: medium
- Area: reporting / failure semantics

Repro after the broken `changed` run:

```powershell
npx spotter report
```

Observed:

- report succeeds
- it renders a summary showing:
  - changed scenarios: `0`
  - high/medium/low diffs: `0`

This is technically consistent with the artifact, but still misleading because the changed-run artifact itself came from a parse failure, not a valid comparison.

Impact:

- the package currently has no distinction between:
  - legitimate zero-diff results
  - execution failure before diff collection

### 5. Baseline success currently required a production-server workaround in the fixture

- Severity: medium
- Area: workflow ergonomics

To get a reliable baseline on the UX fixture, the config had to be changed from:

```json
"command": "npm run dev"
```

to:

```json
"command": "npm run start"
```

and the app had to be built before baseline.

This is workable, but the package defaults still steer users toward the less stable dev-server route.

## UX Fixture Results Summary

### Scan and generate

- passed
- significantly improved over the previous package version

### Baseline with default dev server

- still flaky / unstable on this fixture

### Baseline with production server after `npm run build`

- passed
- all `40` tests completed successfully

### Changed after successful baseline

- failed due to invalid generated config syntax

### Report after failed changed run

- succeeded, but summarized a misleading `0 changed` failure artifact

## No-Route Fixture Results Summary

### Scan

- passed
- clear `0 routes` messaging
- still captured `3` UX signals

### Generate

- passed
- clear `0 scenarios` messaging
- no silent failure or confusing empty output

## Recommended Priorities After 0.1.3

1. Fix `playwright.changed.config.mjs` generation so `changed` becomes executable again.
2. Separate failed-run semantics from legitimate zero-diff semantics in the changed artifact and report layer.
3. Revisit the default baseline workflow for Next.js dev servers, because `npm run dev` is still too unstable on this fixture.

## Current Repo Status After Follow-up Fixes

These notes describe the current repository state after follow-up fixes made after the `0.1.3` retest above. The sections above still accurately capture what the published `0.1.3` package did during retest, but they no longer reflect the latest implementation in this repo.

### Fixed since the retest

#### 1. `changed` config generation is now valid

- status: fixed in repo
- the generated `playwright.changed.config.mjs` now writes `outputDir` with valid syntax
- `changed` is no longer blocked by the missing-comma regression from the published retest

#### 2. `changed` now distinguishes execution failure from a real 0-diff run

- status: fixed in repo
- changed-run artifacts now record whether the run actually completed
- execution failures are reported as incomplete runs instead of misleading `0 changed screenshots`

#### 3. `report` no longer treats execution failure as a legitimate no-diff result

- status: fixed in repo
- report output now distinguishes incomplete changed runs from successful no-diff runs
- this closes the misleading summary behavior described in the retest

#### 4. Baseline and changed now support a dedicated `captureServer`

- status: implemented in repo
- screenshot capture can now use a production-style command without changing the regular local `devServer`
- this mitigates the baseline instability workaround found in the retest
- example shape:

```json
{
  "devServer": {
    "command": "npm run dev",
    "reuseExistingServer": true,
    "timeoutMs": 120000
  },
  "captureServer": {
    "command": "npm run start",
    "reuseExistingServer": true,
    "timeoutMs": 120000
  }
}
```

#### 5. Manual IDE-assist workflow now exists

- status: implemented in repo
- `spotter prompt` writes a copy-pasteable scenario-assist prompt and JSON context artifact
- `spotter import --input <path>` validates reviewed JSON suggestions, merges them with deterministic scenarios, and regenerates tests and artifacts
- this is not part of the original `0.1.3` retest scope, but it is now part of the current repo workflow

### Still open in the current repo

#### 1. Default baseline ergonomics are still weaker than they should be for some Next.js apps

- status: still open
- the new `captureServer` split gives users a clean fix, but the default starter config still points to `npm run dev`
- that means the out-of-the-box baseline path can still be flaky on fixtures like `fixture-next-ux` unless users opt into a more stable capture command

#### 2. The main remaining product decision is whether the default should become more opinionated

- status: still open
- likely options are:
  - keep the current default and document `captureServer` as the recommended stability path
  - change starter guidance so capture defaults are more production-oriented for frameworks like Next.js
  - add stronger workflow guidance or validation around unstable dev-server capture

### Updated priority order for the current repo

1. Revisit the default baseline workflow and starter guidance for screenshot stability.
2. Decide how strongly Spotter should steer users toward `captureServer` for baseline and changed runs.
3. Continue the release-readiness backlog below after the baseline-default decision is settled.

## Deliverables Created During This Retest

- `fixture-next-ux`
- `fixture-no-routes`
- `SPOTTER_TEST_PLAN_AND_BUGS.md`
- `SPOTTER_UX_FIXTURE_FINDINGS.md`
- `SPOTTER_0_1_3_RETEST.md`


## Future ideas to complete before package is fully ready.

Build a real framework acceptance suite across actual repo shapes.
Done when: CI runs init, scan, generate, baseline, changed, and report successfully on small but realistic fixtures for Next app router, Next pages router, Remix, Nuxt, React Router, Vue Router, and one monorepo with rootDir.

Add first-class state-driving hooks so generated scenarios are executable, not just named correctly.
Done when: users can configure route params, auth state, roles, feature flags, locale, cookies, query params, and seeded data per scenario or per route without hand-editing generated tests.

Make dynamic routes and stateful routes configurable through fixture inputs.
Done when: a repo with /blog/[slug], /products/[id], auth redirects, or feature-gated screens can produce meaningful generated tests using configured sample params and setup data instead of generic placeholders.

Harden determinism guarantees for scan and generate.
Done when: repeated scan and generate runs on unchanged code produce stable JSON ordering, stable filenames, stable scenario IDs, and low-noise diffs across Windows and POSIX.

Add a doctor or validate command for environment readiness.
Done when: one command checks config validity, route adapter detection, Playwright install, browser availability, app URL reachability, dev server command, and required artifact prerequisites, then prints actionable fixes.

Improve scenario quality from “state detected” to “state usefully modeled.”
Done when: generated scenarios consistently distinguish default, loading, empty, error, success, auth gate, role gate, modal, responsive, localization, and feature-flag states in a way that maps to how real teams think about regressions.

Add scale and performance guardrails for medium and large repos.
Done when: Spotter can scan and generate within acceptable time and memory budgets on at least one medium monorepo-sized fixture, and it avoids crawling build outputs, generated folders, and irrelevant directories by default.

Version and validate all artifact schemas.
Done when: route-manifest.json, component-signals.json, component-heuristics.json, scenarios.json, scenario-plan.json, baseline-run.json, changed-run.json, and visual-report.md have stable, documented structure with schema-version handling for upgrades.

Ship framework-specific quickstarts and troubleshooting docs.
Done when: the README and docs include one known-good workflow each for Next, Remix, React Router, Nuxt, and Vue Router, plus explicit guidance for auth, dynamic params, monorepos, seeded data, and CI usage.

Add release-blocking end-to-end tests around truthfulness, not just happy paths.
Done when: CI proves that Spotter correctly distinguishes success, no-route, no-diff, changed-diff, invalid-config, missing-baseline, and runner-failure cases, with correct exit codes and non-misleading artifacts/reports.

Make CI integration a product feature, not just an implied use case.
Done when: you have one documented GitHub Actions example that installs browsers, runs baseline or changed safely, uploads artifacts, and produces a report teams can actually consume in PR workflows.

Define a narrow release bar for “majority of UX repos.”
Done when: you can honestly say “works reliably on standard frontend repos with file-based or declarative routing, basic auth/role branches, dynamic params, and common UI states” and you have fixture evidence to back that claim.