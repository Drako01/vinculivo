<div align="center">

<img src="media/brand/vinculivo-icon-256.png" width="112" alt="Vinculivo icon" />

# Vinculivo

**Verified Project Context & Decision Intelligence**

*Project memory grounded in your own files — evidence, not another chatbot.*

**ArmoTuSitio Engineering Tools** · VS Code extension · Local-first · Private development candidate

</div>

> [!IMPORTANT]
> **v0.1.0 · Private testing · Not published.** This repository is currently private. There is no public release, no Marketplace listing and no Open VSX publication. The first VSIX is exclusively for owner testing in ArmoTuSitio IDE / VS Code. Screenshots and public launch assets will be added only after real-device testing.

## Why Vinculivo?

Long-running projects accumulate rules, ADRs and architectural assumptions across Markdown documents. AI sessions and developer handoffs frequently lose that context. Vinculivo provides a **read-only, locally grounded index** of those sources and creates a **manual, cited handoff** for continuing a task with the assistant or engineer of your choice.

It does **not** claim to understand the entire codebase, prove decisions correct or transfer a provider's private conversation history. It complements — rather than replaces — AI agent memory and project tooling.

## What it does in v0.1.0

| Capability | Current implementation |
| --- | --- |
| Documentation intake | Local `AGENTS.md`, `CLAUDE.md`, root `README.md`, and selected `docs/adr`, `docs/decisions`, `docs/architecture`, `docs/design` Markdown |
| Context sections | Extracts headings, excerpts, source path, line number and local SHA-256 fingerprint |
| Evidence navigation | Opens the cited source line directly in the VS Code editor |
| Change signals | Marks documents changed **since the previous scan**, not semantically invalid decisions |
| Context handoff | Explicit clipboard export with relevant sections and configurable character budget |
| Editor UI | Dark Premium Control Center in the **main editor**, Activity Bar monochrome launcher |
| Trust & privacy | No automatic scan, no telemetry, no HTTP APIs, no external model calls; blocks untrusted or non-local workspaces |
| Developer quality | TypeScript, unit tests, reproducible lockfile, private PR CI and VSIX artifact with checksum |

## UI & brand

The identity uses a connected-node symbol to represent traced decisions and context. The Activity Bar SVG is **monochrome** (`currentColor`) and follows the active VS Code theme. The Control Center uses native editor theme tokens and remains in the central editor area, not a custom sidebar dashboard.

**Real screenshots are pending private acceptance testing**. We will capture actual screens from the installed VSIX before making the repository public. No simulated screenshots or misleading Marketplace badges are used.

## Installation — private build

1. Open a green CI run for the private PR, and download its **`vinculivo-private-vsix`** artifact (GitHub access required).
2. Unzip the artifact and compare the file's SHA-256 with `vinculivo.vsix.sha256`.
3. In **ArmoTuSitio IDE** (or VS Code), use **Extensions → `...` → Install from VSIX...**.
4. Select `vinculivo.vsix`, reload if requested, and click the Vinculivo Activity Bar icon.
5. Choose **Open Vinculivo Control Center**. On the central panel, click **Scan documentation**. Workspace Trust must be enabled.

### Local build

Requires Node.js 22+, npm and a compatible VS Code-derived IDE (VS Code API `^1.96.0`).

```bash
git clone https://github.com/Drako01/vinculivo.git
cd vinculivo
npm ci --ignore-scripts
npm run verify
npm run package:vsix
```

`npm run verify` checks TypeScript and runs focused unit tests. `npm run package:vsix` emits `vinculivo.vsix` and `vinculivo.vsix.sha256` for local inspection. **No script publishes anything.** The repository must remain accessible to your authenticated GitHub account when private.

## Workflow

1. Add or maintain the project's real `AGENTS.md`, `CLAUDE.md`, architecture notes and ADRs.
2. Run `Vinculivo: Scan Project Documentation` or open the Control Center and scan.
3. Review the document cards, source paths and any **SOURCE CHANGED** signal. Click a citation to verify it in the editor.
4. Enter a task or topic to prioritize relevant sections; press **Copy context handoff**.
5. Review the clipboard contents before pasting into Claude Code, Codex, Copilot, another agent or an engineering handoff.

**Example handoff (illustrative):**

```text
# Vinculivo — Project Context Handoff
Project: payments-api
Git HEAD: 4bc... (full SHA in actual export)
Task: company-scoped authorization

## API Authorization
Source: docs/adr/0003-authorization.md:1 · SHA-256 excerpt source: ...
...document excerpt...
```

Source hashes support traceability, not authenticity or correctness guarantees. The result includes *only* local Markdown snippets chosen by a straightforward keyword ranking, not full codebase semantic search.

## Commands

| Command Palette | Behavior |
| --- | --- |
| `Vinculivo: Open Control Center` | Opens the central editor dashboard |
| `Vinculivo: Scan Project Documentation` | Explicitly scans eligible Markdown documents |
| `Vinculivo: Copy Context Handoff` | Copies an export from the last scan (task optional) |

**Setting:** `vinculivo.maxHandoffChars` (default `12000`, range `1000–50000`). This is a **character limit**, not a precise token measurement.

## Privacy and security

- **Local-first:** no telemetry, network transmissions, automatic agent requests or Git writes.
- **Opt-in read:** scanning occurs only after a user command in a trusted local workspace.
- **Data retention:** raw Markdown excerpts live in extension memory only; document fingerprints persist in workspace state for change comparison.
- **Clipboard:** export is manually triggered. Review copied context before sharing it with external tools.
- **Secrets:** a small heuristic redacts credential-like lines; it **cannot guarantee removal of all secrets**.
- **Webview:** HTML escapes document content and enforces a nonce-based Content Security Policy.

Read [SECURITY.md](SECURITY.md) before production usage.

## Scope and known limitations

- Single active workspace folder per scan (active editor's folder; otherwise first folder).
- Local `file:` workspace support only; no remote or virtual workspace index in this version.
- At most 500 Markdown files discovered, 120 eligible files read, 100 KB per document and 40 headings per file; very large documentation sets may be partially indexed.
- No AST/symbol graph, semantic consistency engine, database, automatic ADR creation, Git blame or GitHub ingestion yet.
- Change detection compares **document file content** against the prior scan; it does not detect a decision invalidated by unrelated code changes.
- Clipboard export is heuristic keyword selection; no external embeddings or provider-specific APIs.
- No external security audit or end-to-end IDE acceptance is claimed for this initial candidate.

## Roadmap (not implemented)

- [ ] User-approved decision records with rationale, lifecycle and links to exact Git commits.
- [ ] Evidence-based staleness detection from impacted code, PRs and ADR dependencies.
- [ ] Source-backed preflight and incremental handoff across Claude Code / Codex / other assistants.
- [ ] Optional adapters to Probato PR, Indizivo, Orquestivo, Saturivo, Noditrivo and Vestigivo RCA.
- [ ] Multi-root, remote-workspace support, advanced filtering, keyboard accessibility audit and cross-platform IDE integration tests.
- [ ] Screenshots from the installed extension; private owner acceptance prior to public release.

## Engineering / delivery policy

- **Architecture:** TypeScript strict, separate pure context engine (`src/core.ts`) from the VS Code adapter (`src/scan.ts`, `src/extension.ts`) and UI (`src/ui.ts`).
- **Quality:** KISS / DRY / SOLID; explicit user commands, bounded I/O, no irreversible mutations; focused tests and CI on PRs.
- **Token economy:** do not repeat unchanged checks; document validated SHAs and rerun only affected tests locally. CI validates each proposed head SHA once on PR.
- **CI:** runs only on PR and manual dispatch; a successful PR produces a **private VSIX artifact**. Merge to `main` deliberately **does not repeat CI or publish**.
- **Release:** publication, visibility change and public distribution require explicit owner approval and a separate release/publish change.

See [private acceptance checklist](docs/PRIVATE_TEST_PLAN.md), [changelog](CHANGELOG.md) and [security policy](SECURITY.md).

## Español — resumen

**Vinculivo** organiza las instrucciones y decisiones documentadas de tus proyectos dentro de VS Code. Podés analizar los archivos Markdown locales autorizados, seguir las referencias al archivo y línea de origen, detectar cuáles cambiaron desde el último análisis y copiar un contexto relevante para otro desarrollador o agente IA.

El escaneo es **manual y local**. Por ahora **no** se publica en Open VSX ni Marketplace, no se cambia la privacidad del repositorio y no hay release público. Primero se valida el VSIX en ArmoTuSitio IDE. Las funciones avanzadas del roadmap todavía no están implementadas.

---

<div align="center">
  <strong>Part of the ArmoTuSitio developer-tooling family</strong><br />
  <a href="https://armotusitio.com.ar">ArmoTuSitio</a> · <a href="https://github.com/Drako01">GitHub</a><br />
  Licensed under <a href="LICENSE">MIT</a> · © 2026 Alejandro Daniel Di Stefano
</div>
