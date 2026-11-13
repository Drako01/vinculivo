import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { ContextRecord, indexMarkdown, isRelevantMarkdown, sha256 } from './core';
import { safeRelativePath } from './intelligence';
const execFileAsync = promisify(execFile);
const MAX_DISCOVERED = 900;
const MAX_FILES = 180;
const MAX_FILE_BYTES = 150_000;
const previousKey = (folder: vscode.WorkspaceFolder) => `vinculivo.hashes.v2.${sha256(folder.uri.toString())}`;

export interface ScanResult {
  folder: vscode.WorkspaceFolder;
  records: ContextRecord[];
  files: number;
  changed: number;
  removed: number;
  head?: string;
  partial: boolean;
  skipped: number;
  scannedAt: string;
}

/** Validate both VS Code URI containment and real filesystem containment (symlink defense). */
export async function isWithinFolder(folder: vscode.WorkspaceFolder, uri: vscode.Uri): Promise<boolean> {
  if (folder.uri.scheme !== uri.scheme || folder.uri.authority !== uri.authority) { return false; }
  const base=folder.uri.path.replace(/\/$/,'')+'/';
  if (!uri.path.startsWith(base) || !safeRelativePath(uri.path.slice(base.length))) { return false; }
  if (folder.uri.scheme !== 'file') { return true; } // remote file service remains responsible for access
  try {
    const [actualRoot,actualFile]=await Promise.all([fs.realpath(folder.uri.fsPath),fs.realpath(uri.fsPath)]);
    const relative=path.relative(actualRoot,actualFile);
    return !!relative && relative !== '..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);
  } catch { return false; }
}
export async function readFingerprint(folder: vscode.WorkspaceFolder, relativePath: string): Promise<string | undefined> {
  const normalized=safeRelativePath(relativePath);
  if(!normalized || normalized.endsWith('/**')) { return; }
  const uri=vscode.Uri.joinPath(folder.uri,...normalized.split('/'));
  if(!(await isWithinFolder(folder,uri))){return;}
  try {
    const stat=await vscode.workspace.fs.stat(uri);
    if(stat.size>500_000 || (stat.type & vscode.FileType.File)===0){return;}
    const bytes=await vscode.workspace.fs.readFile(uri);
    return createHash('sha256').update(bytes).digest('hex');
  }catch{return;}
}
async function git(folder:vscode.WorkspaceFolder,args:string[]):Promise<string|undefined>{
  if(folder.uri.scheme!=='file'){return;}
  try{ const r=await execFileAsync('git',args,{cwd:folder.uri.fsPath,timeout:4500,windowsHide:true,maxBuffer:350_000});return r.stdout;}
  catch{return;}
}
export async function gitHead(folder:vscode.WorkspaceFolder):Promise<string|undefined>{
  return (await git(folder,['rev-parse','--verify','HEAD']))?.trim().match(/^[a-f\d]{40,64}$/)?.[0];
}
/** Returns undefined if the comparison cannot be proven, rather than falsely reporting no changes. */
export async function changedPathsSince(folder:vscode.WorkspaceFolder,base:string,head:string|undefined):Promise<string[]|undefined>{
  if(!head || !/^[a-f\d]{40,64}$/.test(base)){return;}
  const committed=await git(folder,['diff','--name-only','-z',base,head,'--']);
  const working=await git(folder,['diff','--name-only','-z','HEAD','--']);
  const untracked=await git(folder,['ls-files','--others','--exclude-standard','-z','--']);
  if(committed===undefined || working===undefined || untracked===undefined){return;}
  return [...new Set((committed+working+untracked).split('\0').map(s=>safeRelativePath(s)).filter((s):s is string=>!!s))].slice(0,1200);
}
export async function scanWorkspace(folder:vscode.WorkspaceFolder,state:vscode.Memento,token?:vscode.CancellationToken):Promise<ScanResult>{
  if(!vscode.workspace.isTrusted){throw new Error('Trust the workspace before indexing its documentation.');}
  if(!['file','vscode-remote'].includes(folder.uri.scheme)){throw new Error('Unsupported workspace scheme: only local or remote file workspaces are readable.');}
  const files=await vscode.workspace.findFiles(new vscode.RelativePattern(folder,'**/*.md'),
    '**/{.git,node_modules,dist,build,out,vendor,coverage,.next,.vscode-test}/**',MAX_DISCOVERED);
  const previous=state.get<Record<string,string>>(previousKey(folder),{});
  const next:Record<string,string>={};
  let count=0,changed=0,skipped=0,partial=files.length>=MAX_DISCOVERED;
  const records:ContextRecord[]=[];
  const root=folder.uri.path.replace(/\/$/,'')+'/';
  for(const uri of files){
    if(token?.isCancellationRequested){throw new Error('Indexing cancelled; the previous scan was retained.');}
    const relative=uri.path.startsWith(root)?uri.path.slice(root.length):'';
    if(!relative || !isRelevantMarkdown(relative)){continue;}
    if(count>=MAX_FILES){partial=true;skipped++;continue;}
    if(!(await isWithinFolder(folder,uri))){skipped++;continue;}
    try{
      const stat=await vscode.workspace.fs.stat(uri);
      if(stat.size>MAX_FILE_BYTES || (stat.type & vscode.FileType.File)===0){skipped++;continue;}
      const data=await vscode.workspace.fs.readFile(uri);
      if(data.byteLength>MAX_FILE_BYTES){skipped++;continue;}
      const content=new TextDecoder('utf-8',{fatal:false}).decode(data);
      const digest=sha256(content);
      const modified=!!previous[relative] && previous[relative]!==digest;
      if(modified){changed++;}
      next[relative]=digest;count++;
      records.push(...indexMarkdown(relative,content,modified));
    }catch{skipped++;}
  }
  const removed=(partial||skipped>0)?0:Object.keys(previous).filter(p=>!next[p]).length;
  await state.update(previousKey(folder),next);
  return {folder,records,files:count,changed,removed,partial,skipped,head:await gitHead(folder),scannedAt:new Date().toISOString()};
}
