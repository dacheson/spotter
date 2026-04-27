# Spotter

Spotter automatically discovers UX scenarios in a frontend codebase and turns them into Playwright visual regression coverage with minimal setup.

## Status

Spotter is designed to run as a local dev dependency or through `npx` after publication.

Today it supports:

* Starter config generation
* Deterministic route discovery adapters for Next.js, Remix, Nuxt, React Router, and Vue Router repositories
* AST-backed UX state scanning
* Deterministic scenario generation
* Playwright screenshot test generation
* Baseline screenshot capture
* Changed-run diff collection
* Markdown report output

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

Current route-discovery support is strongest for frameworks with deterministic route declarations or file-based routing.

- Next.js app router and pages router
- Remix flat-file routes
- Nuxt pages routes
- React Router route config and `<Route path=...>` declarations
- Vue Router route config declarations

When Spotter cannot deterministically infer routes, `spotter scan` and `spotter generate` now say that explicitly. Spotter still scans component UX signals, and route-based scenarios are only generated from deterministic adapters or an explicitly supplied LLM fallback provider.

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
npm install -D @dcacheson/spotter @playwright/test
npx playwright install
npx spotter init
npx spotter scan
npx spotter prompt
npx spotter import --input .spotter/artifacts/manual-response.json
npx spotter override --exclude-id checkout-loading-state
npx spotter generate
npx spotter baseline
npx spotter changed
npx spotter report
```

## Developer Workflow

```bash
spotter init
spotter scan
spotter prompt
spotter import --input .spotter/artifacts/manual-response.json
spotter override --exclude-id checkout-loading-state
spotter generate
spotter baseline
spotter changed
spotter report
```

What a regular developer does:

1. Run `spotter init` once to create `spotter.config.json`.
2. Adjust `appUrl` or `devServer` if the app does not run on the defaults.
3. Run `spotter scan` to discover routes and UI-state signals.
4. Run `spotter prompt` when you want a copy-pasteable IDE prompt for manual scenario suggestions.
5. Paste the prompt into your IDE agent and save its JSON response.
6. Run `spotter import --input <path>` to merge reviewed suggestions and regenerate tests.
7. Run `spotter override ...` when you need a quick durable include or exclude correction written into config.
8. Run `spotter baseline` to capture snapshot baselines.
9. After code changes, run `spotter changed` and then `spotter report`.

The CLI now supports starter config generation, deterministic repository scanning, deterministic Playwright test generation, baseline capture, changed-run comparison, and artifact-backed reporting.

## Install Modes

Install into a project:

```bash
npm install -D @dcacheson/spotter @playwright/test
```

Run with `npx` after install:

```bash
npx spotter scan
```

After the package is published to npm, users can also run it without pre-installing it:

```bash
npx @dcacheson/spotter@latest init
```

## Configuration

Spotter looks for `spotter.config.ts` or `spotter.config.json` in the current working directory. If no config file exists, it falls back to built-in defaults for screenshots, generated tests, viewports, and locales.

The default starter config includes:

* `appUrl: "http://127.0.0.1:3000"`
* `devServer.command: "npm run dev"`
* `devServer.reuseExistingServer: true`
* `devServer.timeoutMs: 120000`
* optional `captureServer` override for baseline and changed runs
* `llm.fallback: null`

Generated Playwright test files are written to the configured `testsDir` path, which defaults to `.spotter/tests`.

Scenario plans expand across the configured viewport list, which defaults to both `desktop` and `mobile`.

Generated tests use deterministic screenshot assertions with disabled animations, hidden carets, CSS scaling, and full-page captures.

`spotter baseline` runs `playwright test --update-snapshots` against the generated tests and stores baseline screenshots in the configured `screenshotsDir`, which defaults to `.spotter/baselines`.

That generated Playwright config now also injects `use.baseURL` from `appUrl` and an optional `webServer` block. By default, baseline and changed inherit `devServer`, but they can now use a separate `captureServer` override when screenshot capture needs a more stable production-style command.

`spotter changed` reruns the generated tests against those baselines and reports any changed image paths found in the Playwright results output.

When a changed file maps cleanly to a known route, Spotter narrows the run to trusted impacted scenarios. When a shared component change is only partially attributable, Spotter now records a bounded `Possible Additional Impact` set in the manifest summary instead of immediately falling back to a full generated-suite run.

Both commands also persist their latest run metadata as JSON artifacts in the configured `artifactsDir`.

The scanner can now walk TS, TSX, JS, JSX, and Vue single-file components and extract deterministic state signals such as loading, error, empty, modal, form, auth, and role checks.

Those findings now feed deterministic loading, error, and form heuristics with scenario tags and recipe hints for the scenario layer.

The `scan` command writes route, signal, heuristic, and summary artifacts into the configured `artifactsDir` so later steps can stay reviewable in git.

When no deterministic routes are found, the scan summary now also records the inferred framework and the CLI surfaces a warning instead of silently producing an empty route inventory.

Scenario priorities are now assigned deterministically from route metadata, tags, heuristics, and auth or role signals.

The `generate` command turns the current route and state scan into deterministic scenarios, expands them across configured locales and viewports, writes the generated Playwright tests, and stores scenario artifacts alongside the scan output.

The `prompt` command writes a manual-assist prompt and a structured context artifact so developers can paste the current coverage snapshot into an IDE agent chat and ask for additional scenario ideas without wiring a live provider into Spotter.

The `import` command reads a reviewed JSON response from that prompt flow, validates it against Spotter's scenario schema, merges it with deterministic scenarios, reprioritizes the combined set, and regenerates the scenario artifacts and Playwright tests.

Scenario correction is config-first. `overrides.scenarios.exclude` removes known-noisy scenarios by `id`, `name`, or `routePath`, and `overrides.scenarios.include` adds durable hand-authored scenarios that Spotter should keep generating in future runs.

The `override` command is a convenience layer on top of that config. Today it supports the common fast-fix paths:

* `spotter override --exclude-id <scenario-id>`
* `spotter override --include-id <scenario-id> --route <path> --name <label> --priority <high|medium|low> --tag <tag>`

`spotter override` currently writes JSON config files only. If your repo uses `spotter.config.ts`, Spotter will stop and ask you to make the equivalent edit manually so the correction remains explicit.

If deterministic route discovery returns no routes, the default generate flow now says that clearly. Users can now enable an LLM fallback through `spotter.config.*` or per-run `spotter generate` flags so Spotter can infer scenarios from scanned UX signals when deterministic adapters are insufficient.

The LLM layer now exposes a provider abstraction with a deterministic mock provider and an invoker-based adapter surface for OpenAI-compatible remote or local model integrations.

Provider responses are now JSON-schema validated before Spotter accepts them, and the enhancer deduplicates LLM suggestions against deterministic scenarios while capping how many generated additions are merged in.

The scenario enhancer now routes the validated merged scenario set back through the deterministic priority engine so suggested scenarios come back normalized against the known route and signal context.

The `generate` command now accepts `--llm-fallback`, `--llm-provider`, `--llm-model`, `--llm-base-url`, `--llm-api-key-env`, `--llm-instructions`, and `--llm-max-generated-scenarios` so teams can opt into fallback inference without changing code.

The `report` command reads the latest changed-run artifact, generated scenario inventory, and scenario plan to render a manifest-first summary of trusted scenarios before the raw diff list, then writes a Markdown report to `artifactsDir/visual-report.md` by default.

That manifest summary can now separate fully trusted route matches from lower-confidence `Possible Additional Impact` scenarios caused by shared component changes, while still keeping the execution set bounded and reviewable.

## Generated Output

Spotter writes its working output into the repository so it can be reviewed in git:

* `.spotter/tests` for generated Playwright specs
* `.spotter/baselines` for screenshot baselines
* `.spotter/artifacts/route-manifest.json`
* `.spotter/artifacts/component-signals.json`
* `.spotter/artifacts/component-heuristics.json`
* `.spotter/artifacts/scenarios.json`
* `.spotter/artifacts/scenario-plan.json`
* `.spotter/artifacts/scenario-assist.prompt.md`
* `.spotter/artifacts/scenario-assist.context.json`
* `.spotter/artifacts/scenario-import.json`
* `.spotter/artifacts/changed-run.json`
* `.spotter/artifacts/visual-report.md`

## Example Config

```json
{
	"appUrl": "http://127.0.0.1:3000",
	"devServer": {
		"command": "npm run dev",
		"reuseExistingServer": true,
		"timeoutMs": 120000
	},
	"llm": {
		"fallback": null
	},
	"overrides": {
		"scenarios": {
			"exclude": {
				"ids": [],
				"names": [],
				"routePaths": []
			},
			"include": []
		}
	},
	"rootDir": ".",
	"locales": [
		{
			"code": "en-US",
			"label": "English (US)",
			"rtl": false
		}
	],
	"viewports": [
		{
			"name": "desktop",
			"width": 1440,
			"height": 900
		},
		{
			"name": "mobile",
			"width": 390,
			"height": 844
		}
	],
	"paths": {
		"artifactsDir": ".spotter/artifacts",
		"screenshotsDir": ".spotter/baselines",
		"testsDir": ".spotter/tests"
	}
}
```

Example override:

```json
{
	"overrides": {
		"scenarios": {
			"exclude": {
				"ids": ["checkout-loading-state"]
			},
			"include": [
				{
					"id": "checkout-empty-state-manual",
					"routePath": "/checkout",
					"name": "Checkout Empty State",
					"priority": "medium",
					"tags": ["checkout", "empty"]
				}
			]
		}
	}
}
```

Equivalent CLI examples:

```bash
spotter override --exclude-id checkout-loading-state
spotter override --include-id checkout-empty-state-manual --route /checkout --name "Checkout Empty State" --priority medium --tag checkout --tag empty
```

If you want Spotter to assume the app is already running, disable automatic startup:

```json
{
	"appUrl": "http://127.0.0.1:3000",
	"devServer": null
}
```

If your normal local workflow uses a dev server but visual capture is more stable against a production-style server, configure a separate capture command:

```json
{
	"appUrl": "http://127.0.0.1:3000",
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

When `captureServer` is set, `spotter baseline` and `spotter changed` use it instead of `devServer`. When it is omitted, they keep using `devServer` for backward compatibility.

If you want `generate` to fall back to an LLM when deterministic route adapters find no routes, configure it explicitly:

```json
{
	"llm": {
		"fallback": {
			"enabled": true,
			"provider": "local",
			"model": "llama3.1",
			"baseUrl": "http://127.0.0.1:11434/v1",
			"instructions": "Prefer scenarios implied by explicit empty, loading, and auth states.",
			"maxGeneratedScenarios": 4
		}
	}
}
```

You can also override those settings for one run with `spotter generate --llm-fallback --llm-provider openai --llm-model gpt-5.4` and the related `--llm-*` flags.

## Publishing

The package is already structured for npm distribution:

* `package.json` exposes the CLI through the `bin` field
* `tsup` builds `dist/cli.js` and `dist/index.js`
* the public API is exported from `src/index.ts`

To publish it, the remaining operational steps are:

1. Run `npm login`.
2. Bump the version in `package.json`.
3. Run `npm run typecheck`, `npm test`, and `npm run build`.
4. Publish with `npm publish --access public`.
5. Verify with `npx @dcacheson/spotter@latest --help`.

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

* Teams using Next.js, Remix, Nuxt, React Router, or Vue Router
* SaaS startups without dedicated QA
* Monorepos with many contributors
* Agencies shipping multiple frontend projects
* Teams that want confidence in UI changes

## Vision

Move teams from:

> We hope we didn't break the UI.

To:

> We know exactly what changed.