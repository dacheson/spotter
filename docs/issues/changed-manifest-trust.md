# Issue: Changed Manifest Trust Vertical Slice

## Problem

`spotter changed` and `spotter report` currently surface diff outcomes, but they do not yet provide a manifest-first trust artifact that explains why scenarios were selected, what is trusted, what is uncertain, and how a user can correct misses quickly.

This creates the exact failure mode we want to eliminate first: output that can look authoritative while leaving the reviewer unclear about why something was selected, skipped, or missing.

## Goal

Ship a vertical slice centered on changed manifest trust rather than broad platform expansion.

The slice should prove one trustworthy loop from changed files to human-readable intent to executable checks.

## Scope

This issue covers the first trust slice for `changed`:

1. manifest summary UX
2. impact selection
3. correction workflow immediately after

This first implementation step should land the manifest summary UX and make it the primary trust artifact exposed by the report flow.

## Acceptance Criteria

- `changed` selects a meaningfully smaller scenario set than full runs.
- The manifest summary shows provenance for every selected scenario.
- Low-confidence and skipped items are separated and explained.
- Empty results are explicit and corrective.
- Users can fix obvious misses with small config edits.
- Generated tests are validated against the manifest and drift is detectable.

## First Hard Acceptance Test

Create a changed-file scenario where Spotter:

1. selects a smaller trusted set than a full run
2. explains every trusted selection
3. separates uncertainty from trusted output
4. provides a cheap correction path when it misses one obvious case

## Non-Goals

- Expanding framework coverage before the trust loop is proven
- Broad plugin API stabilization
- Broad scenario expansion across all locales, viewports, and speculative states by default
- Hiding uncertainty behind authoritative labels

## Implementation Notes

- The scenario manifest summary is the first trust artifact a skeptical engineer should open.
- Manifest rows should show the minimum decision set:
  - route or screen identity
  - scenario or state name
  - why it was included
  - confidence level
  - source or provenance
  - execution scope summary
  - correction hint if relevant
- Scenario names should describe user-visible state, not implementation mechanism.
- Canonical scenarios should merge duplicate user-visible states and aggregate provenance.
- Manual overrides must remain visibly marked in provenance.

## Done When

- `spotter report` renders a manifest-first summary before raw diff details.
- Trusted and uncertain output are clearly separated.
- Empty results remain useful by explaining what was searched, what was not found, and how to correct it.
- The first acceptance test encodes the trust contract as an end-to-end product test.