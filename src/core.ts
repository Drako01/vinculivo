import { createHash } from 'node:crypto';

export type RecordCategory = 'Agent instructions' | 'Architecture decision' | 'Project documentation';
export interface ContextRecord {
  id: string;
  file: string;
  line: number;
  title: string;
  excerpt: string;
  digest: string;
  category: RecordCategory;
  changedSinceLastScan: boolean;
}

const SECRET = /\b(?:api[_-]?key|access[_-]?token|secret|password|private[_-]?key|client[_-]?secret|authorization)\b\s*(?:[:=]|\s+is\s+)/i;
const PRIVATE_KEY = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/i;
const MAX_SECTION_CHARS = 1600;

export function sha256(input: string): string { return createHash('sha256').update(input, 'utf8').digest('hex'); }

export function isRelevantMarkdown(file: string): boolean {
  const f = file.replace(/\\/g, '/');
  if (/(^|\/)(?:node_modules|dist|build|out|vendor|coverage|\.git|\.next)\//i.test(f)) { return false; }
  if (/(^|\/)(?:AGENTS|CLAUDE)\.md$/i.test(f)) { return true; }
  if (/^README\.md$/i.test(f)) { return true; }
  if (/(^|\/)docs\/(?:adr|adrs|architecture|decisions|design)(?:\/|\.)/i.test(f)) { return true; }
  if (/(^|\/)docs\/[^/]*(?:adr|decision|architecture|design)[^/]*\.md$/i.test(f)) { return true; }
  return false;
}

export function sanitizeExcerpt(input: string): string {
  return input.split(/\r?\n/).map(line => SECRET.test(line) || PRIVATE_KEY.test(line) ? '[REDACTED: potential credential]' : line)
    .join('\n').replace(/\u0000/g, '').slice(0, MAX_SECTION_CHARS);
}

export function indexMarkdown(file: string, rawText: string, changedSinceLastScan = false): ContextRecord[] {
  const text = rawText.slice(0, 100_000);
  const lines = text.split(/\r?\n/);
  const boundaries = lines.flatMap((line, i) => /^#{1,3}\s+\S/.test(line) ? [{ line: i, title: line.replace(/^#{1,3}\s+/, '').trim() }] : []);
  if (boundaries.length === 0) { boundaries.push({ line: 0, title: file.split('/').at(-1) ?? file }); }
  const agent = /(?:^|\/)(?:AGENTS|CLAUDE)\.md$/i.test(file);
  const category: RecordCategory = agent ? 'Agent instructions' : /(?:adr|decision)/i.test(file) ? 'Architecture decision' : 'Project documentation';
  const records: ContextRecord[] = [];
  for (let i = 0; i < Math.min(boundaries.length, 40); i++) {
    const start = boundaries[i].line;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].line : lines.length;
    const content = lines.slice(start + (start !== 0 || /^#{1,3} /.test(lines[start]) ? 1 : 0), end).join('\n').trim();
    if (!content) { continue; }
    const excerpt = sanitizeExcerpt(content);
    records.push({
      id: sha256(`${file}:${start + 1}:${boundaries[i].title}`).slice(0, 16),
      file, line: start + 1, title: boundaries[i].title,
      excerpt, digest: sha256(content).slice(0, 12), category, changedSinceLastScan
    });
  }
  return records;
}

function words(text: string): string[] { return (text.toLocaleLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) ?? []).slice(0, 24); }

export function selectContext(records: readonly ContextRecord[], query: string, maxRecords = 18): ContextRecord[] {
  const terms = [...new Set(words(query))];
  const score = (r: ContextRecord): number => {
    let n = r.category === 'Agent instructions' ? 4 : r.category === 'Architecture decision' ? 2 : 0;
    const title = r.title.toLocaleLowerCase(); const path = r.file.toLocaleLowerCase(); const body = r.excerpt.toLocaleLowerCase();
    for (const t of terms) { if (title.includes(t)) { n += 20; } if (path.includes(t)) { n += 8; } if (body.includes(t)) { n += 2; } }
    return n;
  };
  return records.map(r => ({ r, s: score(r) })).filter(x => terms.length === 0 || x.s >= (x.r.category === 'Agent instructions' ? 6 : 2))
    .sort((a, b) => b.s - a.s || a.r.file.localeCompare(b.r.file) || a.r.line - b.r.line)
    .slice(0, maxRecords).map(x => x.r);
}

export function buildHandoff(project: string, records: readonly ContextRecord[], query: string, maxChars: number, commit?: string): string {
  const cap = Math.max(1000, Math.min(50000, Math.trunc(maxChars)));
  const header = [
    '# Vinculivo — Project Context Handoff', '',
    `Project: ${project.replace(/[\r\n]/g, ' ')}`,
    `Git HEAD: ${commit || 'unavailable (not verified)'}`,
    `Task: ${query.trim().replace(/[\r\n]/g, ' ').slice(0, 300) || 'not specified'}`,
    '', '> Evidence comes from local Markdown documents. It is not a guarantee of correctness or current validity.',
    '> Review sources before applying decisions. Nothing here replaces tests.', ''
  ].join('\n');
  let output = header;
  for (const r of selectContext(records, query)) {
    const piece = `## ${r.title}\nSource: ${r.file}:${r.line} · SHA-256 excerpt source: ${r.digest}${r.changedSinceLastScan ? ' · CHANGED SINCE PREVIOUS SCAN' : ''}\n${r.excerpt}\n\n`;
    if (output.length + piece.length > cap) { break; }
    output += piece;
  }
  return output.slice(0, cap);
}
