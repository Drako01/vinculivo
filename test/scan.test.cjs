'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const Module=require('node:module');
const vscode={FileType:{File:1},workspace:{isTrusted:true}};
vscode.Uri={joinPath:(root,...parts)=>({scheme:root.scheme,authority:root.authority,path:path.posix.join(root.path,...parts),fsPath:path.join(root.fsPath,...parts)})};
vscode.RelativePattern=class{constructor(folder,pattern){this.folder=folder;this.pattern=pattern;}};
vscode.workspace.fs={stat:async uri=>({type:1,size:fs.statSync(uri.fsPath).size}),readFile:async uri=>fs.readFileSync(uri.fsPath)};
const original=Module._load;
Module._load=function(id,...args){if(id==='vscode')return vscode;return original.call(this,id,...args)};
const {scanWorkspace,readFingerprint,changedPathsSince,isWithinFolder}=require('../dist/scan.js');
Module._load=original;
function mockFolder(root){return {name:path.basename(root),uri:{scheme:'file',authority:'',path:root.replace(/\\/g,'/'),fsPath:root,toString:()=>root}};}
function cmd(root,...args){return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();}
function setup(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'vinculivo-'));fs.mkdirSync(path.join(root,'docs','adr'),{recursive:true});fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'AGENTS.md'),'# Project rules\nKeep PR checks before merge.\n');fs.writeFileSync(path.join(root,'docs','adr','0001.md'),'# Authorization\nCompany-scoped tenant validation.\n');fs.writeFileSync(path.join(root,'src','auth.ts'),'export const auth = true;');cmd(root,'init','-q');cmd(root,'-c','user.name=Vinculivo','-c','user.email=local@test.invalid','add','-A');cmd(root,'-c','user.name=Vinculivo','-c','user.email=local@test.invalid','commit','-qm','seed');return root;}
const state=()=>{const map=new Map();return {get:(k,def)=>map.get(k)??def,update:async(k,v)=>{map.set(k,v)}}};
test('real git baseline, bounded scan and modified documentation detection',async()=>{
 const root=setup(),folder=mockFolder(root),memory=state();
 try{
  vscode.workspace.findFiles=async()=>['AGENTS.md','docs/adr/0001.md'].map(p=>vscode.Uri.joinPath(folder.uri,...p.split('/')));
  const first=await scanWorkspace(folder,memory);assert.equal(first.files,2);assert.equal(first.changed,0);assert.ok(first.head);
  fs.writeFileSync(path.join(root,'AGENTS.md'),'# Project rules\nAlways validate tenant ID.\n');
  const second=await scanWorkspace(folder,memory);assert.equal(second.changed,1);assert.equal(second.records.find(r=>r.file==='AGENTS.md').changedSinceLastScan,true);
  assert.equal((await changedPathsSince(folder,first.head,second.head)).includes('AGENTS.md'),true);
  const fingerprint=await readFingerprint(folder,'AGENTS.md');assert.match(fingerprint,/^[a-f0-9]{64}$/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('trust denial and path escape protections',async()=>{
 const root=setup(),folder=mockFolder(root);
 try{
  vscode.workspace.isTrusted=false;
  await assert.rejects(()=>scanWorkspace(folder,state()),/Trust/);
  vscode.workspace.isTrusted=true;
  assert.equal(await readFingerprint(folder,'../outside.txt'),undefined);
  const outside=mockFolder(os.tmpdir());
  assert.equal(await isWithinFolder(folder,outside.uri),false);
 }finally{vscode.workspace.isTrusted=true;fs.rmSync(root,{recursive:true,force:true});}
});
