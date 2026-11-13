import * as vscode from 'vscode';
import { buildHandoff, ContextRecord } from './core';
import { scanWorkspace, ScanResult } from './scan';
import { renderControlCenter, ViewState } from './ui';

const EMPTY_STATE: ViewState = { project: 'No workspace', records: [], files: 0, changed: 0, scanned: false };

class Launcher implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(item: vscode.TreeItem): vscode.TreeItem { return item; }
  getChildren(): vscode.TreeItem[] {
    const item = new vscode.TreeItem('Open Vinculivo Control Center', vscode.TreeItemCollapsibleState.None);
    item.command = { command: 'vinculivo.openControlCenter', title: 'Open Vinculivo Control Center' };
    item.iconPath = new vscode.ThemeIcon('link');
    return [item];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  let panel: vscode.WebviewPanel | undefined;
  let current: ScanResult | undefined;
  let view: ViewState = { ...EMPTY_STATE };

  function folder(): vscode.WorkspaceFolder | undefined {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    return (activeUri ? vscode.workspace.getWorkspaceFolder(activeUri) : undefined) ?? vscode.workspace.workspaceFolders?.[0];
  }
  function render(): void { if (panel) { panel.webview.html = renderControlCenter(view); } }

  async function scan(): Promise<void> {
    const target = folder();
    if (!target) {
      view = { ...EMPTY_STATE, error: 'Open a local workspace folder to begin.' };
      render(); return;
    }
    const previous = current;
    try {
      const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Vinculivo: indexing local documentation', cancellable: false }, () => scanWorkspace(target, context.workspaceState));
      current = result;
      view = { project: target.name, records: result.records, files: result.files, changed: result.changed, head: result.head, scanned: true };
      render();
      void vscode.window.showInformationMessage(`Vinculivo: indexed ${result.files} documents and ${result.records.length} sections locally.`);
    } catch (error) {
      current = previous;
      view = { ...view, error: error instanceof Error ? error.message : String(error) };
      render();
    }
  }

  function openCenter(): void {
    if (panel) { panel.reveal(vscode.ViewColumn.One); return; }
    const target = folder();
    view = { ...EMPTY_STATE, project: target?.name ?? 'No workspace' };
    panel = vscode.window.createWebviewPanel('vinculivo.controlCenter', 'Vinculivo · Control Center', vscode.ViewColumn.One, {
      enableScripts: true, retainContextWhenHidden: true, localResourceRoots: []
    });
    panel.onDidDispose(() => { panel = undefined; }, undefined, context.subscriptions);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!message || typeof message !== 'object' || !('type' in message)) { return; }
      const value = message as { type: string; id?: string; task?: string };
      if (value.type === 'scan') { void scan(); }
      if (value.type === 'copy') { void copyHandoff(typeof value.task === 'string' ? value.task : ''); }
      if (value.type === 'open' && typeof value.id === 'string') { void openSource(value.id); }
    }, undefined, context.subscriptions);
    render();
  }

  async function openSource(id: string): Promise<void> {
    if (!current || !vscode.workspace.isTrusted) { return; }
    const record: ContextRecord | undefined = current.records.find(r => r.id === id);
    if (!record || record.file.includes('..') || record.file.startsWith('/')) { return; }
    const uri = vscode.Uri.joinPath(current.folder.uri, record.file);
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { selection: new vscode.Range(Math.max(0, record.line - 1), 0, Math.max(0, record.line - 1), 0), preview: true });
    } catch { void vscode.window.showWarningMessage(`Vinculivo: source no longer available: ${record.file}`); }
  }

  async function copyHandoff(task: string): Promise<void> {
    if (!vscode.workspace.isTrusted) { void vscode.window.showWarningMessage('Vinculivo requires a trusted workspace to export context.'); return; }
    if (!current) { void vscode.window.showWarningMessage('Scan your project documentation before exporting context.'); return; }
    const budget = vscode.workspace.getConfiguration('vinculivo').get<number>('maxHandoffChars', 12000);
    const content = buildHandoff(current.folder.name, current.records, task, budget, current.head);
    await vscode.env.clipboard.writeText(content);
    void vscode.window.showInformationMessage(`Vinculivo: handoff copied (${content.length} characters). Review before sharing.`);
  }

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vinculivo.launcher', new Launcher()),
    vscode.commands.registerCommand('vinculivo.openControlCenter', openCenter),
    vscode.commands.registerCommand('vinculivo.scan', async () => { openCenter(); await scan(); }),
    vscode.commands.registerCommand('vinculivo.copyHandoff', () => copyHandoff('')),
    vscode.workspace.onDidGrantWorkspaceTrust(() => { current = undefined; view = { ...EMPTY_STATE, project: folder()?.name ?? 'No workspace' }; render(); })
  );
}

export function deactivate(): void { /* No external process or persistent connection. */ }
