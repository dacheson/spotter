# Spotter Technical Specification

## Objective

Build an open-source CLI tool that scans a frontend repository, discovers likely UX scenarios, generates Playwright visual regression tests, captures baselines, and reports diffs after code changes.

Primary target stack:

* Node.js
* TypeScript
* React and Next.js first
* Playwright
* Optional LLM provider support

## System Modules

1. CLI layer
2. Repo scanner
3. Scenario engine
4. LLM planner
5. Test generator
6. Baseline runner
7. Diff engine
8. Impact analyzer
9. Report generator
10. Config layer

## Proposed Folder Structure

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

## CLI Surface

```bash
spotter init
spotter scan
spotter scenarios
spotter generate
spotter baseline
spotter changed
spotter report
```

## Scenario Model

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

## Example Config

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

## MVP Success Criteria

* Installable with npm
* Works on a sample Next.js repo
* Finds routes automatically
* Generates at least 20 valid scenarios
* Runs Playwright screenshots
* Detects visual diffs after a CSS change
* Generates a Markdown report

## Suggested Build Order

1. CLI
2. Config
3. Route scanning
4. Deterministic scenarios
5. Playwright generation
6. Baseline screenshots
7. Diff output
8. LLM enhancement
9. Git impact analyzer
10. Reporting

## Immediate First Sprint

1. Build `spotter init`
2. Build `spotter scan`
3. Add a Next.js route detector
4. Generate desktop and mobile screenshots for each route
5. Store baselines
6. Implement the changed diff command