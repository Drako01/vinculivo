# Vinculivo — Private Enterprise Acceptance

> Status: **Private engineering candidate. Not approved for public release.** The project owner performs manual acceptance in the actual IDE. Do not claim completion of unchecked items.

## Automated gates (exact PR head SHA)

- [ ] `npm ci --ignore-scripts --no-audit --no-fund` on Ubuntu, Windows and macOS
- [ ] TypeScript strict compilation on all three platforms
- [ ] Pure unit and adversarial tests for decisions, path safety, staleness, handoff, budget, evidence and Webview
- [ ] Package VSIX on Linux and inspect artifact inventory + checksum
- [ ] No automatic public publish, tag, release or post-merge repeated CI

## Manual VSIX install (ArmoTuSitio IDE and VS Code)

- [ ] Install fresh build, reload, and ensure **monochrome network logo** renders exactly like the main logo (not the old hexagonal icon)
- [ ] Launch from Activity Bar into central editor; reopen and restore UI after reload
- [ ] Single Activity Bar icon click opens the editor directly (no extra launcher-tree click); sidebar closes after activation
- [ ] Click icon again after hiding/reopening the view: focuses the same Control Center tab without duplicates
- [ ] Confirm Command Palette `Vinculivo: Open Control Center` still works without collapsing an unrelated sidebar
- [ ] Overview: empty state, trusted/untrusted state, local scan, source citation navigation, bad documents
- [ ] Multi-root selection prevents decisions/evidence crossing root boundaries
- [ ] Create proposal, link document and code paths, review and accept after dialog
- [ ] Edit accepted decision; confirm it returns to `proposed`
- [ ] Change a linked source; confirm `review suggested` and correct file links
- [ ] Missing Git history results `unknown`, not success
- [ ] Supersede/deprecate or delete with confirmation
- [ ] Export/import register: no auto-acceptance from imported JSON
- [ ] Import valid and malformed JSON evidence; reject oversized/out-of-scope files
- [ ] Generate preflight for Codex/Claude/Copilot with source, warnings and bounded budget
- [ ] Clipboard copy only on explicit action; verify heuristic redaction caveat
- [ ] UI keyboard focus, Enter/Space buttons, accessible labels, zoom 100–200%, reduced motion
- [ ] Dark and light themes, high contrast, 1366px and narrower editor sizes
- [ ] Windows, Linux and macOS actual host smoke (where accessible)
- [ ] Screenshot only from **actual VS Code/ArmoTuSitio IDE Extension Host** for README; never imply static render is real
- [ ] Owner approves final UX and private VSIX before any merge/public step

## Deliberately deferred until verified upstream adapters

- [ ] Direct provider integration with Probato PR, Indizivo, Orquestivo, Saturivo, Noditrivo and Vestigivo RCA after their output contracts are confirmed
- [ ] Optional provider-specific model tokenizers (currently a conservative UTF-8 sizing heuristic)
- [ ] Signed provenance for third-party evidence, where supported by upstream tools
- [ ] Public marketplace collateral and public release workflow require independent authorization

## Token economy

Keep progress and evidence attached to exact commit SHAs. Do not rerun unchanged local suites, and do not run speculative audits. CI required by GitHub rulesets runs once per candidate commit; Linux packages one private VSIX. Branch merge to main does not repeat premerge CI.
