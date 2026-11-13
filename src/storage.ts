import * as vscode from 'vscode';
import { sha256 } from './core';
import { Decision, EvidenceReport, normalizeStoredDecisions } from './intelligence';
const key=(folder:vscode.WorkspaceFolder,kind:string):string=>`vinculivo.v2.${kind}.${sha256(folder.uri.toString())}`;
export class WorkspaceStore {
  constructor(private readonly memento:vscode.Memento){}
  decisions(folder:vscode.WorkspaceFolder):Decision[]{return normalizeStoredDecisions(this.memento.get(key(folder,'decisions'),[]));}
  async saveDecision(folder:vscode.WorkspaceFolder,decision:Decision):Promise<void>{
    const all=this.decisions(folder),i=all.findIndex(d=>d.id===decision.id);
    if(i>=0){all[i]=decision;}else if(all.length<150){all.push(decision);}else{throw new Error('Decision limit (150) reached; archive or remove a record.');}
    await this.memento.update(key(folder,'decisions'),all);
  }
  async removeDecision(folder:vscode.WorkspaceFolder,id:string):Promise<void>{
    await this.memento.update(key(folder,'decisions'),this.decisions(folder).filter(d=>d.id!==id));
  }
  evidence(folder:vscode.WorkspaceFolder):EvidenceReport[]{
    const value=this.memento.get<unknown>(key(folder,'evidence'),[]);
    if(!Array.isArray(value)){return [];}
    return value.filter((x):x is EvidenceReport=>x && typeof x==='object'&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.summary==='string'&&typeof x.provider==='string'&&typeof x.source==='string').slice(0,100);
  }
  async addEvidence(folder:vscode.WorkspaceFolder,report:EvidenceReport):Promise<void>{
    const all=this.evidence(folder).filter(e=>e.id!==report.id);all.unshift(report);
    await this.memento.update(key(folder,'evidence'),all.slice(0,100));
  }
  async removeEvidence(folder:vscode.WorkspaceFolder,id:string):Promise<void>{await this.memento.update(key(folder,'evidence'),this.evidence(folder).filter(e=>e.id!==id));}
}
