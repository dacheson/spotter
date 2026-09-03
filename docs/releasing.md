# Releasing

Spotter publishes to npm as [`@dcacheson/spotter`](https://www.npmjs.com/package/@dcacheson/spotter).

The package is built by `tsup`: `package.json` exposes the CLI through `bin`, and the public API
is exported from `src/index.ts`. `prepack` builds, and `prepublishOnly` runs typecheck and tests,
so a broken build cannot be published.

```bash
npm run release:check     # typecheck, test, build, pack --dry-run
```

To cut a release:

1. `npm login`
2. Bump `version` in `package.json`
3. `npm run release:check`
4. `npm publish --access public`
5. `npx @dcacheson/spotter@latest --help` to verify the published artifact
