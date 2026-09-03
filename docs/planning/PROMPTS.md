# Prompts

## Create CLI Shell

```txt
Build a TypeScript CLI using Commander.js named Spotter. Add commands init, scan, generate, baseline, changed, report. Use clean modular structure. Output should compile with tsup.
```

## Create Config Loader

```txt
Create config loader for Spotter. Support spotter.config.ts and JSON. Provide defaults for screenshots path, viewport list, locale list, test output path.
```

## Detect Framework

```txt
Build repo framework detector. Inspect package.json and file structure to determine if repo uses Next.js App Router, Pages Router, Vite React, CRA, or unknown.
```

## Build Route Scanner

```txt
Build a TypeScript module that scans Next.js app and pages directories and returns normalized routes. Include dynamic route detection.
```

## Build Component Signal Scanner

```txt
Use ts-morph or Babel AST to scan React components for conditional branches and common state names such as loading, error, empty, modalOpen, isAdmin. Return structured findings.
```

## Build Scenario Schema

```txt
Design TypeScript schema for Spotter scenarios with route, name, priority, viewport, locale, tags, and execution recipe.
```

## Build Deterministic Scenario Generator

```txt
Build deterministic scenario generator from discovered routes and component signals. Generate baseline scenarios before any LLM step.
```

## Build LLM Scenario Expansion

```txt
Given frontend routes and component state signals, produce missing UX scenarios in JSON only. Include id, name, priority, why, route, and suggested state setup. Avoid duplicates.
```

## Build LLM Output Validation

```txt
Create validator that accepts LLM scenario JSON, validates against schema, removes duplicates, and merges with deterministic scenarios.
```

## Build Playwright Generator

```txt
Generate Playwright test files from Spotter scenarios. Use one file per route or grouped folders. Include viewport setup and screenshot assertions.
```

## Build Mock State Recipes

```txt
Build reusable Playwright helpers for mocking API responses, auth state, locale switching, and feature flags from scenario recipes.
```

## Build Baseline Runner

```txt
Create command `spotter baseline` that runs generated Playwright tests and stores baseline screenshots in .spotter/baselines.
```

## Build Diff Reporter

```txt
Create command `spotter changed` that reruns tests, compares screenshots, and outputs pass or fail plus changed image paths.
```

## Build Impact Analyzer

```txt
Build analyzer that maps changed files in git diff to impacted routes and scenarios using import graph relationships.
```

## Build Markdown Report

```txt
Generate markdown report for Spotter runs summarizing visual regressions grouped by high, medium, low priority.
```