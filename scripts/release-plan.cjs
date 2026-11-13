'use strict';
// Release governance: every published VSIX must originate from a successful PR
// workflow for the EXACT head SHA whose tree became the main merge commit.
// The publish workflow consumes its artifact; it NEVER rebuilds or reruns CI.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED = Object.freeze(['Verify (ubuntu-latest)', 'Verify (windows-latest)', 'Verify (macos-latest)']);
const EXPECTED_CI = '.github/workflows/ci.yml';
function fail(message) { throw new Error(`RELEASE_PROVENANCE_DENIED: ${message}`); }
function api(endpoint) {
  const raw = execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/${endpoint}`], { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(raw);
}
function getMergedPR(prs, mergeSHA, repo) {
  const matching = prs.filter(pr => pr.merge_commit_sha === mergeSHA && pr.merged_at &&
    pr.base?.ref === 'main' && pr.head?.repo?.full_name === repo && /^[a-f0-9]{40}$/i.test(pr.head?.sha ?? ''));
  if (matching.length !== 1) fail(`expected exactly one merged PR associated with ${mergeSHA}; got ${matching.length}`);
  return matching[0];
}
function getVerifiedRun(runs, headSHA) {
  // Select the latest successful PR CI run; GitHub can return superseded reruns.
  const candidates = runs.filter(r => r.event === 'pull_request' && r.status === 'completed' && r.conclusion === 'success' &&
    r.head_sha === headSHA && r.path === EXPECTED_CI).sort((a,b) => b.id - a.id);
  if (!candidates.length) fail(`no successful pre-merge ci.yml run for exact head ${headSHA}`);
  return candidates[0];
}
function verifyJobs(jobs) {
  for (const name of REQUIRED) {
    const matching = jobs.filter(j => j.name === name);
    if (matching.length !== 1 || matching[0].conclusion !== 'success') fail(`required PR check ${name} is missing or not successful`);
  }
}
function finalizedChangelog(version, contents) {
  const header = contents.split(/\r?\n/).find(line => line.startsWith(`## [${version}]`));
  return !!header && !/unreleased|candidate/i.test(header);
}
function releasePlan({env, packageJson, changelog, get, write}) {
  const event = env.GITHUB_EVENT_NAME, sha=env.GITHUB_SHA, repo=env.GITHUB_REPOSITORY;
  if (!/^[-\w.]+\/[-\w.]+$/.test(repo||'') || !/^[a-f0-9]{40}$/i.test(sha||'')) fail('invalid repository or SHA');
  if (env.GITHUB_REF !== 'refs/heads/main' || !['push','workflow_dispatch'].includes(event)) fail('only main push or explicit main dispatch is permitted');
  const version=packageJson.version;
  if (!/^\d+\.\d+\.\d+$/.test(version) || packageJson.name !== 'vinculivo' || packageJson.publisher !== 'armotusitio' || packageJson.private === true || packageJson.preview !== true)
    fail('manifest publisher/version/private/Preview requirements not met');
  if (!finalizedChangelog(version,changelog)) fail(`version ${version} requires a finalized changelog`);
  if (event === 'workflow_dispatch' && (env.CONFIRMATION !== 'PUBLISH_VINCULIVO' || env.REQUESTED_VERSION !== version))
    fail('manual dispatch requires PUBLISH_VINCULIVO and the exact version');

  // Ordinary commits for the same released version are no-ops.
  const released = get(`releases/tags/v${version}`,true);
  if (released && event === 'push') { write(`::notice::v${version} already released; no duplicate publication.`); return {publish:'false',version,run_id:''}; }

  const pr=getMergedPR(get(`commits/${sha}/pulls`),sha,repo);
  const head=pr.head.sha;
  const mergedTree=get(`git/commits/${sha}`).tree.sha;
  const headTree=get(`git/commits/${head}`).tree.sha;
  if (headTree!==mergedTree) fail(`tree mismatch: squash merge ${sha} differs from tested PR head ${head}`);
  const runs=get(`actions/runs?head_sha=${head}&event=pull_request&per_page=100`).workflow_runs;
  const run=getVerifiedRun(runs,head);
  verifyJobs(get(`actions/runs/${run.id}/jobs?per_page=100`).jobs);
  const artifacts=get(`actions/runs/${run.id}/artifacts?per_page=100`).artifacts;
  const candidate=artifacts.filter(a=>a.name==='vinculivo-private-vsix' && !a.expired);
  if (candidate.length!==1) fail(`expected one unexpired verified PR VSIX artifact for run ${run.id}`);
  write(`::notice::Exact PR #${pr.number} head ${head}; merge ${sha}; CI run ${run.id}; tree ${headTree}`);
  return {publish:'true',version,run_id:String(run.id)};
}
function main(){
  const pkg=JSON.parse(fs.readFileSync(path.join(process.cwd(),'package.json'),'utf8'));
  const changelog=fs.readFileSync(path.join(process.cwd(),'CHANGELOG.md'),'utf8');
  const get=(endpoint,optional=false)=>{
    try{return api(endpoint);}catch(error){
      if(optional && /HTTP 404|404 Not Found|Not Found/i.test(String(error.stderr??error.message))) return null;
      throw error;
    }
  };
  const output=releasePlan({env:process.env,packageJson:pkg,changelog,get,write:s=>process.stderr.write(s+'\n')});
  for(const [k,v] of Object.entries(output)) process.stdout.write(`${k}=${v}\n`);
}
if(require.main===module){try{main();}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}}
module.exports={REQUIRED,EXPECTED_CI,getMergedPR,getVerifiedRun,verifyJobs,finalizedChangelog,releasePlan};
