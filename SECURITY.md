# Vinculivo — security and privacy

- **Local-first by construction:** no telemetry, network calls, external model SDKs or autonomous agent execution. The user explicitly initiates each scan and export.
- **Trust boundary:** source reads, evidence imports, decision changes and clipboard export require trusted workspaces. Scanning is bounded to authorized Markdown and verifies URI containment and local `realpath` to reject symlinks outside the project.
- **Git:** read-only `execFile('git', args)` with no shell and bounded time/output. No push, checkout, merge or commit operations.
- **Storage:** raw indexed Markdown is in memory, not persisted. Workspace state holds file fingerprints, user-authored decisions and imported evidence summaries. Decisions may contain private project information.
- **Clipboard/bundle:** actions require user gestures; clipboard is visible to other processes. Exported JSON may be sensitive and must be handled accordingly. Imported approval claims are always reset to proposals.
- **Secrets:** detection/redaction is **heuristic**, not a formal secrets scanner or DLP guarantee. Keep credentials out of project documentation and manually inspect exports.
- **Webview:** CSP disables remote resources, nonce-protects scripts/styles, escaped JSON prevents injection through Markdown excerpts and no dynamic code is executed from imported reports.
- **Evidence:** imported/registered reports are not independently verified. Report collection from registered extensions requires an explicit user command.
- **Remote workspaces:** VS Code's FS provider determines file permissions; local Git staleness checks are unavailable and reported as unknown.

To report a private vulnerability, use GitHub private vulnerability reporting (if enabled) or https://armotusitio.com.ar/soporte/. Do not paste credentials in issues.
