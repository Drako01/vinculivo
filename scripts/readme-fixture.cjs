'use strict';
// Deterministic synthetic example only. NEVER store personal or real project information here.
const sha = '3c4f7a80b1d2e3f4567890abcdef123456789012';
const dated = '2026-11-13T10:00:00.000Z';
const rec = (id, file, line, title, excerpt, category, changed = false) => ({ id, file, line, title, excerpt, category, changedSinceLastScan: changed, digest: 'ab12cd34ef56' });
const records = [
  rec('r1','AGENTS.md',8,'Architecture and quality gates','Use strict tenant scoping. Validate only the impacted modules. Do not rerun successful test suites for unchanged code. Keep API contracts backward compatible.','Agent instructions'),
  rec('r2','docs/adr/001-tenant-isolation.md',12,'Tenant isolation by company_id','Every query must scope by company_id. Authorization happens at the API boundary and domain services recheck ownership.','Architecture decision'),
  rec('r3','docs/architecture/api-contracts.md',19,'API contracts and compatibility','Public endpoints use versioned schemas; consumers depend on explicit response fields. Breaking changes need a migration plan.','Project documentation'),
  rec('r4','docs/decisions/002-review-policy.md',6,'Review evidence before acceptance','A green check confirms only that the selected baseline has no detectable linked changes. Semantic correctness requires human verification.','Architecture decision'),
  rec('r5','CLAUDE.md',7,'Agent handoff','Keep instructions concise and source-linked. No automated external uploads, secret exports, or direct merge actions.','Agent instructions'),
  rec('r6','docs/architecture/runtime.md',31,'Runtime and deployment','Go API, Next.js frontend and PostgreSQL database. The preview validates on Linux, Windows and macOS.','Project documentation'),
  rec('r7','docs/decisions/003-context-budget.md',15,'Token budget and provenance','Prefer relevant source sections with line references. Warn if context is incomplete or source changed after review.','Architecture decision',true),
  rec('r8','README.md',22,'Engineering workflow','Pull requests run validations against the exact head SHA. Release is a separate, explicitly authorized operation.','Project documentation')
];
const decision = (id, title, summary, rationale, status, sourceFile, sourceLine, paths, reviewedAt) => ({
  id, title, summary, rationale, status, sourceFile, sourceLine, sourceDigest:'ab12cd34ef56',relatedPaths:paths,
  createdAt:'2026-11-10T10:00:00.000Z', updatedAt: dated, reviewedAt,
  reviewedHead: reviewedAt?sha:undefined, reviewedFingerprints:{}
});
const decisions=[
 decision('11111111111111111111','Tenant isolation is mandatory','All database reads and writes must scope to the authenticated tenant.','Prevents cross-company information disclosure.','accepted','docs/adr/001-tenant-isolation.md',12,['src/api/**','src/domain/**'],dated),
 decision('22222222222222222222','Preserve compatibility of public APIs','Version contract changes and validate impacted consumers before merging.','Multiple clients depend on stable response shapes.','accepted','docs/architecture/api-contracts.md',19,['src/contracts/**','src/api/**'],dated),
 decision('33333333333333333333','Source-bounded agent handoffs','Carry decision context and exact sources across Codex / Claude Code sessions.','Avoid stale prompts and duplicated verification.','accepted','AGENTS.md',8,['docs/**'],dated),
 decision('44444444444444444444','Context budget for large projects','Cap the exported context to selected sources and check incomplete scopes.','Improves clarity and reduces repeated token consumption.','accepted','docs/decisions/003-context-budget.md',15,['src/core/**'],dated),
 decision('55555555555555555555','Adopt additional evidence adapters','Evaluate compatibility with local engineering tools before integration.','Adapters remain opt-in and report external claims as unverified.','proposed','',0,['src/adapters/**'])
];
const signals=[
{id:'11111111111111111111',level:'current',reasons:['No linked changes detected since review; not a semantic guarantee']},
{id:'22222222222222222222',level:'current',reasons:['No linked changes detected since review; not a semantic guarantee']},
{id:'33333333333333333333',level:'current',reasons:['No linked changes detected since review; not a semantic guarantee']},
{id:'44444444444444444444',level:'review',reasons:['Referenced documentation section changed since last review']},
{id:'55555555555555555555',level:'unknown',reasons:['Not reviewed against a repository baseline']}
];
const evidence=[
{id:'aaaa',provider:'Orquestivo',title:'Pull request CI evidence',summary:'Ubuntu, Windows and macOS checks passed against the reviewed head SHA. Independently verify the workflow run before relying on this report.',source:'sample-reports/ci-evidence.json',sha,capturedAt:dated},
{id:'bbbb',provider:'Probato PR',title:'Code review coverage',summary:'The review identified no blocking findings in changed tenant authorization paths. This is an imported report, not a new verification.',source:'sample-reports/review-evidence.json',sha,capturedAt:dated},
{id:'cccc',provider:'Indizivo',title:'Runtime diagnostics',summary:'Development environment reports consistent Node, Git and port configuration for this sample workspace.',source:'sample-reports/runtime-evidence.json',capturedAt:dated}
];
const handoff=`# Project preflight — sample workspace\n\n**Task:** Review the tenant authorization middleware without breaking public contracts.\n**Target:** Codex / Claude Code — portable Markdown\n**Git HEAD:** ${sha.slice(0,12)}\n\n## Review warnings\n- Context budget decision may be stale: docs/decisions/003-context-budget.md:15\n- Proposed adapter integration has not been approved\n\n## Accepted decisions\n1. Tenant isolation is mandatory — docs/adr/001-tenant-isolation.md:12\n2. Preserve compatibility of public APIs — docs/architecture/api-contracts.md:19\n3. Source-bounded agent handoffs — AGENTS.md:8\n\n## Next steps\nInspect impacted code, verify facts at their sources, run targeted tests only. Do not trust imported evidence without checking the original run.\n`;
const preflight={task:'Review tenant authorization without breaking API contracts',decisions:decisions.slice(0,4).map((d,i)=>({decision:d,signal:signals[i]})),records:records.slice(0,5),evidence,warnings:['Review suggested: source in docs/decisions/003-context-budget.md changed since approval','One proposed decision is not yet accepted'],approxTokens:865};
module.exports = { state: {project:'Vinculivo Demo Workspace',workspaceFolders:['Vinculivo Demo Workspace'],selectedFolder:0,records,decisions,signals,evidence,files:7,changed:1,removed:0,partial:false,skipped:0,head:sha,scanned:true,scanning:false,preflight,handoff,handoffTokens:865 } };
