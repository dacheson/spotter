# Spotter

Spotter automatically discovers UX scenarios in a frontend codebase and turns them into Playwright visual regression coverage with minimal setup.

## Why Spotter Exists

Modern applications contain more UI states than teams realistically test by hand. Important states are often implied by code but never captured in regression coverage.

Common gaps include:

* Loading states
* Empty states
* Error states
* Success states
* Validation failures
* Permission differences
* Mobile layouts
* RTL layouts
* Localization text expansion
* Feature flag variations

Spotter closes that gap by combining deterministic repository analysis with optional LLM-assisted scenario discovery. The result is stable, reviewable visual coverage that can run locally or in CI.

## How It Works

1. Scan the repository structure.
2. Detect routes, components, forms, conditionals, flags, and likely UX states.
3. Propose scenario coverage and priorities.
4. Generate Playwright screenshot tests.
5. Capture baseline screenshots.
6. Re-run relevant scenarios after code changes.
7. Highlight visual diffs and impacted UX areas.

## Core Value

Spotter helps teams understand the UX impact of code changes.

Instead of manually clicking through flows to figure out what changed, developers get a structured map of impacted UX states grouped by priority so they can quickly determine whether a change was intended, risky, or accidental.

## Features

* Auto route discovery
* UX state detection
* Screenshot baselines
* Visual diff reports
* Mobile, locale, and RTL coverage
* LLM-assisted scenario discovery

## Philosophy

Spotter is not AI generating arbitrary tests.

Spotter treats the repository as the source of truth for the application's UX surface area, then turns that signal into dependable visual coverage.

LLMs are used for:

* Discovering scenarios
* Naming scenarios clearly
* Suggesting priorities
* Finding missed edge cases

Execution remains deterministic through generated configuration, Playwright tests, fixtures, and committed screenshot baselines.

## Quick Start

```bash
npm install -D spotter
npx spotter init
npx spotter scan
npx spotter baseline
npx spotter changed
```

## Planned CLI Commands

```bash
spotter init
spotter scan
spotter generate
spotter baseline
spotter changed
spotter report
```

The CLI shell is wired with Commander.js and currently exposes the baseline command surface with placeholder handlers while the underlying features are built incrementally.

## Configuration

Spotter looks for `spotter.config.ts` or `spotter.config.json` in the current working directory. If no config file exists, it falls back to built-in defaults for screenshots, generated tests, viewports, and locales.

Generated Playwright test files are written to the configured `testsDir` path, which defaults to `.spotter/tests`.

Scenario plans expand across the configured viewport list, which defaults to both `desktop` and `mobile`.

Generated tests use deterministic screenshot assertions with disabled animations, hidden carets, CSS scaling, and full-page captures.

`spotter baseline` runs `playwright test --update-snapshots` against the generated tests and stores baseline screenshots in the configured `screenshotsDir`, which defaults to `.spotter/baselines`.

`spotter changed` reruns the generated tests against those baselines and reports any changed image paths found in the Playwright results output.

Both commands also persist their latest run metadata as JSON artifacts in the configured `artifactsDir`.

The scanner can now walk TS, TSX, JS, and JSX source files and extract AST-backed state signals such as loading, error, empty, modal, form, auth, and role checks.

Those findings now feed deterministic loading, error, and form heuristics with scenario tags and recipe hints for the scenario layer.

## Example Output

```txt
42 High Priority Scenarios
67 Medium Priority Scenarios
29 Low Priority Scenarios

Impacted by current PR:
- Checkout Empty Cart
- Checkout Payment Failure
- Mobile Nav Logged Out
```

## Ideal Users

* React and Next.js teams
* SaaS startups without dedicated QA
* Monorepos with many contributors
* Agencies shipping multiple frontend projects
* Teams that want confidence in UI changes

## Vision

Move teams from:

> We hope we didn't break the UI.

To:

> We know exactly what changed.