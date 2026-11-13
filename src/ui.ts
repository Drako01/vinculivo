import { randomBytes } from 'node:crypto';
import { ContextRecord } from './core';

export interface ViewState { project: string; records: ContextRecord[]; files: number; changed: number; head?: string; error?: string; scanned: boolean; }
function escapeHtml(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

export function renderControlCenter(state: ViewState): string {
  const nonce = randomBytes(18).toString('base64');
  const cards = state.records.slice(0, 140).map((r) => `
  <article class="record">
    <div class="record-top"><span class="kind">${escapeHtml(r.category)}</span>${r.changedSinceLastScan ? '<span class="changed">SOURCE CHANGED</span>' : ''}</div>
    <h3>${escapeHtml(r.title)}</h3>
    <button class="source" data-open="${escapeHtml(r.id)}" title="Open source in editor">${escapeHtml(r.file)}:${r.line} ↗</button>
    <p>${escapeHtml(r.excerpt.slice(0, 290))}${r.excerpt.length > 290 ? '…' : ''}</p>
  </article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style nonce="${nonce}">
:root { color-scheme: dark; } * { box-sizing:border-box; } body { margin:0; background:var(--vscode-editor-background); color:var(--vscode-editor-foreground); font:13px var(--vscode-font-family); }
main { max-width:1160px; margin:0 auto; padding:34px 30px 60px; }
.eyebrow { letter-spacing:2px; font-weight:700; font-size:10px; color:var(--vscode-descriptionForeground); text-transform:uppercase; }
header { display:flex; justify-content:space-between; gap:16px; align-items:center; margin-bottom:22px; }
h1 { font-size:27px; letter-spacing:-.8px; margin:7px 0 4px; } .subtitle { color:var(--vscode-descriptionForeground); }
button { cursor:pointer; border:1px solid var(--vscode-button-border, transparent); border-radius:8px; background:var(--vscode-button-background); color:var(--vscode-button-foreground); padding:9px 13px; font-weight:600; }
button:hover { background:var(--vscode-button-hoverBackground); } button:focus-visible,input:focus-visible { outline:2px solid var(--vscode-focusBorder); outline-offset:2px; }
.secondary { background:var(--vscode-button-secondaryBackground); color:var(--vscode-button-secondaryForeground); }
.secondary:hover { background:var(--vscode-button-secondaryHoverBackground); }
.actions { display:flex; gap:9px; flex-wrap:wrap; }.metric-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin:20px 0; }
.metric { border:1px solid var(--vscode-panel-border); border-radius:11px; padding:15px; background:var(--vscode-sideBar-background); }
.metric b { display:block; font-size:25px; margin:5px 0; } .metric span,.hint { color:var(--vscode-descriptionForeground); font-size:12px; }
.tools { display:flex; gap:12px; align-items:flex-end; padding:17px; background:var(--vscode-sideBar-background); border:1px solid var(--vscode-panel-border); border-radius:11px; }
.field { flex:1; }.field label { display:block; font-weight:600; margin-bottom:7px; } input { width:100%; border-radius:7px; border:1px solid var(--vscode-input-border, var(--vscode-panel-border)); padding:10px; background:var(--vscode-input-background); color:var(--vscode-input-foreground); }
.section-title { font-size:17px; margin:29px 0 14px; }.record-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px; }
.record { border:1px solid var(--vscode-panel-border); border-radius:11px; background:var(--vscode-sideBar-background); padding:16px; min-width:0; }
.record h3 { margin:10px 0 7px; font-size:14px; overflow-wrap:anywhere; }.record p { white-space:pre-line; color:var(--vscode-descriptionForeground);line-height:1.5;overflow-wrap:anywhere; }
.record-top { display:flex; gap:8px; flex-wrap:wrap; }.kind,.changed { font-size:10px; font-weight:700; letter-spacing:.5px; border:1px solid var(--vscode-panel-border); border-radius:5px; padding:4px 6px; }.changed { color:var(--vscode-editorWarning-foreground); }
.source { background:none; border:0; padding:0; font-weight:500; color:var(--vscode-textLink-foreground); text-align:left; overflow-wrap:anywhere; }
.notice { padding:15px; border-radius:9px; border:1px solid var(--vscode-panel-border); margin:14px 0; }.error { color:var(--vscode-errorForeground); }
footer { margin-top:34px; color:var(--vscode-descriptionForeground); font-size:11px; }
@media(max-width:700px){main{padding:18px}.record-grid,.metric-grid{grid-template-columns:1fr}header,.tools{flex-direction:column;align-items:stretch}}
</style></head><body><main>
<header><div><div class="eyebrow">ARMOTUSITIO / ENGINEERING INTELLIGENCE</div><h1>Vinculivo</h1><div class="subtitle">Verified Project Context &amp; Decision Intelligence · ${escapeHtml(state.project)}</div></div><div class="actions"><button class="secondary" id="refresh">Scan documentation</button></div></header>
<div class="metric-grid"><div class="metric"><span>Source documents</span><b>${state.files}</b></div><div class="metric"><span>Context sections</span><b>${state.records.length}</b></div><div class="metric"><span>Sources changed since previous scan</span><b>${state.changed}</b></div></div>
${state.error ? `<div class="notice error" role="alert">${escapeHtml(state.error)}</div>` : ''}
${!state.scanned ? '<div class="notice">Nothing indexed yet. Select <b>Scan documentation</b> to read eligible local Markdown files. No background scanning or network requests.</div>' : ''}
<div class="tools"><div class="field"><label for="task">Task / relevant topic</label><input id="task" maxlength="300" placeholder="e.g. API authorization, ADR, database migrations" aria-label="Task context" /></div><button id="copy">Copy context handoff</button></div>
<p class="hint">Manual, local-only export to clipboard. Review sensitive information before pasting into any AI agent. Detected credential-like lines are redacted heuristically.</p>
<h2 class="section-title">Evidence and source documents</h2>
<div class="record-grid">${cards || '<div class="notice">No supported documentation found. Add AGENTS.md, CLAUDE.md, README.md or docs/adr/*.md and scan again.</div>'}</div>
<footer>Local-first · Read-only · SHA-256 source fingerprints · No telemetry · Git HEAD: ${escapeHtml(state.head?.slice(0, 12) ?? 'unavailable')}</footer>
</main><script nonce="${nonce}">
const vscode = acquireVsCodeApi();
document.getElementById('refresh').addEventListener('click',()=>vscode.postMessage({type:'scan'}));
document.getElementById('copy').addEventListener('click',()=>vscode.postMessage({type:'copy',task:document.getElementById('task').value}));
document.addEventListener('click',e=>{const btn=e.target.closest('[data-open]');if(btn)vscode.postMessage({type:'open',id:btn.dataset.open});});
</script></body></html>`;
}
