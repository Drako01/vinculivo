'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('Activity Bar selection opens and reuses central Control Center without an extra launcher click', async () => {
  let onVisibility;
  const invoked = [];
  const commands = new Map();
  const panels = [];
  let treeViewCreated = 0;
  let treeDisposed = false;
  const disposable = () => ({ dispose() {} });
  const api = {
    ViewColumn: { One: 1 },
    TreeItemCollapsibleState: { None: 0 },
    ThemeIcon: class ThemeIcon { constructor(id) { this.id = id; } },
    TreeItem: class TreeItem {
      constructor(label, collapsibleState) { this.label = label; this.collapsibleState = collapsibleState; }
    },
    workspace: {
      workspaceFolders: [],
      isTrusted: true,
      onDidChangeWorkspaceFolders: disposable,
      onDidGrantWorkspaceTrust: disposable,
    },
    window: {
      createTreeView(id, options) {
        assert.equal(id, 'vinculivo.launcher');
        treeViewCreated++;
        assert.equal(options.treeDataProvider.getChildren()[0].command.command, 'vinculivo.openControlCenter');
        return {
          onDidChangeVisibility(listener) { onVisibility = listener; return disposable(); },
          dispose() { treeDisposed = true; },
        };
      },
      createWebviewPanel(type, title, column) {
        assert.equal(type, 'vinculivo.controlCenter');
        assert.equal(column, 1);
        const panel = {
          reveals: 0,
          reveal() { this.reveals++; },
          onDidDispose() { return disposable(); },
          webview: { html: '', onDidReceiveMessage() { return disposable(); }, postMessage() { return Promise.resolve(true); } },
        };
        panels.push(panel);
        return panel;
      },
      showErrorMessage() { return Promise.resolve(); },
    },
    commands: {
      registerCommand(name, callback) { commands.set(name, callback); return disposable(); },
      executeCommand(name) { invoked.push(name); return Promise.resolve(); },
    },
  };
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === 'vscode') return api;
    return originalLoad.call(this, request, parent, isMain);
  };
  let extension;
  try {
    delete require.cache[require.resolve('../dist/extension.js')];
    extension = require('../dist/extension.js');
  } finally {
    Module._load = originalLoad;
  }
  const subscriptions = [];
  extension.activate({
    subscriptions,
    workspaceState: { get(_key, fallback) { return fallback; }, update() { return Promise.resolve(); } },
  });
  assert.equal(treeViewCreated, 1);
  assert.equal(typeof onVisibility, 'function');
  onVisibility({ visible: false });
  assert.equal(panels.length, 0, 'hidden view does not open editor');

  onVisibility({ visible: true });
  assert.equal(panels.length, 1, 'first Activity Bar selection immediately creates editor');
  assert.match(panels[0].webview.html, /Vinculivo/);
  assert.deepEqual(invoked, ['workbench.action.closeSidebar']);

  onVisibility({ visible: false });
  onVisibility({ visible: true });
  assert.equal(panels.length, 1, 'returning to Activity Bar reuses the panel');
  assert.equal(panels[0].reveals, 1, 'existing panel is focused');
  assert.equal(invoked.length, 2, 'sidebar is closed to allow future clicks');

  commands.get('vinculivo.openControlCenter')();
  assert.equal(panels[0].reveals, 2, 'command-palette fallback still works');
  assert.equal(invoked.length, 2, 'command palette does not unexpectedly close sidebar');
  subscriptions.forEach(item => item.dispose());
  assert.equal(treeDisposed, true);
});
