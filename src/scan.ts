import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ContextRecord, indexMarkdown, isRelevantMarkdown, sha256 } from './core';
const execFileAsync = promisify(execFile);

export interface ScanResult { folder: vscode.WorkspaceFolder; records: ContextRecord[]; files: number; changed: number; head?: string; }
const PREVIOUS_HASHES_KEY = 'vinculivo.previousHashes.v1';

export async function scanWorkspace(folder: vscode.WorkspaceFolder, state: vscode.Memento): Promise<ScanResult> {
  if (!vscode.workspace.isTrusted) { throw new Error('Trust the workspace before indexing local documents.'); }
  if (folder.uri.scheme !== 'file') { throw new Error('Version 0.1.0 supports local file workspaces only.'); }
  const patterns = new vscode.RelativePattern(folder, '**/*.md');
  const excluded = '**/{node_modules,.git,dist,build,out,vendor,coverage,.next}/**';
  const candidates = await vscode.workspace.findFiles(patterns, excluded, 500);
  const previous = state.get<Record<string, string>>(PREVIOUS_HASHES_KEY, {});
  const next = { ...previous };
  const records: ContextRecord[] = [];
  let changed = 0; let files = 0;
  const root = folder.uri.path.replace(/\/$/, '') + '/';
  for (const uri of candidates) {
    if (files >= 120) { break; }
    const path = uri.path.startsWith(root) ? uri.path.slice(root.length) : '';
    if (!path || !isRelevantMarkdown(path)) { continue; }
    const stat = await Promise.resolve(vscode.workspace.fs.stat(uri)).catch(() => undefined);
    if (!stat || stat.size > 100_000) { continue; }
    const raw = await Promise.resolve(vscode.workspace.fs.readFile(uri)).catch(() => undefined);
    if (!raw) { continue; }
    const content = new TextDecoder('utf-8', { fatal: false }).decode(raw);
    const key = `${folder.uri.toString()}/${path}`;
    const digest = sha256(content);
    const changedFromPrevious = Boolean(previous[key] && previous[key] !== digest);
    if (changedFromPrevious) { changed++; }
    next[key] = digest; files++;
    records.push(...indexMarkdown(path, content, changedFromPrevious));
  }
  await state.update(PREVIOUS_HASHES_KEY, next);
  let head: string | undefined;
  try {
    const result = await execFileAsync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: folder.uri.fsPath, timeout: 2500, windowsHide: true });
    head = result.stdout.trim().match(/^[a-f0-9]{40,64}$/)?.[0];
  } catch { /* Git is optional. */ }
  return { folder, files, records, changed, head };
}
