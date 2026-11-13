# Security & privacy

Vinculivo is local-first and performs no telemetry, outbound API requests or automatic agent invocations in v0.1.0. Indexing only occurs on an explicit command within trusted, local workspaces. Document contents are kept in extension memory and are not persisted by the extension. The workspace state stores SHA-256 document fingerprints (not document text) for change detection.

The handoff action copies relevant excerpts to the system clipboard only when explicitly requested. **The clipboard is readable by other programs and must be reviewed before sharing.** Credential-like lines are redacted heuristically; this is **not** a secrets scanner or data-loss-prevention guarantee. Never put secrets in Markdown documentation.

Markdown is escaped before rendering in the Webview. Webviews enforce a strict Content Security Policy without network access. `git rev-parse HEAD` is executed without a shell and with a timeout; Git is optional. No documents are automatically modified, committed or pushed.

For private vulnerabilities, use GitHub's private vulnerability reporting if enabled, or reach out via https://armotusitio.com.ar/soporte/ . Do not post credentials or exploits in public issues.
