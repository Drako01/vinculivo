'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {getMergedPR,getVerifiedRun,verifyJobs,finalizedChangelog,releasePlan,REQUIRED}=require('../scripts/release-plan.cjs');
const sha='a'.repeat(40),head='b'.repeat(40),tree='c'.repeat(40);
const pr={number:3,merge_commit_sha:sha,merged_at:'2026-11-13',base:{ref:'main'},head:{sha:head,repo:{full_name:'Drako01/vinculivo'}}};
const ci={id:12345,event:'pull_request',status:'completed',conclusion:'success',head_sha:head,path:'.github/workflows/ci.yml'};
const jobs=REQUIRED.map(name=>({name,conclusion:'success'}));
const pkg={version:'0.3.0',name:'vinculivo',publisher:'armotusitio',preview:false,private:false};
const env={GITHUB_EVENT_NAME:'push',GITHUB_SHA:sha,GITHUB_REPOSITORY:'Drako01/vinculivo',GITHUB_REF:'refs/heads/main'};
const changelog='# Changelog\n\n## [0.3.0] — Stable release\n\n- Fix Activity Bar';
function withApi(override={}){
 const data={
   [`releases/tags/v0.3.0`]:null,
   [`commits/${sha}/pulls`]:[pr],
   [`git/commits/${sha}`]:{tree:{sha:tree}},
   [`git/commits/${head}`]:{tree:{sha:tree}},
   [`actions/runs?head_sha=${head}&event=pull_request&per_page=100`]:{workflow_runs:[ci]},
   [`actions/runs/${ci.id}/jobs?per_page=100`]:{jobs},
   [`actions/runs/${ci.id}/artifacts?per_page=100`]:{artifacts:[{id:3,name:'vinculivo-private-vsix',expired:false}]},
   ...override,
 };
 return (url)=>{assert.ok(Object.hasOwn(data,url),`unknown fixture ${url}`);return data[url];};
}
test('rejects an unfinalized changelog and validates version gating',()=>{
 assert.equal(finalizedChangelog('0.3.0',changelog),true);
 assert.equal(finalizedChangelog('0.3.0','## [0.3.0] — candidate (unreleased)'),false);
 assert.equal(finalizedChangelog('0.2.2',changelog),false);
});
test('exact main squash merge + three green CI jobs + artifact passes',()=>{
 const out=releasePlan({env,packageJson:pkg,changelog,get:withApi(),write:()=>{}});
 assert.deepEqual(out,{publish:'true',version:'0.3.0',run_id:'12345'});
});

test('stable publication rejects Preview, missing stability flag and private manifests',()=>{
 for(const manifest of [{...pkg,preview:true},{...pkg,preview:undefined},{...pkg,private:true}]){
  assert.throws(()=>releasePlan({env,packageJson:manifest,changelog,get:withApi(),write:()=>{}}),/stable requirements/);
 }
});
test('release that already exists is a noop for push',()=>{
 const out=releasePlan({env,packageJson:pkg,changelog,get:withApi({'releases/tags/v0.3.0':{tag_name:'v0.3.0'}}),write:()=>{}});
 assert.equal(out.publish,'false');
});
test('manual dispatch requires matching version and explicit confirmation',()=>{
 assert.throws(()=>releasePlan({env:{...env,GITHUB_EVENT_NAME:'workflow_dispatch',CONFIRMATION:'wrong',REQUESTED_VERSION:'0.3.0'},packageJson:pkg,changelog,get:withApi(),write:()=>{}}),/PUBLISH_VINCULIVO/);
 const out=releasePlan({env:{...env,GITHUB_EVENT_NAME:'workflow_dispatch',CONFIRMATION:'PUBLISH_VINCULIVO',REQUESTED_VERSION:'0.3.0'},packageJson:pkg,changelog,get:withApi(),write:()=>{}});
 assert.equal(out.publish,'true');
});
test('rejects PR with changed merge tree, mismatched checks and missing artifact',()=>{
 assert.throws(()=>releasePlan({env,packageJson:pkg,changelog,get:withApi({[`git/commits/${head}`]:{tree:{sha:'f'.repeat(40)}}}),write:()=>{}}),/tree mismatch/);
 assert.throws(()=>releasePlan({env,packageJson:pkg,changelog,get:withApi({[`actions/runs/${ci.id}/jobs?per_page=100`]:{jobs:jobs.slice(1)}}),write:()=>{}}),/ubuntu/);
 assert.throws(()=>releasePlan({env,packageJson:pkg,changelog,get:withApi({[`actions/runs/${ci.id}/artifacts?per_page=100`]:{artifacts:[]}}),write:()=>{}}),/artifact/);
});
test('rejects CI completed against a different head',()=>{
 assert.throws(()=>getVerifiedRun([{...ci,head_sha:'f'.repeat(40)}],head),/exact head/);
 assert.throws(()=>getMergedPR([{...pr,merge_commit_sha:'f'.repeat(40)}],sha,'Drako01/vinculivo'),/exactly one/);
 assert.throws(()=>verifyJobs([{name:'Verify (ubuntu-latest)',conclusion:'success'}]),/windows/);
});
test('workflow contains OIDC environments, no rebuild or duplicate CI on merge',()=>{
 const wf=fs.readFileSync(path.join(__dirname,'../.github/workflows/publish.yml'),'utf8');
 assert.match(wf,/branches: \[main\]/);
 for(const s of ['environment: marketplace','environment: open-vsx','id-token: write','run-id: \$\{\{ needs.authorize.outputs.run_id \}\}','sha256sum --check vinculivo.vsix.sha256','gh release create','--latest']) assert.ok(wf.includes(s),`missing ${s}`);
 assert.doesNotMatch(wf,/npm run (verify|test|check|build)|npm ci|vsce package/);
 assert.doesNotMatch(wf,/--prerelease|Vinculivo \$VERSION Preview/);
 assert.match(wf,/RELEASE_PROVENANCE|release-plan\.cjs/);
});
