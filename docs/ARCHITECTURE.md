# Vinculivo — architecture, evidence and threat model

## Boundaries

- `core.ts`, `intelligence.ts`, `bundle.ts`: deterministic pure functions; no Git or VS Code side effects.
- `scan.ts`: explicit read-only indexed-document retrieval and bounded Git `execFile` reads; no shell evaluation.
- `storage.ts`: local VS Code `workspaceState`, keyed by SHA-256 of workspace folder URI. Does not persist raw scanned Markdown excerpts.
- `extension.ts`: the only command/permission adapter; Workspace Trust, explicit confirmation and clipboard/save dialogs.
- `ui.ts`: a central Webview with a strict nonce CSP; no network, no external fonts/scripts, data escaped for HTML and script contexts.

## Evidence semantics

- Decision acceptance is an explicit **human action**; data imported from files must be proposed again.
- Every review carries a timestamp, optional Git SHA and fingerprints of direct linked files.
- A changed linked fingerprint or Git diff matching a `folder/**` pattern becomes `review`.
- Missing/unsupported Git comparison becomes `unknown`. Never interpret `unknown` as no change.
- Remote VS Code folders can be indexed through `workspace.fs`, but local Git history is unavailable.
- Source references are bounded and may be absent in a partial index. Do not claim absence implies deletion.

## Privacy and attack surface

- No telemetry, provider keys, direct LLM calls, auto-merge, Git writes, or background agent execution.
- Explicit user actions: scan, create/edit/review, import, export, copy.
- Local realpath checks deny symlink escapes. Remote file URIs remain under their provider's permission boundary.
- Sanitization uses heuristic patterns only: never mistake it for formal secrets scanning.
- Imported JSON schemas and sizes are checked; importer never executes embedded code.
- Registered providers are explicit, in-process VS Code extensions. The user manually chooses a registered provider to collect from.
- Webview receives local excerpts only within a trusted workspace, and interpolated JSON is encoded to avoid ending script tags.

## Quality gates

Unit tests cover source selection, decision lifecycle, staleness signals, traversal protections, evidence schemas, bundle downgrade, length limits, and Webview CSP/JS parser. Private PR CI executes Linux, Windows and macOS. Full end-to-end visual and keyboard acceptance must be recorded against an actual installed VSIX, not a browser mockup.

## Limits

- Scan: 900 candidate paths, 180 relevant Markdown files, 150 KB/file, max 40 sections/file.
- Decisions: 150/workspace. Linked paths: 30/decision.
- Evidence: 100/workspace. JSON imports are size-bounded.
- Preflight: 25 decisions, 24 sections, 12 evidence summaries before export budget selection.
- Handoff: max 16,000 approximate tokens, 50,000 characters setting. This is an **approximation**, not tokenizer parity.

## No automatic CI after merge

Only PR and manual dispatch events trigger verification. Artifacts from the PR SHA are retained privately; there is no push-to-main suite or publish workflow until separately authorized.
