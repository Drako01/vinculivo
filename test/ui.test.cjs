'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderControlCenter,escapedJson}=require('../dist/ui.js');
const state={project:'<img src=x onerror=alert(1)>',workspaceFolders:['<evil>'],selectedFolder:0,records:[],decisions:[],signals:[],evidence:[],files:0,changed:0,removed:0,partial:false,skipped:0,scanned:false,scanning:false};
test('Control Center includes four navigation sections, nonce CSP and native theme variables',()=>{
 const page=renderControlCenter(state);
 assert.match(page,/Content-Security-Policy/);assert.match(page,/nonce-/);
 for(const section of ['overview','decisions','preflight','evidence']) assert.match(page,new RegExp('nav-'+section));
 assert.match(page,/--vscode-editor-background/);assert.match(page,/acquireVsCodeApi/);assert.match(page,/prefers-reduced-motion/);
});
test('embedded state cannot break out of script context',()=>{
 const attack='</script><script>alert(7)</script>';
 const json=escapedJson({value:attack});assert.doesNotMatch(json,/<script>|<\/script>/);
 const rendered=renderControlCenter({...state,project:attack});assert.ok(!rendered.includes(attack));
});

test('injected Control Center JavaScript parses in a modern Electron runtime',()=>{
 const vm=require('node:vm');const page=renderControlCenter(state);
 const script=page.match(/<script nonce="[^"]*">([\s\S]*?)<\/script>/)[1];
 assert.doesNotThrow(()=>new vm.Script(script));
});
