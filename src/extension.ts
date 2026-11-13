import * as vscode from 'vscode';
import { ContextRecord } from './core';
import { scanWorkspace, ScanResult, readFingerprint, changedPathsSince, isWithinFolder } from './scan';
import { WorkspaceStore } from './storage';
import { Decision, DecisionSignal, EvidenceReport, AgentProfile, assessDecision, makeDecision, normalizeEvidenceReport, createPreflight, renderHandoff, estimateTokens, safeRelativePath, cleanUserText } from './intelligence';
import { renderControlCenter, ViewState } from './ui';
import { exportContextBundle, importContextBundle } from './bundle';

const EMPTY = (): ViewState => ({ project:'No workspace',workspaceFolders:[],selectedFolder:0,records:[],decisions:[],signals:[],evidence:[],files:0,changed:0,removed:0,partial:false,skipped:0,scanned:false,scanning:false });
const AGENTS: AgentProfile[]=['generic','claude','codex','copilot'];
interface Message {type:string;id?:string;index?:number;title?:string;summary?:string;rationale?:string;paths?:string;sourceId?:string;status?:string;task?:string;profile?:string;tokenBudget?:number;}
interface EvidenceProvider {name:string;collect:()=>Promise<unknown[]>;}

class Launcher implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(item:vscode.TreeItem):vscode.TreeItem{return item;}
  getChildren():vscode.TreeItem[]{
    const item=new vscode.TreeItem('Open Vinculivo Control Center',vscode.TreeItemCollapsibleState.None);
    item.command={command:'vinculivo.openControlCenter',title:'Open Vinculivo Control Center'};
    item.iconPath=new vscode.ThemeIcon('link');return [item];
  }
}

export function activate(context:vscode.ExtensionContext):{registerEvidenceProvider:(name:string,collect:()=>Promise<unknown[]>)=>vscode.Disposable} {
  const store=new WorkspaceStore(context.workspaceState);
  const providers=new Map<string,EvidenceProvider>();
  let panel:vscode.WebviewPanel|undefined;
  let current:ScanResult|undefined;
  let folderIndex=0;
  let currentHandoff='';
  let view:ViewState=EMPTY();
  const folders=():readonly vscode.WorkspaceFolder[]=>vscode.workspace.workspaceFolders??[];
  const folder=():vscode.WorkspaceFolder|undefined=>folders()[folderIndex];
  const now=()=>new Date().toISOString();
  const toast=(message:string)=>{void panel?.webview.postMessage({type:'toast',message});};
  const update=()=>{if(panel){void panel.webview.postMessage({type:'state',state:view});}};
  const showError=(error:unknown)=>{const message=error instanceof Error?error.message:String(error);view.error=message;view.scanning=false;update();void vscode.window.showErrorMessage(`Vinculivo: ${message}`);};
  const resetHandoff=()=>{currentHandoff='';view.preflight=undefined;view.handoff=undefined;view.handoffTokens=undefined;};

  function refreshWorkspace():void{
    const list=folders();if(folderIndex>=list.length){folderIndex=0;}
    const selected=folder();
    view={...EMPTY(),workspaceFolders:list.map(x=>x.name),selectedFolder:folderIndex,project:selected?.name??'No workspace',decisions:selected?store.decisions(selected):[],evidence:selected?store.evidence(selected):[]};
    current=undefined;resetHandoff();update();
  }

  async function signalsForDecisions(target:vscode.WorkspaceFolder,records:readonly ContextRecord[],head:string|undefined):Promise<DecisionSignal[]>{
    const decisions=store.decisions(target);
    const gitCache=new Map<string,Promise<string[]|undefined>>();
    const results:DecisionSignal[]=[];
    for(const d of decisions){
      if(!d.reviewedAt){results.push({id:d.id,level:'unknown',reasons:['Not reviewed against a repository baseline']});continue;}
      const fingerprints:Record<string,string|undefined>={};
      await Promise.all(Object.keys(d.reviewedFingerprints).slice(0,30).map(async p=>{fingerprints[p]=await readFingerprint(target,p);}));
      let paths:string[]|undefined;
      if(d.reviewedHead && head){
        if(!gitCache.has(d.reviewedHead)){gitCache.set(d.reviewedHead,changedPathsSince(target,d.reviewedHead,head));}
        paths=await gitCache.get(d.reviewedHead);
      }
      results.push(assessDecision(d,records,paths,head,fingerprints,Boolean(current && !current.partial && !current.skipped)));
    }
    return results;
  }

  async function refreshDecisions():Promise<void>{
    const target=folder();if(!target){return;}
    view.decisions=store.decisions(target);
    view.evidence=store.evidence(target);
    view.signals=await signalsForDecisions(target,current?.records??[],current?.head);
    resetHandoff();update();
  }

  async function scan():Promise<void>{
    const target=folder();if(!target){view.error='Open a workspace folder before scanning.';update();return;}
    if(!vscode.workspace.isTrusted){view.error='Trust this workspace before reading source files.';update();return;}
    if(view.scanning){return;}
    view.scanning=true;view.error=undefined;update();
    try{
      const result=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Vinculivo: indexing permitted documentation',cancellable:true},(_progress,token)=>scanWorkspace(target,context.workspaceState,token));
      // Ignore stale results if the user changed folder while indexing.
      if(target.uri.toString()!==folder()?.uri.toString()){return;}
      current=result;
      view={...view,project:target.name,records:result.records,files:result.files,changed:result.changed,removed:result.removed,partial:result.partial,skipped:result.skipped,head:result.head,scanned:true,scanning:false,error:undefined};
      view.signals=await signalsForDecisions(target,result.records,result.head);
      resetHandoff();update();toast(`Indexed ${result.files} documents / ${result.records.length} sections`);
    }catch(error){view.scanning=false;showError(error);}
  }

  function openCenter():void{
    if(panel){panel.reveal(vscode.ViewColumn.One);return;}
    refreshWorkspace();
    panel=vscode.window.createWebviewPanel('vinculivo.controlCenter','Vinculivo · Control Center',vscode.ViewColumn.One,{enableScripts:true,retainContextWhenHidden:true,localResourceRoots:[]});
    panel.onDidDispose(()=>{panel=undefined;},undefined,context.subscriptions);
    panel.webview.onDidReceiveMessage((raw:unknown)=>{void receiveMessage(raw);},undefined,context.subscriptions);
    panel.webview.html=renderControlCenter(view);
  }

  async function openSource(id:string):Promise<void>{
    if(!vscode.workspace.isTrusted){return;}
    const target=folder();if(!target||!current){return;}
    const r=current.records.find(x=>x.id===id);if(!r){return;}
    const relative=safeRelativePath(r.file);if(!relative){return;}
    const uri=vscode.Uri.joinPath(target.uri,...relative.split('/'));
    if(!(await isWithinFolder(target,uri))){throw new Error('Source is outside the selected workspace.');}
    const doc=await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc,{selection:new vscode.Range(Math.max(0,r.line-1),0,Math.max(0,r.line-1),0),preview:true});
  }

  async function saveDecision(message:Message):Promise<void>{
    const target=folder();if(!target||!vscode.workspace.isTrusted){throw new Error('A trusted workspace is required.');}
    const existing=message.id?store.decisions(target).find(d=>d.id===message.id):undefined;
    if(message.id&&!existing){throw new Error('Decision not found or workspace changed.');}
    const source=message.sourceId?current?.records.find(r=>r.id===message.sourceId):undefined;
    if(message.sourceId&&!source){throw new Error('Referenced source is no longer indexed. Rescan before saving.');}
    const newDecision=makeDecision({title:message.title??'',summary:message.summary??'',rationale:message.rationale,paths:message.paths,source},now(),existing);
    await store.saveDecision(target,newDecision);await refreshDecisions();toast('Decision saved as proposal. Review required before acceptance.');
  }

  async function reviewDecision(id:string):Promise<void>{
    const target=folder();if(!target||!vscode.workspace.isTrusted){throw new Error('Trusted workspace required.');}
    const decision=store.decisions(target).find(d=>d.id===id);if(!decision){throw new Error('Decision no longer exists.');}
    if(!current){throw new Error('Scan the project before reviewing a decision.');}
    const selected=await vscode.window.showWarningMessage('Have you inspected the linked sources and verified this decision still applies? Vinculivo cannot establish semantic correctness.',{modal:true},'Confirm review');
    if(selected!=='Confirm review'){return;}
    const fingerprints:Record<string,string>={};
    for(const p of decision.relatedPaths){
      if(p.endsWith('/**')){continue;}
      const digest=await readFingerprint(target,p);
      if(!digest){throw new Error(`Linked path not readable: ${p}. Fix the link before accepting.`);}
      fingerprints[p]=digest;
    }
    const source=current.records.find(r=>r.file===decision.sourceFile&&r.line===decision.sourceLine);
    const updated:Decision={...decision,status:'accepted',sourceDigest:source?.digest??decision.sourceDigest,reviewedAt:now(),updatedAt:now(),reviewedHead:current.head,reviewedFingerprints:fingerprints};
    await store.saveDecision(target,updated);await refreshDecisions();toast('Review recorded with linked file fingerprints.');
  }

  async function statusDecision(id:string,status:string):Promise<void>{
    const target=folder();if(!target||!vscode.workspace.isTrusted){throw new Error('Trusted workspace required.');}
    if(!['proposed','superseded','deprecated'].includes(status)){throw new Error('Invalid decision status.');}
    const d=store.decisions(target).find(x=>x.id===id);if(!d){return;}
    await store.saveDecision(target,{...d,status:status as Decision['status'],updatedAt:now()});await refreshDecisions();
  }
  async function removeDecision(id:string):Promise<void>{
    const target=folder();if(!target||!vscode.workspace.isTrusted){return;}
    const d=store.decisions(target).find(x=>x.id===id);if(!d){return;}
    const choice=await vscode.window.showWarningMessage(`Delete decision "${d.title}"? This removes its local history.`,{modal:true},'Delete decision');
    if(choice!=='Delete decision'){return;}
    await store.removeDecision(target,id);await refreshDecisions();toast('Decision removed from local workspace state.');
  }

  function generate(task:string,profile:string,budget:number):void{
    const target=folder();if(!target||!vscode.workspace.isTrusted){throw new Error('Trusted workspace required.');}
    if(!current){throw new Error('Scan the workspace before generating a source-backed handoff.');}
    const type:AgentProfile=AGENTS.includes(profile as AgentProfile)?profile as AgentProfile:'generic';
    const b=Number.isFinite(budget)?Math.max(250,Math.min(16000,Math.trunc(budget))):3000;
    const preflight=createPreflight(task,view.decisions,view.signals,current.records,view.evidence);
    const maxChars=vscode.workspace.getConfiguration('vinculivo').get<number>('maxHandoffChars',50000);
    currentHandoff=renderHandoff(target.name,current.head,preflight,type,b,maxChars);
    view.preflight=preflight;view.handoff=currentHandoff;view.handoffTokens=estimateTokens(currentHandoff);update();toast('Preflight generated locally. Review before copying.');
  }
  async function copy():Promise<void>{
    if(!vscode.workspace.isTrusted){throw new Error('Workspace must be trusted before exporting context.');}
    if(!currentHandoff){generate('','generic',3000);}
    await vscode.env.clipboard.writeText(currentHandoff);
    toast(`Copied ${estimateTokens(currentHandoff)} approximate tokens. Review before sharing.`);
  }

  async function exportDecisions():Promise<void>{
    const target=folder();if(!target||!vscode.workspace.isTrusted){throw new Error('Trusted workspace required.');}
    const approved=await vscode.window.showWarningMessage('Export decision summaries to a JSON file? The bundle may contain internal project information. It does not include source excerpts. Review before sharing.',{modal:true},'Choose destination');
    if(approved!=='Choose destination'){return;}
    const destination=await vscode.window.showSaveDialog({defaultUri:vscode.Uri.joinPath(target.uri,'vinculivo-context.json'),filters:{'Vinculivo context':['json']},saveLabel:'Export decisions'});
    if(!destination){return;}
    const output=exportContextBundle(target.name,store.decisions(target),current?.head);
    await vscode.workspace.fs.writeFile(destination,Buffer.from(output,'utf8'));
    toast('Portable context saved. Importing requires a new human review.');
  }
  async function importDecisions():Promise<void>{
    const target=folder();if(!target||!vscode.workspace.isTrusted){throw new Error('Trusted workspace required.');}
    const selected=await vscode.window.showOpenDialog({canSelectFiles:true,canSelectFolders:false,canSelectMany:false,filters:{'Vinculivo context':['json']},openLabel:'Import decision register'});
    if(!selected?.length){return;}
    const uri=selected[0];if(!['file','vscode-remote'].includes(uri.scheme)){throw new Error('Import from a local/remote file, not an executable URL.');}
    const stat=await vscode.workspace.fs.stat(uri);if(stat.size>600_000){throw new Error('Context bundle exceeds the 600 KB import limit.');}
    const bytes=await vscode.workspace.fs.readFile(uri);if(bytes.byteLength>600_000){throw new Error('Context bundle exceeds the 600 KB import limit.');}
    const incoming=importContextBundle(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown);
    const approval=await vscode.window.showWarningMessage(`Import ${incoming.length} decisions into ${target.name} as UNREVIEWED proposals? Identical IDs will be updated.`,{modal:true},'Import as proposals');
    if(approval!=='Import as proposals'){return;}
    for(const d of incoming){await store.saveDecision(target,d);}
    await refreshDecisions();toast(`${incoming.length} decisions imported; human review required.`);
  }

  async function importEvidence():Promise<void>{
    const target=folder();if(!target||!vscode.workspace.isTrusted){throw new Error('Trusted workspace required.');}
    const chosen=await vscode.window.showOpenDialog({canSelectFiles:true,canSelectFolders:false,canSelectMany:false,defaultUri:target.uri,filters:{'JSON evidence':['json']},openLabel:'Import local evidence'});
    if(!chosen?.length){return;}
    const uri=chosen[0];if(!(await isWithinFolder(target,uri))){throw new Error('Import must be a file inside the trusted workspace.');}
    const stat=await vscode.workspace.fs.stat(uri);if(stat.size>100_000){throw new Error('Evidence report exceeds the 100 KB limit.');}
    const raw=await vscode.workspace.fs.readFile(uri);if(raw.byteLength>100_000){throw new Error('Evidence report exceeds 100 KB.');}
    const source=vscode.workspace.asRelativePath(uri,false);
    const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)) as unknown;
    const normalized=normalizeEvidenceReport(parsed,source,now());
    await store.addEvidence(target,normalized);await refreshDecisions();toast('Evidence imported as user-supplied report (not independently verified).');
  }
  async function removeEvidence(id:string):Promise<void>{
    const target=folder();if(!target||!vscode.workspace.isTrusted){return;}
    const yes=await vscode.window.showWarningMessage('Remove this locally imported evidence report?',{modal:true},'Remove report');
    if(yes!=='Remove report'){return;}
    await store.removeEvidence(target,id);await refreshDecisions();
  }
  async function collectRegisteredEvidence():Promise<void>{
    const target=folder();if(!target||!vscode.workspace.isTrusted){throw new Error('Trusted workspace required.');}
    if(!providers.size){void vscode.window.showInformationMessage('No compatible evidence providers registered. Use Import JSON evidence.');return;}
    const names=[...providers.keys()];const selected=await vscode.window.showQuickPick(names,{placeHolder:'Choose a registered provider to request a report from'});
    if(!selected){return;}
    const provider=providers.get(selected);if(!provider){return;}
    const reports=await provider.collect();
    if(!Array.isArray(reports)||reports.length>30){throw new Error('Provider must return an array of 30 or fewer evidence reports.');}
    for(const report of reports){const normalized=normalizeEvidenceReport(report,`registered provider: ${provider.name}`,now());await store.addEvidence(target,normalized);}
    await refreshDecisions();toast(`Imported ${reports.length} reports from ${selected}.`);
  }

  async function receiveMessage(raw:unknown):Promise<void>{
    if(!raw||typeof raw!=='object'||typeof (raw as Message).type!=='string'){return;}
    const m=raw as Message;
    try{
      switch(m.type){
        case 'scan':await scan();break;
        case 'folder':{
          if(!Number.isInteger(m.index)||m.index === undefined || m.index<0 || m.index>=folders().length){break;}
          folderIndex=m.index;refreshWorkspace();break;
        }
        case 'open':if(typeof m.id==='string'){await openSource(m.id);}break;
        case 'save-decision':await saveDecision(m);break;
        case 'review':if(typeof m.id==='string'){await reviewDecision(m.id);}break;
        case 'status':if(typeof m.id==='string'&&typeof m.status==='string'){await statusDecision(m.id,m.status);}break;
        case 'remove':if(typeof m.id==='string'){await removeDecision(m.id);}break;
        case 'preflight':generate(cleanUserText(m.task,300),m.profile??'generic',m.tokenBudget??3000);break;
        case 'copy':await copy();break;
        case 'export-decisions':await exportDecisions();break;
        case 'import-decisions':await importDecisions();break;
        case 'import-evidence':await importEvidence();break;
        case 'remove-evidence':if(typeof m.id==='string'){await removeEvidence(m.id);}break;
        case 'collect-evidence':await collectRegisteredEvidence();break;
      }
    }catch(error){showError(error);}
  }
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vinculivo.launcher',new Launcher()),
    vscode.commands.registerCommand('vinculivo.openControlCenter',openCenter),
    vscode.commands.registerCommand('vinculivo.scan',async()=>{openCenter();await scan();}),
    vscode.commands.registerCommand('vinculivo.copyHandoff',async()=>{try{await copy();}catch(e){showError(e);}}),
    vscode.commands.registerCommand('vinculivo.collectEvidence',async()=>{try{await collectRegisteredEvidence();}catch(e){showError(e);}}),
    vscode.workspace.onDidChangeWorkspaceFolders(()=>refreshWorkspace()),
    vscode.workspace.onDidGrantWorkspaceTrust(()=>refreshWorkspace())
  );
  refreshWorkspace();
  return {registerEvidenceProvider(name:string,collect:()=>Promise<unknown[]>):vscode.Disposable{
    const safe=cleanUserText(name,60);if(!safe||typeof collect!=='function'){throw new Error('Invalid evidence provider registration.');}
    if(providers.has(safe)){throw new Error(`Provider already registered: ${safe}`);}
    providers.set(safe,{name:safe,collect});return new vscode.Disposable(()=>providers.delete(safe));
  }};
}
export function deactivate():void{/* No persistent process, network session or background task. */}
