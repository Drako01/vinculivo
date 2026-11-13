'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isRelevantMarkdown, indexMarkdown, sanitizeExcerpt, selectContext, buildHandoff, sha256 } = require('../dist/core.js');

test('indexes agent instructions and ADR with source lines', () => {
  const items = indexMarkdown('AGENTS.md', '# Rules\nKeep tests local.\n## CI\nReuse verified results.');
  assert.equal(items.length, 2);
  assert.equal(items[1].line, 3);
  assert.equal(items[0].category, 'Agent instructions');
  assert.equal(items[0].file, 'AGENTS.md');
});
test('filters documentation by allowlist, not arbitrary private files', () => {
  assert.equal(isRelevantMarkdown('docs/adr/001.md'), true);
  assert.equal(isRelevantMarkdown('CLAUDE.md'), true);
  assert.equal(isRelevantMarkdown('README.md'), true);
  assert.equal(isRelevantMarkdown('src/secret.md'), false);
  assert.equal(isRelevantMarkdown('node_modules/lib/AGENTS.md'), false);
});
test('heuristically redacts credential-like lines', () => {
  const clean = sanitizeExcerpt('Architecture\nAPI_KEY = super-sensitive\nregular information\n-----BEGIN PRIVATE KEY-----');
  assert.doesNotMatch(clean, /super-sensitive|BEGIN PRIVATE KEY/);
  assert.match(clean, /regular information/);
});
test('prioritizes relevant context and preserves source fingerprints', () => {
  const items = [...indexMarkdown('docs/adr/001.md', '# API Authorization\nCompany-scoped JWT.'), ...indexMarkdown('README.md', '# Installation\nRun npm install.')];
  const selected = selectContext(items, 'authorization');
  assert.equal(selected[0].title, 'API Authorization');
  assert.equal(selected.length, 1);
  assert.equal(items[0].digest.length, 12);
  assert.equal(sha256('a'), sha256('a'));
});
test('handoff has evidence, task and bounded length', () => {
  const items = indexMarkdown('AGENTS.md', '# Rules\nNever skip important tests.');
  const result = buildHandoff('project', items, 'tests', 1000, 'a'.repeat(40));
  assert.match(result, /AGENTS\.md:1/);
  assert.match(result, /Git HEAD:/);
  assert.ok(result.length <= 1000);
});
test('does not fabricate evidence for empty files', () => {
  assert.deepEqual(indexMarkdown('README.md', '# Just title'), []);
});
