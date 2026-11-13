# Changelog

## [0.2.1] — Preview Activity Bar usability hotfix (unreleased)

- Selecting the Vinculivo icon in the Activity Bar opens or focuses the full Control Center in the central editor immediately, without requiring a separate launcher item click.
- Closes the temporary launcher sidebar to allow subsequent icon selections to reopen/focus the same editor panel; retains the keyboard-accessible launcher and Command Palette fallback.
- Adds a focused regression test for initial click, repeated selection, single-panel reuse, and command fallback. No changes to approved branding or analysis logic.

## [0.2.0] — Preview engineering candidate (unreleased)

- Replaced documentation-only MVP with a full decision lifecycle: proposals, human review, acceptance, supersession, deprecation and local workspace persistence.
- Added source-backed Git and file-fingerprint change signals. Unknown baselines never appear as verified.
- Added task-specific preflight, bounded multi-agent Markdown handoff, previews and explicit clipboard export.
- Added import/export of portable decision bundles with approval reset and opt-in structured evidence providers.
- Introduced main-editor Control Center with Overview, Decisions, Preflight and Evidence, search, filtering and responsive theme-aware UX.
- Hardening: Workspace Trust, path containment/symlink controls, bounded indexing, strict CSP and hostile-content tests.
- Preserved PR-only three-OS checks, with one Actions VSIX candidate and no publish pipeline.
- Corrected Activity Bar identity to match the official four-node circular brand.
- Added immutable-logo brand identity, moodboard, dark/light lockups, palettes, Preview branding and brand integrity gate.

## [0.1.0] — Initial private candidate

- Initial source-local Markdown indexing and source-referenced clipboard handoff.
- Main-editor Control Center, CI and private VSIX artifact.
