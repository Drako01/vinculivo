'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {indexMarkdown, sha256, redactSensitiveText}=require('../dist/core.js');
const {makeDecision,normalizeStoredDecisions,safeRelativePath,parseRelatedPaths,matchesPath,assessDecision,createPreflight,renderHandoff,estimateTokens,normalizeEvidenceReport}=require('../dist/intelligence.js');
const timestamp='2026-11-13T22:00:00.000Z';
const head='a'.repeat(40);
function decision(input={}){return {...makeDecision({title:'Tenant authorization',summary:'Every query scoped to company_id',paths:'src/auth/**,src/api/users.ts',...input},timestamp), status:'accepted',reviewedAt:timestamp,reviewedHead:head,reviewedFingerprints:{'src/api/users.ts':sha256('original')}};}

test('creates proposals; editing accepted decisions invalidates approval and fingerprint',()=>{
 const d=decision();const changed=makeDecision({title:'Tenant authorization',summary:'Always use tenant ID',paths:'src/auth/**'},timestamp,d);
 assert.equal(changed.status,'proposed');assert.equal(changed.reviewedHead,undefined);assert.deepEqual(changed.reviewedFingerprints,{});assert.equal(changed.id,d.id);
});
test('bounds and validates paths including traversal and unsupported wildcards',()=>{
 assert.equal(safeRelativePath('../secrets.env'),undefined);
 assert.equal(safeRelativePath('C:/secrets.txt'),undefined);
 assert.equal(safeRelativePath('/etc/passwd'),undefined);
 assert.equal(safeRelativePath('src/auth/**'),'src/auth/**');
 assert.equal(matchesPath('src/auth/**','src/auth/token.ts'),true);
 assert.equal(matchesPath('src/auth/**','src/authorization/key.ts'),false);
 assert.equal(matchesPath('src/auth/file.ts','src/auth/file.ts'),true);
 assert.throws(()=>parseRelatedPaths('../outside'),/unsafe/);
 assert.throws(()=>parseRelatedPaths('src/*.ts'),/unsafe/);
 assert.deepEqual(parseRelatedPaths('src/a.ts, src/a.ts\nsrc/keys/**'),['src/a.ts','src/keys/**']);
});
test('staleness from linked content and Git paths never implies semantic invalidity',()=>{
 const d=decision();
 const changed=assessDecision(d,[],['src/auth/authorize.ts'],head,{'src/api/users.ts':sha256('new')});
 assert.equal(changed.level,'review');assert.ok(changed.reasons.length>=2);
 const good=assessDecision(d,[],[],head,{'src/api/users.ts':sha256('original')});assert.equal(good.level,'current');
 const unknown=assessDecision(d,[],undefined,'b'.repeat(40),{'src/api/users.ts':sha256('original')});assert.equal(unknown.level,'unknown');
});
test('documentation changes and missing cited sections request review when index complete',()=>{
 const source=indexMarkdown('docs/adr/0001.md','# Authentication\nUse signed JWT.')[0];
 const d=decision();d.sourceFile=source.file;d.sourceLine=source.line;d.sourceDigest=source.digest;
 assert.equal(assessDecision(d,indexMarkdown(source.file,'# Authentication\nUse mTLS.'),[],head,{},true).level,'review');
 assert.equal(assessDecision(d,[],[],head,{},true).level,'review');
 assert.equal(assessDecision(d,[],[],head,{'src/api/users.ts':sha256('original')},false).level,'current');
});
test('unreviewed decisions and missing Git baseline are never green',()=>{
 const d=makeDecision({title:'Cache lifecycle',summary:'Use Redis for TTL'},timestamp);
 assert.equal(assessDecision(d,[],[],head).level,'unknown');
 const reviewed=decision();assert.equal(assessDecision(reviewed,[],[],undefined).level,'unknown');
});
test('preflight prioritizes matching decision and evidence, excludes unrelated',()=>{
 const a=decision(),b=decision({title:'Billing retries',summary:'Backoff on payment failures',paths:'src/billing/**'});b.id='f'.repeat(20);
 const docs=[...indexMarkdown('AGENTS.md','# Tenant security\nNever bypass company_id'),...indexMarkdown('README.md','# Build\nRun npm ci')];
 const e=normalizeEvidenceReport({schema:'vinculivo-evidence-v1',provider:'Probato PR',title:'Tenant code review',summary:'No tenant leaks verified'},'docs/probato.json',timestamp);
 const report=createPreflight('tenant security',[a,b],[{id:a.id,level:'review',reasons:['Changed auth code']},{id:b.id,level:'current',reasons:[]}],docs,[e]);
 assert.equal(report.decisions[0].decision.title,'Tenant authorization');assert.equal(report.records[0].file,'AGENTS.md');assert.equal(report.evidence.length,1);assert.match(report.warnings.join(' '),/Changed auth/);
});
test('handoff is portable across agents with bounded UTF-8 output',()=>{
 const d=decision(),r=indexMarkdown('docs/adr/0001.md','# Authorization\nAuthorize each request');
 for(const profile of ['generic','claude','codex','copilot']){
  const content=renderHandoff('project','a'.repeat(40),createPreflight('authorization',[d],[{id:d.id,level:'current',reasons:[]}],r,[]),profile,250,1000);
  assert.match(content,new RegExp('Agent: '+profile));assert.ok(Buffer.byteLength(content,'utf8')<=1000);assert.ok(estimateTokens(content)<=250);
 }
});
test('evidence import validates explicit schema and redacts known credential patterns',()=>{
 const valid=normalizeEvidenceReport({schema:'vinculivo-evidence-v1',provider:'Orquestivo',title:'PR verification',summary:'API_KEY = secret'},'reports/pr.json',timestamp);
 assert.doesNotMatch(valid.summary,/secret/);
 assert.throws(()=>normalizeEvidenceReport({schema:'arbitrary',provider:'X',title:'X',summary:'X'},'x',timestamp),/schema/);
 assert.match(redactSensitiveText('secret=abc\nghp_'+('a'.repeat(25))),/REDACTED/);
});
test('persisted records are validated, deduplicated and scope-bound',()=>{
 const d=decision();const loaded=normalizeStoredDecisions([d,d,{id:'bad',title:'invalid',summary:'x'}]);
 assert.equal(loaded.length,1);assert.equal(loaded[0].status,'accepted');
});
test('portable decision bundle never imports an accepted decision or stale baseline',()=>{
 const {exportContextBundle,importContextBundle}=require('../dist/bundle.js');
 const original=decision();
 const data=JSON.parse(exportContextBundle('payments',[original],head,timestamp));
 assert.equal(data.schema,'vinculivo-context-v1');assert.equal(data.decisions[0].status,'proposed');
 assert.deepEqual(data.decisions[0].reviewedFingerprints,{});
 data.decisions[0].status='accepted';data.decisions[0].reviewedHead=head;
 const imported=importContextBundle(data);
 assert.equal(imported[0].status,'proposed');assert.equal(imported[0].reviewedHead,undefined);
 assert.throws(()=>importContextBundle({schema:'unknown',decisions:[]}),/schema/);
});
