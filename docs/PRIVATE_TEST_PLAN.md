# Vinculivo · Private acceptance plan (v0.1.0)

The repository and distribution must remain private until the owner explicitly approves public publication.

## Installation

1. From a passing PR CI run, download the `vinculivo-private-vsix` artifact.
2. Verify the `.vsix` against `vinculivo.vsix.sha256` (SHA-256).
3. Open ArmoTuSitio IDE or VS Code, run `Extensions: Install from VSIX...`, and select the file.
4. Reload when prompted. In the Activity Bar, choose the monochrome Vinculivo icon; click `Open Vinculivo Control Center`.

## Hands-on scenarios (check each one)

- [ ] Fresh workspace: open Control Center; initial scan is **opt-in**, not automatic.
- [ ] With `AGENTS.md`, `CLAUDE.md`, `README.md`, and `docs/adr/0001-example.md`, scan and verify counts and evidence citations.
- [ ] Click a source: file opens at the corresponding heading line.
- [ ] Modify a source file, scan again: it is marked "SOURCE CHANGED" without claiming semantic invalidity.
- [ ] Enter a task, copy handoff, and inspect text: references, SHA-256 source snippets and relevant context are included.
- [ ] Add `API_KEY = test-secret` to sample documents, scan, copy: verify redaction; note that heuristic filtering is not a complete DLP control.
- [ ] Open an untrusted workspace: scan and handoff are blocked.
- [ ] No git installed / non-git folder: indexing still works and Git HEAD is shown as unavailable.
- [ ] Workspaces with >120 supported files and documents >100KB: confirm bounded resource use; check missing files are documented as limitations.
- [ ] Install the VSIX on your ArmoTuSitio IDE (VS Code API compatibility), plus stock VS Code.
- [ ] Confirm no unexpected network requests, background scans or automatic commits.
- [ ] Capture **real** screenshots from the installed extension for README (idle, evidence, source navigation and handoff); do not use mockups.

## Pre-publication gate

- [ ] Functional scenarios pass and known limitations are accepted.
- [ ] PR checks green for exact head SHA; inspect VSIX artifact checksum.
- [ ] Visual review of Control Center, Activity Bar and icon; accessibility keyboard/focus checks.
- [ ] README screenshots added from real builds; privacy/security disclosures reviewed.
- [ ] Public branding, trademark availability, license and support links confirmed.
- [ ] Owner explicitly authorizes changing repository visibility and enabling release/publishing workflows in a **separate PR**.

No automatic publish from `main`; no automated GitHub Release, Open VSX or Marketplace submission.
