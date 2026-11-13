'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('Missing VSIX candidate'); process.exit(1); }
const buffer = fs.readFileSync(file);
if (buffer.length < 2000 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) { console.error('Invalid VSIX/ZIP signature or size'); process.exit(1); }
const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
fs.writeFileSync(`${file}.sha256`, `${sha256}  ${file}\n`);
console.log(`VSIX candidate: ${file}, ${buffer.length} bytes, SHA-256 ${sha256}`);
