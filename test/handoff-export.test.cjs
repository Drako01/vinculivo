'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const {indexMarkdown}=require('../dist/core.js');

function setup(){
 const commands=new Map(),writes=[],messages=[],errors=[];
 let receive,workspaceChanged;
 const uri=(name,scheme='file')=>({scheme,toString:()=>`${scheme}:///work/${name}`});
 const root={name:'Example',uri:uri('example')};
 const disposable=()=>({dispose(){}});
 const api={
  ViewColumn:{One:1},ProgressLocation:{Notification:15},
  Uri:{joinPath:(base,...parts)=>({scheme:base.scheme,toString:()=>base.toString()+'/'+parts.join('/')})},
  workspace:{
   workspaceFolders:[root],isTrusted:true,
   getConfiguration:()=>({get:()=>50000}),
   onDidChangeWorkspaceFolders(fn){workspaceChanged=fn;return disposable();},
   onDidGrantWorkspaceTrust:disposable,
   fs:{async writeFile(destination,bytes){writes.push({destination,text:Buffer.from(bytes).toString('utf8')});}}
  },
  window:{
   createTreeView:()=>({onDidChangeVisibility:disposable,dispose(){}}),
   createWebviewPanel:()=>({onDidDispose:disposable,webview:{
    onDidReceiveMessage(fn){receive=fn;return disposable();},
    postMessage(message){messages.push(message);return Promise.resolve(true);}
   }}),
   withProgress:(_options,fn)=>fn({},{}),
   showErrorMessage(message){errors.push(message);},
   async showSaveDialog(options){assert.equal(options.defaultUri.toString(),'file:///work/example/vinculivo-handoff.md');return uri('handoff.md');}
  },
  commands:{registerCommand(name,fn){commands.set(name,fn);return disposable();}}
 };
 const scan={scanWorkspace:async()=>({folder:root,records:indexMarkdown('README.md','# Authorization\nScope every query to its tenant.'),files:1,changed:0,removed:0,partial:false,skipped:0,head:'a'.repeat(40)})};
 const load=Module._load;
 try{
  Module._load=function(id,parent,...args){
   if(id==='vscode'){return api;}
   if(id==='./scan'&&parent.filename.endsWith('extension.js')){return scan;}
   return load.call(this,id,parent,...args);
  };
  delete require.cache[require.resolve('../dist/extension.js')];
  require('../dist/extension.js').activate({subscriptions:[],workspaceState:{get:(_k,fallback)=>fallback}});
 }finally{Module._load=load;}
 async function generate(){
  await commands.get('vinculivo.scan')();
  receive({type:'preflight',task:'Authorization',profile:'codex',tokenBudget:250});
 }
 return {api,writes,messages,errors,generate,receive:m=>receive(m),
  save:()=>commands.get('vinculivo.exportHandoff')(),
  changeWorkspace(){api.workspace.workspaceFolders=[{name:'Other',uri:uri('other')}];workspaceChanged();}};
}

test('Markdown export writes the exact bounded preview to the explicitly selected destination',async()=>{
 const h=setup();await h.generate();
 const preview=h.messages.findLast(m=>m.type==='state'&&m.state.handoff).state.handoff;
 await h.save();
 assert.equal(h.errors.length,0);assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].destination.toString(),'file:///work/handoff.md');
 assert.equal(h.writes[0].text,preview);assert.ok(Buffer.byteLength(preview)<=1000);
 assert.match(preview,/Agent: codex/);assert.match(preview,/UNTRUSTED DATA/);
});

test('Webview save action uses the same export path and cancellation never writes',async()=>{
 const h=setup();await h.generate();
 h.api.window.showSaveDialog=async()=>undefined;
 await h.save();assert.equal(h.writes.length,0);
 h.api.window.showSaveDialog=async()=>({scheme:'file'});
 h.receive({type:'export-handoff'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.writes.length,1);
});

test('export requires trusted workspace and a generated preview, with no implicit generation',async()=>{
 const h=setup();await h.save();assert.match(h.errors.pop(),/Generate and review/);
 await h.generate();h.api.workspace.isTrusted=false;await h.save();
 assert.match(h.errors.pop(),/Trusted workspace/);assert.equal(h.writes.length,0);
});

test('pending save refuses workspace changes, lost trust, changed handoff and unsupported URLs',async()=>{
 for(const change of ['workspace','trust','handoff','scheme']){
  const h=setup();await h.generate();
  h.api.window.showSaveDialog=async()=>{
   if(change==='workspace'){h.changeWorkspace();}
   if(change==='trust'){h.api.workspace.isTrusted=false;}
   if(change==='handoff'){h.receive({type:'preflight',task:'Changed task',tokenBudget:250});}
   return {scheme:change==='scheme'?'https':'file'};
  };
  await h.save();assert.equal(h.writes.length,0,change);assert.equal(h.errors.length,1,change);
 }
});

test('write failures are reported without a success notification',async()=>{
 const h=setup();await h.generate();
 h.api.workspace.fs.writeFile=async()=>{throw new Error('Permission denied');};
 await h.save();assert.match(h.errors.pop(),/Permission denied/);
 assert.ok(!h.messages.some(m=>m.type==='toast'&&/saved as Markdown/.test(m.message)));
});
