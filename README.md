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
spotter scenarios
spotter generate
spotter baseline
spotter changed
spotter report
```

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