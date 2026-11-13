#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(repo,p));
const icon = read('media/brand/vinculivo-icon-256.png');
assert.equal(icon.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Official PNG signature');
assert.equal(icon.readUInt32BE(16),256,'Official PNG width');
assert.equal(icon.readUInt32BE(20),256,'Official PNG height');
assert.equal(crypto.createHash('sha256').update(icon).digest('hex'),'5af00f9e004fa9a00a62c7d88bf47ca961e54029372aed714e6e646648dc6827','Approved icon must be immutable');
const svg = read('media/brand/vinculivo-activity-bar.svg').toString('utf8');
assert.match(svg,/viewBox="0 0 24 24"/);
assert.match(svg,/currentColor/);
assert.match(svg,/circle cx="12" cy="12"/);
assert.doesNotMatch(svg,/M7 7\.5 12 4/,'The cube motif must never return');
for(const f of ['vinculivo-lockup-dark.svg','vinculivo-lockup-light.svg','vinculivo-moodboard.svg']){
 const text = read('media/brand/'+f).toString('utf8');
 assert.match(text,/<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
 assert.match(text,/data:image\/png;base64,/,'Embed approved logo rather than replace it');
}
const mood = read('media/brand/vinculivo-moodboard.png');
assert.equal(mood.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Moodboard PNG signature');
assert.ok(mood.length>20_000,'Moodboard PNG should not be empty');
const pkg = JSON.parse(read('package.json').toString('utf8'));
assert.equal(pkg.icon,'media/brand/vinculivo-icon-256.png');
assert.equal(pkg.preview,true,'Preview Marketplace badge required');
assert.equal(pkg.galleryBanner.color,'#111827');
assert.equal(pkg.contributes.viewsContainers.activitybar[0].icon,'media/brand/vinculivo-activity-bar.svg');
console.log('Vinculivo brand PASS: immutable logo, matching mono icon, lockups, moodboard and Preview manifest');
