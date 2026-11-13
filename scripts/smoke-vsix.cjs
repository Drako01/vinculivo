'use strict';
/** Small dependency-free VSIX inventory gate; runs only on candidate packaging, not on every unit test. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const file=process.argv[2];
function fail(reason){console.error(`VSIX smoke failed: ${reason}`);process.exit(1)}
if(!file||!fs.existsSync(file))fail('candidate missing');
const buffer=fs.readFileSync(file);
if(buffer.length<4000||buffer.readUInt32LE(0)!==0x04034b50)fail('invalid ZIP local header');
const end=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
if(end<0||end+22>buffer.length)fail('ZIP central directory missing');
const centralStart=buffer.readUInt32LE(end+16),entryCount=buffer.readUInt16LE(end+10);
if(entryCount<3||entryCount>800)fail(`unexpected ZIP entry count ${entryCount}`);
const entries=new Map();let pos=centralStart;
for(let i=0;i<entryCount;i++){
 if(pos+46>buffer.length||buffer.readUInt32LE(pos)!==0x02014b50)fail('broken ZIP central entry');
 const compression=buffer.readUInt16LE(pos+10),length=buffer.readUInt32LE(pos+20),nameLen=buffer.readUInt16LE(pos+28),extraLen=buffer.readUInt16LE(pos+30),commentLen=buffer.readUInt16LE(pos+32),offset=buffer.readUInt32LE(pos+42);
 const name=buffer.subarray(pos+46,pos+46+nameLen).toString('utf8');if(name.includes('..')||name.startsWith('/'))fail('unsafe archive entry path');
 entries.set(name,{compression,length,offset});pos+=46+nameLen+extraLen+commentLen;
}
for(const required of ['extension/package.json','extension/dist/extension.js','extension/media/brand/vinculivo-activity-bar.svg','extension/media/brand/vinculivo-icon-256.png']){
 if(!entries.has(required))fail('missing '+required);
}
for(const disallowed of ['extension/src/extension.ts','extension/test/core.test.cjs','extension/.github/workflows/ci.yml']){if(entries.has(disallowed))fail('packaged development file '+disallowed)}
function extract(name){const x=entries.get(name);let n=x.offset;if(buffer.readUInt32LE(n)!==0x04034b50)fail('invalid local entry '+name);n+=30+buffer.readUInt16LE(n+26)+buffer.readUInt16LE(n+28);const bytes=buffer.subarray(n,n+x.length);return x.compression===8?zlib.inflateRawSync(bytes):x.compression===0?bytes:fail('unsupported ZIP compression')}
const manifest=JSON.parse(extract('extension/package.json').toString('utf8'));
if(manifest.name!=='vinculivo'||!manifest.contributes?.viewsContainers?.activitybar?.[0]?.icon?.endsWith('vinculivo-activity-bar.svg'))fail('invalid extension manifest or icon');
const icon=extract('extension/media/brand/vinculivo-activity-bar.svg').toString('utf8');
if(!icon.includes('circle cx="12" cy="12"')||!icon.includes('currentColor')||icon.includes('M7 7.5 12 4'))fail('outdated or nonmonochrome Activity Bar icon');
const sha=crypto.createHash('sha256').update(buffer).digest('hex');fs.writeFileSync(`${file}.sha256`,`${sha}  ${file}\n`);
console.log(`VSIX ${file} PASS: ${entryCount} entries; ${buffer.length} bytes; SHA-256 ${sha}`);
