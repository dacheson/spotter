# Example Fixtures

These fixture repos are small, deterministic workspaces for manually validating Spotter behavior across supported and unsupported frontend stacks.

- `fixture-next-ux`: Next.js app-router fixture with dynamic routes, route groups, parallel routes, and common UX state branches.
- `fixture-react-vite`: React + Vite fixture used to verify non-Next degradation and signal scanning in plain TSX apps.
- `fixture-vue-vite`: Vue + Vite fixture used to verify Vue single-file components contribute deterministic UX signals even without route discovery.

These fixtures are also exercised by `tests/example-fixtures.test.ts`.