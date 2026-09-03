# Configuration

Spotter looks for `spotter.config.ts` or `spotter.config.json` in the working directory. With no
config file it falls back to built-in defaults, so `spotter scan` works on a fresh checkout.

`spotter init` writes the starter config below.

## Full example

```json
{
  "appUrl": "http://127.0.0.1:3000",
  "devServer": {
    "command": "npm run dev",
    "reuseExistingServer": true,
    "timeoutMs": 120000
  },
  "llm": { "fallback": null },
  "overrides": {
    "scenarios": {
      "exclude": { "ids": [], "names": [], "routePaths": [] },
      "include": []
    }
  },
  "rootDir": ".",
  "locales": [
    { "code": "en-US", "label": "English (US)", "rtl": false }
  ],
  "viewports": [
    { "name": "desktop", "width": 1440, "height": 900 },
    { "name": "mobile", "width": 390, "height": 844 }
  ],
  "paths": {
    "artifactsDir": ".spotter/artifacts",
    "screenshotsDir": ".spotter/baselines",
    "testsDir": ".spotter/tests"
  }
}
```

Scenario plans expand across every configured viewport and locale, so each entry multiplies the
number of generated specs.

## Servers

If the app is already running, turn automatic startup off:

```json
{ "appUrl": "http://127.0.0.1:3000", "devServer": null }
```

If your day-to-day server is a dev server but screenshots are more stable against a
production-style build, give capture its own command:

```json
{
  "devServer": { "command": "npm run dev", "reuseExistingServer": true, "timeoutMs": 120000 },
  "captureServer": { "command": "npm run start", "reuseExistingServer": true, "timeoutMs": 120000 }
}
```

`spotter baseline` and `spotter changed` use `captureServer` when it is set and fall back to
`devServer` when it is not.

## Scenario overrides

Correction is config-first: overrides live in the repository and are reviewable in git.

```json
{
  "overrides": {
    "scenarios": {
      "exclude": { "ids": ["checkout-loading-state"] },
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

`exclude` matches on `id`, `name` or `routePath`. `include` adds hand-authored scenarios that
Spotter keeps generating on later runs. Overrides stay marked as such in the manifest's
provenance, so the report never presents a human decision as an inference.

The `override` command is a convenience layer that writes the same config:

```bash
spotter override --exclude-id checkout-loading-state
spotter override --include-id checkout-empty-state-manual --route /checkout \
  --name "Checkout Empty State" --priority medium --tag checkout --tag empty
```

It writes JSON config only. If your repository uses `spotter.config.ts`, Spotter stops and asks
you to make the equivalent edit by hand so the correction stays explicit.

## LLM fallback

Off by default. When deterministic adapters find no routes, Spotter says so rather than
inventing coverage. Opt in explicitly:

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

Provider responses are JSON-schema validated before Spotter accepts them, deduplicated against
the deterministic set, capped by `maxGeneratedScenarios`, and routed back through the
deterministic priority engine so suggestions come back normalised rather than self-scored.

Per-run equivalents: `--llm-fallback`, `--llm-provider`, `--llm-model`, `--llm-base-url`,
`--llm-api-key-env`, `--llm-instructions`, `--llm-max-generated-scenarios`.
