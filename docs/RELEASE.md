# Vinculivo — Preview release & registry governance

This file documents the exact publication contract. `publish.yml` is intentionally only triggered by `push` to `main` or a confirmed manual `workflow_dispatch`. PRs use `ci.yml` for Ubuntu/Windows/macOS checks and a **single** Linux-built VSIX artifact.

## Required GitHub configuration

1. Keep protected `main` with mandatory PR and **all three** PR checks: `Verify (ubuntu-latest)`, `Verify (windows-latest)`, `Verify (macos-latest)`. Keep squash merge enabled. No forced/admin bypass for ordinary releases.
2. Create GitHub environments `marketplace` and `open-vsx` (exact lowercase spelling). Allow deployment **only from `main`**. Do not require a second human reviewer for a solo-maintainer repo, but protect environment access.
3. Marketplace: create the trusted publisher policy on `armotusitio` for repository `Drako01/vinculivo`, workflow **`publish.yml`**, environment **`marketplace`**. The policy shown in Marketplace needs to match this exact combination. No stored `VSCE_PAT`.
4. Open VSX: bootstrap the extension/namespace with a one-time manual PAT upload if it has never been published. After a first successful publication, configure an Open VSX trusted publisher for `Drako01/vinculivo`, workflow `publish.yml`, environment `open-vsx`. Do not store an ongoing `OVSX_PAT` after switching to OIDC.
5. Keep `v*` release tags protected. Only the release job creates the GitHub prerelease after successful Marketplace publication. Never overwrite an existing prerelease or artifact.

## Release process — no duplicate CI

- The version in `package.json` must be new, e.g. `0.2.1`, and `preview: true`; `private` must be `false` (public extension manifest).
- The changelog entry `## [0.2.1]` must be **finalized** (not marked `unreleased` or `candidate`). Merge a release PR after its mandatory 3-platform checks pass.
- A `push` to `main` triggers `publish.yml`. Its `authorize` job looks up the PR associated with the squash merge SHA, verifies that the PR head Git **tree** is *identical* to the new main tree, checks the exact PR-head successful `ci.yml` run and all 3 OS jobs, and requires the non-expired `vinculivo-private-vsix` artifact.
- The `artifact` job downloads this very VSIX from the successful PR run, verifies SHA-256, archive structure and manifest version/publisher/Preview. It **does not** run `npm ci`, compile, audit, package or execute the test suites after merge.
- `marketplace` publishes the verified VSIX with `vsce publish --oidc --packagePath vinculivo.vsix --skip-duplicate`, environment `marketplace`, OIDC only.
- `open-vsx` publishes the **same bytes** using `ovsx publish vinculivo.vsix --trusted-publishing`, environment `open-vsx`. If that version already exists, it skips. The Open VSX job is independent: a registry bootstrap problem does not block Marketplace.
- After successful Marketplace publication, `github-release` creates a GitHub **prerelease** tagged `v0.2.1` pointing at the merge SHA and attaches the same VSIX/checksum. Existing releases are never overwritten.
- Subsequent `main` merges with an already-released version skip publication automatically.

## Recovery without rebuilding

GitHub Actions > **publish** > **Run workflow** on `main` with:

- `confirmation`: `PUBLISH_VINCULIVO`
- `version`: exact `package.json` version (e.g. `0.2.1`)
- `registries`: `open-vsx` if only Open VSX failed, `marketplace` if Marketplace needs reconciliation, or `both` when both need another attempt.

The workflow always rediscovers the verified PR artifact for the associated main commit and checks its SHA again. It does **not** download an arbitrary, unsigned VSIX. If the PR CI artifact expired, make a fresh PR for the next release; do not bypass provenance.

## Troubleshooting

- **No `publish` run after merge:** verify `.github/workflows/publish.yml` exists in `main`; workflows are not backfilled for commits that happened before they were created. The merge adding the workflow starts its first run.
- **`RELEASE_PROVENANCE_DENIED`:** confirm that a squash merge was used, all three exact jobs passed for the PR's final head SHA, and the PR artifact still exists. Do not rerun CI for an unrelated SHA or loosen verification.
- **Marketplace OIDC failure:** compare the publisher policy's owner/repo/workflow/environment to `Drako01/vinculivo`, `publish.yml`, `marketplace`. Check OIDC is enabled, and that the environment permits `main` deployments.
- **Open VSX OIDC failure:** verify first-version PAT bootstrap and trusted publisher policy, with exact environment `open-vsx`. Use manual registry-specific recovery once configured.
- **No GitHub prerelease:** check `marketplace` job status. GitHub prerelease creation is conditioned on Marketplace success, not on Open VSX availability.
- **Preview label missing:** `package.json` must have `preview: true`; Marketplace/registry metadata can take time to update. The GitHub release uses `--prerelease`.
