# Spotter Repository Docs Pack

> This file is the original intake brief.
> Canonical working docs now live in `README.md`, `SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `TASKS.md`, `PROMPTS.md`, `CONTRIBUTING.md`, `RELEASE_PLAN.md`, and `AGENTS.md`.

## Overview

**Spotter** is a developer tool that automatically discovers meaningful UX scenarios in a codebase and turns them into visual regression coverage with minimal setup.

Instead of relying entirely on engineers or QA to manually think of every page state, edge case, and rendering mode worth testing, Spotter analyzes the repository, proposes scenario coverage, prioritizes that coverage by likely product risk, and generates Playwright-based screenshot tests that establish a visual baseline for the application.

## Why Spotter Exists

Modern applications contain far more UX states than teams realistically test by hand. Common examples include:

* Loading states
  n- Empty states
* Error states
* Success states
* Validation failures
* Permission differences
* Mobile layouts
* RTL layouts
* Localization text expansion
* Browser zoom changes
* Feature flag variations

These states are often implied by code but never explicitly captured in tests.

Spotter closes that gap by combining deterministic repository analysis with LLM-assisted scenario discovery to identify what should be tested, then producing stable, reviewable visual scenarios that can run locally or in CI.

## How It Works

1. Scan the repository structure.
2. Detect routes, components, forms, conditionals, flags, and likely UX states.
3. Use LLM reasoning to propose scenarios, names, and priorities.
4. Generate Playwright screenshot tests.
5. Capture a baseline of the application's visual states.
6. Re-run relevant scenarios after code changes.
7. Highlight visual diffs and impacted UX areas.

## Core Value Proposition

Spotter helps teams understand the UX impact of code changes.

Rather than manually clicking through flows to figure out what changed, developers get a structured map of impacted UX states grouped by priority so they can quickly determine whether a change was intended, risky, or accidental.

## Product Philosophy

Spotter is **not** "AI writes random tests."

Spotter is:

> Your repo can explain its UX surface area, and Spotter can turn that into dependable visual coverage.

LLMs are used where they add the most value:

* Discovering scenarios
* Naming scenarios clearly
* Suggesting priorities
* Finding missed edge cases

Execution remains deterministic through generated configuration, Playwright tests, fixtures, and committed screenshot baselines.

## Example Commands

```bash
npx spotter scan
npx spotter baseline
npx spotter changed
npx spotter report
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

* React / Next.js teams
* SaaS startups without dedicated QA
* Monorepos with many contributors
* Agencies shipping multiple frontend projects
* Teams wanting confidence in UI changes

## Long-Term Vision

Move teams from:

> We hope we didn't break the UI.

To:

> We know exactly what changed.

---

# Spotter Technical Specification (MVP Build Plan)

## Objective

Build an open-source CLI tool that scans a frontend repository, discovers likely UX scenarios, generates Playwright visual regression tests, captures baselines, and reports diffs after code changes.

Primary target stack:

* Node.js
* TypeScript
* React / Next.js first
* Playwright
* Optional LLM provider support (OpenAI / local models)

---

# System Architecture

## Core Modules

1. CLI Layer
2. Repo Scanner
3. Scenario Engine
4. LLM Planner
5. Test Generator
6. Baseline Runner
7. Diff Engine
8. Impact Analyzer
9. Report Generator
10. Config Layer

---

# Folder Structure

```txt
spotter/
  src/
    cli/
    scanner/
    scenarios/
    llm/
    playwright/
    diff/
    reports/
    config/
    utils/
  templates/
  examples/
  tests/
```

---

# CLI Commands

```bash
spotter init
spotter scan
spotter scenarios
spotter generate
spotter baseline
spotter changed
spotter report
```

---

# Detailed Task Breakdown

## Phase 1: Foundation

### Task 1.1 - Create CLI Shell

Deliverable:

* Commander or yargs CLI
* Basic commands wired
* Help text

Agent Prompt:

```txt
Build a TypeScript CLI using Commander.js named Spotter. Add commands init, scan, generate, baseline, changed, report. Use clean modular structure. Output should compile with tsup.
```

### Task 1.2 - Config Loader

Deliverable:

* Reads spotter.config.ts/json
* Defaults if absent

Agent Prompt:

```txt
Create config loader for Spotter. Support spotter.config.ts and JSON. Provide defaults for screenshots path, viewport list, locale list, test output path.
```

---

## Phase 2: Repo Scanner

### Task 2.1 - Detect Framework

Deliverable:

* Recognize Next.js
* Recognize React Router
* Detect package manager

Agent Prompt:

```txt
Build repo framework detector. Inspect package.json and file structure to determine if repo uses Next.js App Router, Pages Router, Vite React, CRA, or unknown.
```

### Task 2.2 - Route Discovery

Deliverable:

* Extract app routes automatically
  n- Support Next.js app/pages router

Agent Prompt:

```txt
Build route discovery for Next.js projects. Parse app and pages directories. Return clean route list with dynamic params flagged.
```

### Task 2.3 - Component Signals

Deliverable:

Detect indicators:

* loading
  n- error
  n- empty
  n- modal
  n- form
  n- auth gating
  n- role checks

Agent Prompt:

```txt
Use ts-morph or Babel AST to scan React components for conditional branches and common state names such as loading, error, empty, modalOpen, isAdmin. Return structured findings.
```

---

## Phase 3: Scenario Engine

### Task 3.1 - Scenario Model

Create schema:

```ts
interface Scenario {
  id: string
  route: string
  name: string
  priority: 'high' | 'medium' | 'low'
  viewport: string
  locale?: string
  stateRecipe: string[]
}
```

Agent Prompt:

```txt
Design TypeScript schema for Spotter scenarios with route, name, priority, viewport, locale, tags, and execution recipe.
```

### Task 3.2 - Deterministic Scenario Generation

Rules:

* Every route gets default desktop/mobile scenario
* Forms get validation scenario
  n- loading indicators get loading scenario
  n- error indicators get error scenario

Agent Prompt:

```txt
Build deterministic scenario generator from discovered routes and component signals. Generate baseline scenarios before any LLM step.
```

---

## Phase 4: LLM Planner

### Task 4.1 - Scenario Expansion

Use LLM to enhance coverage.

Inputs:

* route list
  n- component signals
  n- snippets of code

Outputs:

* missed scenarios
* better names
* priority suggestions

Agent Prompt:

```txt
Given frontend routes and component state signals, produce missing UX scenarios in JSON only. Include id, name, priority, why, route, and suggested state setup. Avoid duplicates.
```

### Task 4.2 - Stable Output Validation

Deliverable:

* Validate JSON schema
* Deduplicate scenarios
* Limit max count

Agent Prompt:

```txt
Create validator that accepts LLM scenario JSON, validates against schema, removes duplicates, and merges with deterministic scenarios.
```

---

## Phase 5: Playwright Generation

### Task 5.1 - Test File Generator

Deliverable:

Generate tests like:

```ts
test('checkout-empty-cart', async ({ page }) => {
 await page.goto('/checkout')
 await expect(page).toHaveScreenshot()
})
```

Agent Prompt:

```txt
Generate Playwright test files from Spotter scenarios. Use one file per route or grouped folders. Include viewport setup and screenshot assertions.
```

### Task 5.2 - Mock State Recipes

Deliverable:

Support:

* network interception
* auth fixtures
* locale setup
* feature flags

Agent Prompt:

```txt
Build reusable Playwright helpers for mocking API responses, auth state, locale switching, and feature flags from scenario recipes.
```

---

## Phase 6: Baseline + Diff

### Task 6.1 - Baseline Runner

Agent Prompt:

```txt
Create command `spotter baseline` that runs generated Playwright tests and stores baseline screenshots in .spotter/baselines.
```

### Task 6.2 - Diff Reporter

Agent Prompt:

```txt
Create command `spotter changed` that reruns tests, compares screenshots, and outputs pass/fail plus changed image paths.
```

---

## Phase 7: Impact Analyzer

### Task 7.1 - Changed Files Mapping

Inputs:

* git diff files
* route ownership map
* imports graph

Output:

* scenarios likely impacted

Agent Prompt:

```txt
Build analyzer that maps changed files in git diff to impacted routes and scenarios using import graph relationships.
```

---

## Phase 8: Reporting

### Task 8.1 - Markdown Report

Deliverable:

* scenarios run
* passed
* failed
* visual diffs
* grouped by priority

Agent Prompt:

```txt
Generate markdown report for Spotter runs summarizing visual regressions grouped by high, medium, low priority.
```

---

# Example spotter.config.ts

```ts
export default {
  appUrl: 'http://localhost:3000',
  framework: 'nextjs',
  locales: ['en', 'ar', 'de'],
  viewports: ['desktop', 'mobile'],
  llm: {
    provider: 'openai',
    model: 'gpt-5'
  }
}
```

---

# MVP Success Criteria

* Installable with npm
* Works on sample Next.js repo
* Finds routes automatically
* Generates 20+ valid scenarios
* Runs Playwright screenshots
* Detects visual diffs after CSS change
* Markdown report generated

---

# Suggested Build Order

1. CLI
2. Config
3. Route scanning
4. Deterministic scenarios
5. Playwright generation
6. Baseline screenshots
7. Diff output
8. LLM enhancement
9. Git impact analyzer
10. Nice reporting

---

# Immediate First Sprint

## Build these in order:

1. `spotter init`
2. `spotter scan`
3. route detector for Next.js
4. generate simple screenshots for each route desktop/mobile
5. baseline storage
6. changed diff command

Once that works, layer in AI.

---

# README.md

## Spotter

Spotter automatically discovers UX scenarios in your frontend repo and turns them into Playwright visual regression coverage.

### Features

* Auto route discovery
* UX state detection
* Screenshot baselines
* Visual diff reports
* Mobile / locale / RTL coverage
* LLM-assisted scenario discovery

### Quick Start

```bash
npm install -D spotter
npx spotter init
npx spotter scan
npx spotter baseline
npx spotter changed
```

### Philosophy

Most teams do not lack screenshot tooling.
They lack complete scenario coverage.

Spotter solves that.

---

# ROADMAP.md

## v0.1 MVP

* CLI commands
* Next.js route discovery
* Screenshot tests per route
* Baseline screenshots
* Visual diffs

## v0.2

* Scenario priorities
* Forms / loading / error state heuristics
* Better reports

## v0.3

* LLM scenario expansion
* Better naming
* Deduplication

## v0.4

* Git changed-file impact analysis
* Run only impacted scenarios

## v1.0

* Plugin system
* React/Vite support
* CI cloud dashboard optional

---

# TASKS.md

## Sprint 1

* [ ] Setup TypeScript monorepo
* [ ] CLI shell
* [ ] Config loader
* [ ] Logging utility

## Sprint 2

* [ ] Detect Next.js routes
* [ ] Output route manifest JSON
* [ ] Handle dynamic routes

## Sprint 3

* [ ] Generate Playwright tests
* [ ] Desktop/mobile viewports
* [ ] Screenshot assertions

## Sprint 4

* [ ] Baseline command
* [ ] Changed diff command
* [ ] Store artifacts

## Sprint 5

* [ ] AST state scanner
* [ ] loading/error/form heuristics
* [ ] Scenario priority engine

## Sprint 6

* [ ] LLM provider abstraction
* [ ] Scenario enhancer
* [ ] JSON schema validator

---

# ARCHITECTURE.md

## Layers

1. CLI Layer
2. Discovery Layer
3. Scenario Layer
4. Generation Layer
5. Execution Layer
6. Reporting Layer

## Core Principles

* Deterministic first
* AI optional enhancement
* Repo-owned outputs
* CI friendly
* Low config

## Data Flow

```txt
Repo -> Scan -> Signals -> Scenarios -> Tests -> Screenshots -> Diffs -> Reports
```

## Key Tech Choices

* TypeScript
* ts-morph for AST
* Playwright
* Commander.js
* zod for schemas
* optional OpenAI/local LLM providers

---

# AGENTS.md

## Agent Rules

* Keep code modular
* Prefer pure functions
* Add tests for generators
* Avoid hidden magic
* Output readable errors
* Preserve backward compatibility where possible

## Coding Style

* TypeScript strict mode
* Named exports
* Small files
* Clear interfaces

## Definition of Done

* Compiles
* Tests pass
* Docs updated
* Example included

---

# PROMPTS.md

## Build Route Scanner

```txt
Build a TypeScript module that scans Next.js app and pages directories and returns normalized routes. Include dynamic route detection.
```

## Build Scenario Generator

```txt
Generate deterministic scenarios from routes. Each route gets desktop and mobile scenarios. Add priority defaults.
```

## Build Playwright Generator

```txt
Create Playwright test files from scenario JSON. Include screenshot assertions and viewport setup.
```

## Build LLM Enhancer

```txt
Given route list and state signals, propose missing UX scenarios in strict JSON schema. No prose.
```

---

# CONTRIBUTING.md

## Local Dev

```bash
npm install
npm run build
npm run test
npm run dev
```

## Pull Requests

* Keep PRs focused
* Include before/after examples
* Add tests when behavior changes
* Update docs if command behavior changes

---

# RELEASE_PLAN.md

## Launch Strategy

1. Build on sample Next.js repo
2. Record 60 second demo gif
3. Publish npm package
4. Post on Hacker News
5. Post on Reddit webdev / frontend
6. Outreach to engineering teams

## Success Metrics

* GitHub stars
* npm installs
* Repeat usage
* PR mentions
* Community contributors
