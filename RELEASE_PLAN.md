# Release Plan

## Release Checklist

Use this checklist for every npm release.

### 1. Prepare the release

1. Confirm the working tree is clean.
2. Pull the latest `main`.
3. Decide whether the release is `patch`, `minor`, or `major`.

### 2. Validate the package

Run:

```bash
npm install
npm run release:check
```

What this verifies:

* TypeScript compiles cleanly.
* The full Vitest suite passes.
* `dist/` is rebuilt before packaging.
* `npm pack --dry-run` matches the intended publish surface.

### 3. Bump the version

Run one of:

```bash
npm version patch
npm version minor
npm version major
```

This creates the version commit and git tag.

### 4. Push commit and tag

Run:

```bash
git push origin main --follow-tags
```

### 5. Publish to npm

Run:

```bash
npm publish --access public
```

`prepublishOnly` will run typecheck and tests before publish, and `prepack` will rebuild `dist/` before the tarball is created.

### 6. Verify the published package

1. Confirm the new version appears on npm.
2. Verify install works with `npx @dcacheson/spotter@latest --help`.
3. Verify a smoke path such as `npx @dcacheson/spotter@latest init` in a temp directory.

### 7. Announce the release

1. Update any release notes or changelog entry if needed.
2. Post the release in the planned launch channels.

## Launch Strategy

1. Build against a sample Next.js repo
2. Record a 60-second demo GIF
3. Publish the npm package
4. Post on Hacker News
5. Post on relevant frontend communities
6. Reach out to engineering teams for feedback

## Success Metrics

* GitHub stars
* npm installs
* Repeat usage
* Pull request mentions
* Community contributors