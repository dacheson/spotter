# Spotter Plan Decisions

This file records the product and roadmap decisions confirmed during the grill-me session so they can be reused in roadmap, README, task planning, and future design discussions.

## Current Product Direction

- Product thesis: hybrid with a hard deterministic core.
- Core positioning: Spotter is the best deterministic visual-regression generator for modern frontend apps, starting with Next.js and React/Vite, with config and plugin escape hatches for everything else.
- LLM role: optional enhancement after deterministic analysis, never the trust foundation.

## First User Win

- In under 15 minutes, a user should be able to point Spotter at a Next.js or React/Vite app, run one command, and get a small but credible set of generated visual tests plus a readable summary of what was discovered and what was skipped.
- The first win should optimize for credible coverage and clear reasoning, not maximum breadth.

## v1 Non-Goals

- Perfect support for non-file-based routing.
- Automatic auth and session handling for arbitrary apps.
- Deep feature-flag and experiment-state inference.
- Hosted dashboard or cloud product.
- Zero-config support for every repo.

## Product Framing

- Primary product sold: change-confidence.
- Generated tests and scenario discovery are mechanisms, not the product story.
- Roadmap bias should favor git-aware impact analysis, trustworthy summaries, stable baselines, and low-noise diffs over broad but weak scenario expansion.

## Users and Buyers

- First buyer: engineering lead or staff/principal frontend engineer who wants safer UI changes in CI.
- Primary daily user: feature engineer opening and reviewing pull requests.
- When roadmap priorities conflict in v1, the daily user's pain should win slightly more often, as long as the buyer still gets clear team-level confidence signals.

## Operating Mode

- Default mode: both local and CI matter, but local is primary.
- Trust should be earned locally first, then cashed in through CI adoption.
- Local commands must be simple and readable, and their outputs should already resemble CI-grade artifacts.

## Truth and Trust Model

Truth precedence:

1. User config and overrides.
2. Framework adapter truth.
3. Deterministic scanner heuristics.
4. LLM-added suggestions, clearly labeled as suggested rather than trusted.

Implications:

- Every discovered scenario should expose provenance.
- Skips should be explained where practical.
- Overrides should be local, explicit, and reviewable in git.
- LLM output should remain visibly separate from deterministic output.

## Config Strategy

- v1 config should stay intentionally small and explicit.
- The config surface should primarily handle:
	- including routes or scenarios Spotter missed
	- excluding noisy routes or scenarios
	- declaring app-specific states or fixtures Spotter cannot infer
	- overriding confidence or provenance classification where needed
- Avoid a large DSL in v1. Prefer a small, reviewable schema over a powerful but open-ended authoring system.
- v1 recovery priority when Spotter is wrong: faster correction first, then better explanation, then better auto-detection.
- Override UX should support both hand-editable config and interactive CLI fixup, with the config file as the primary durable source of truth and the CLI acting as a convenience layer that writes normal config changes.

## Changed Run Quality Bar

- A changed run is CI-worthy only when it is selective, explainable, and low-noise.
- Every included scenario should have provenance tied to changed files, affected routes, affected state signals, or explicit config.
- Low-confidence expansions should be opt-in or clearly separated.
- "No impacted scenarios found" should be treated as a valid outcome.
- False positives are more damaging than missing a few edge scenarios in v1.
- Provisional merge-gating bar:
	- Changed runs should usually touch a meaningfully smaller subset than the full scenario set.
	- Every selected scenario should expose clear provenance in the report.
	- Baseline churn and speculative inference noise should be low enough that teams do not habitually rerun, mute, or bypass the result.
- Low-confidence changed cases should be excluded from the trusted set by default and shown separately rather than blended into merge-gating output.

	## Empty Results Policy

	- Finding nothing should be treated as a first-class explained outcome, not a silent failure and not a trigger to invent coverage.
	- Empty results should clearly state:
		- what Spotter searched
		- what was not found
		- likely reasons or limitations
		- the fastest correction path for the user
	- Honest emptiness is preferable to speculative over-expansion.

## Success Metric

- Core metric: trusted PR decisions influenced by Spotter.
- Useful proxy: the number of PRs where Spotter output was actually reviewed and materially affected confidence or action without being treated as noise.

## Planning Guardrails


## Stable v1 Contracts

	1. scenario manifest shape
	2. provenance and confidence model
	3. config override contract

## Review Artifacts

- Users should review both generated manifests and generated tests, but with different roles.
- The manifest is the primary git-reviewed artifact for trust, provenance, confidence, and override reasoning.
- Generated tests are the secondary review artifact and primary execution artifact.
- For change-confidence, the manifest should act as the human-readable contract and the tests should remain derived machinery.
- The manifest should be the source of truth.
- Generated tests should be treated as stale derived artifacts when they drift from the manifest and should be regenerated or rejected.
- The scenario manifest summary should be the first trust artifact a skeptical engineer opens.

## Report Priorities

- Default reports should optimize for speed to comprehension first, with auditability close behind.
- Completeness should never be allowed to bury the answer.
- The default report should answer in this order:
	1. what Spotter checked
	2. why those scenarios were selected
	3. what regressed or stayed clean
	4. what was skipped or uncertain
	5. how the user can correct it
- Low-confidence items should use honest bounded labels such as `Possible Additional Impact` or `Needs Review`, not labels that imply the same trust level as the core detected set.
- Scenarios that cannot explain themselves clearly enough should be downgraded out of the trusted set until they satisfy the minimum explanation bar.

## Manifest Summary Default Row

- Each scenario row in the manifest summary should show the minimum decision set:
	1. route or screen identity
	2. scenario or state name
	3. why it was included
	4. confidence level
	5. source or provenance
	6. execution scope summary
	7. correction hint if relevant
- The scenario row should be designed as a PR decision object, not a debug record.

## Scenario Naming Rule

- Scenario names should describe user-visible state, not implementation mechanism.
- Favor stable behavior-oriented names such as `empty-cart`, `validation-error`, `logged-out`, `loading`, and `modal-open`.
- Avoid implementation-leaking names tied to hooks, library internals, branch numbering, or transient code structure.

## Scenario Deduplication Rule

- When multiple signals imply the same user-visible scenario, merge them into one canonical scenario.
- The canonical row should aggregate provenance rather than creating near-duplicate scenario rows.
- Prefer one stable scenario name with richer evidence over multiple competing rows for the same visible state.

## Confidence Handling For Canonical Scenarios

- Canonical scenario rows should show one bounded confidence summary by default.
- Use the highest trustworthy confidence justified by deterministic evidence.
- Speculative or low-confidence evidence must not inflate the row confidence.
- Mixed evidence should be preserved in expanded provenance details rather than by splitting the scenario into multiple rows.

## Correction Loop Bar

- The default correction loop should feel like a 2-minute fix, not a research project.
- A good correction loop should provide:
	1. an obvious reason a scenario was included
	2. a clear correction hint or config target
	3. one small config edit or CLI-assisted change
	4. a deterministic re-run
	5. visibly improved manifest output

## Override Provenance Rule

- Manual overrides should remain visibly marked in the manifest rather than disappearing into normal inferred output.
- When human judgment changes inclusion, exclusion, or classification, the manifest should preserve that fact in provenance.
- The trust artifact should not pretend the tool inferred something that was actually established by explicit user correction.

## Default Coverage Expansion

- v1 should start narrow by default and let users expand deliberately.
- Default output should avoid scenario explosion across viewports, locales, and states.
- Recommended defaults:
	- one primary viewport
	- one primary locale
	- only the strongest deterministic state scenarios
- Extra viewports, locales, and state expansions should be explicit opt-ins.
- Reports should explain what was not expanded and how users can enable broader coverage.

## Adoption Path

- Preferred rollout path: single developer proof, then one-team pilot, then broader rollout.
- One motivated developer proving local value is necessary but not sufficient.
- A one-team pilot is the real trust test because it exposes repeated PR usage, multiple engineers, and real tolerance for noise.
- Broader rollout should only happen after a team keeps Spotter on long enough to prove it changes behavior rather than just impressing in a demo.

## Trust-Protecting Defaults

- Spotter should be willing to say no in order to protect trust.
- It should refuse false confidence in three places:
	1. unsupported frameworks should not pretend to be supported
	2. weak signals should not pretend to be trusted detections
	3. expensive expansions should stay opt-in
- Unsupported cases should point users to the fastest correction or config path instead of papering over the limitation.

## Scope Pressure Rule

- If the roadmap gets too wide, cut additional framework coverage first.
- Protect depth in the existing trust model before expanding breadth.
- Keep investing in changed-run trustworthiness, correction UX, manifest clarity, report quality, and React/Vite first-class quality ahead of adding more framework adapters.

## Product Promise

- Front-page promise:
	- Spotter helps frontend teams trust UI changes by generating reviewable scenario manifests and focused visual checks from real app structure, with clear explanations and fast correction when inference is incomplete.

## Failure Mode To Eliminate First

- Highest-priority failure mode to eliminate:
	- Spotter produces output that looks authoritative but leaves the user unclear about why something was selected, skipped, or missing.
- This means v1 should aggressively prevent:
	- silent skips
	- unexplained empty results
	- selected scenarios without provenance
	- low-confidence results blended into trusted output
	- unclear correction paths

## Next Concrete Roadmap Slice

- The next real roadmap slice should be a vertical slice centered on `changed` manifest trust, not a broad platform slice.
- That slice should prove one trustworthy loop from changed files to human-readable intent to executable checks.
- Internal delivery order for the slice:
	1. manifest summary UX
	2. impact selection
	3. correction workflow immediately after
- First hard acceptance test for the slice:
	- a changed-file scenario where Spotter selects a smaller trusted set, explains every trusted selection, separates uncertainty, and gives a cheap correction path when it misses one obvious case
- Success conditions for the slice:
	1. `changed` selects a meaningfully smaller scenario set than full runs
	2. the manifest summary shows provenance for every selected scenario
	3. low-confidence and skipped items are separated and explained
	4. empty results are explicit and corrective
	5. users can fix obvious misses with small config edits
	6. generated tests are validated against the manifest and drift is detectable

## Near-Term Roadmap Direction


## Open Questions

- What exact config surface should users edit when Spotter inference is wrong or incomplete?
- Which milestone should introduce plugins, and what must stay stable before that happens?
- What should the first React/Vite first-class experience look like relative to current Next.js support?