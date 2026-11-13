#!/usr/bin/env python3
"""Capture the actual Vinculivo Webview renderer using deterministic synthetic data.

Requires: python3 -m pip install playwright ; playwright install chromium
Or use any system Chromium with VINCULIVO_CHROMIUM=/path/to/chromium.
This is a Webview-renderer capture, NOT a VS Code Extension Host screenshot.
No real repositories, account data, remote services, or telemetry are used.
"""
from pathlib import Path
import os
import subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'media' / 'screenshots'
TARGET.mkdir(parents=True, exist_ok=True)
HTML = ROOT / '.screenshot-render.html'
node_script = "const fs=require('fs');const state=require('./scripts/readme-fixture.cjs').state;const {renderControlCenter}=require('./dist/ui.js');fs.writeFileSync('.screenshot-render.html',renderControlCenter(state));"
subprocess.run(['node', '-e', node_script], cwd=ROOT, check=True)
shots = [
    ('overview', '01-control-center-overview.png'),
    ('decisions', '02-decision-register.png'),
    ('preflight', '03-preflight-handoff.png'),
    ('evidence', '04-evidence-registry.png'),
]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=os.environ.get('VINCULIVO_CHROMIUM') or None, args=['--no-sandbox','--disable-gpu'])
        page = browser.new_page(viewport={'width':1440,'height':980},device_scale_factor=1)
        page.add_init_script("window.acquireVsCodeApi = () => ({ postMessage: () => {}, getState: () => null, setState: () => {} });")
        errors=[]
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        page.goto('about:blank')
        page.set_content(HTML.read_text(encoding='utf-8'), wait_until='load')
        page.locator('[data-tab="overview"]').wait_for()
        for tab,filename in shots:
            page.get_by_role('tab', name={'overview':'Overview','decisions':'Decisions','preflight':'Preflight & handoff','evidence':'Evidence'}[tab]).click()
            page.wait_for_timeout(150)
            if tab == 'preflight':
                page.locator('#task').fill('Review tenant authorization without breaking API contracts')
                page.locator('#profile').select_option('codex')
            page.screenshot(path=str(TARGET / filename),full_page=True,animations='disabled')
            print(f'{filename} { (TARGET / filename).stat().st_size } bytes, page title: {page.locator("#page-title").inner_text()}')
        browser.close()
        if errors:
            raise RuntimeError('Webview JavaScript errors: '+repr(errors))
finally:
    HTML.unlink(missing_ok=True)
