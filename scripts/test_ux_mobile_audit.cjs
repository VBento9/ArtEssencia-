'use strict';
// Non-destructive audit of mobile navigation in Backoffice 1.9.15 UX preview.
// Run with: node scripts/test_ux_mobile_audit.cjs
// This is a static safety gate, NOT a substitute for browser/PWA device tests.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const section = html.slice(html.indexOf('const pages='), html.indexOf('const pageIcons='));
const pages = [...section.matchAll(/\['([^']+)','([^']+)'\]/g)].map(m=>m[1]);
assert.equal(pages.length, 29, 'All 29 modules must remain in the navigation');
assert.equal(new Set(pages).size,29,'No duplicated module identifiers');
assert.match(html, /groupNavigationVUX20261019/, 'Navigation grouping must be present');
assert.match(html, /aeUXOpenNavGroup/, 'Navigation must reopen the selected group');
assert.match(html, /window\.matchMedia\('\(max-width:650px\)'\)/, 'Mobile breakpoint must be explicit');
assert.match(html, /#nav button\[data-page\]/, 'Mobile controls must preserve data-page buttons');
assert.match(html, /overflow-x:auto!important/, 'Horizontal menu must permit scrolling');
const uxBlock = html.slice(html.indexOf('(function groupNavigationVUX20261019()'), html.indexOf('function updateTopDateTimeV1906()'));
assert.match(uxBlock, /window\.aeUXOpenNavGroup=function\(page\)/, 'Selected route must open its navigation group');
assert.match(uxBlock, /getBoundingClientRect\(\)/, 'Active item needs viewport measurement');
assert.match(uxBlock, /nav\.scrollTo\(\{left:/, 'Selected mobile module must auto-scroll into view');
assert.match(html, /const APP_VERSION='1\.9\.14'/, 'Do not publish from audit branch');
assert.match(html, /id="ae-ux-quicknav-20261019"/, 'Mobile quick navigation styles missing');
assert.match(html, /initUXQuickNav20261019/, 'Mobile quick navigation missing');
for (const name of ['Início','Voltar','Módulos']) assert.ok(html.includes("'"+name+"'"), 'Mobile shortcut missing: '+name);
assert.match(html, /window\.aeUXRecordPage\(id\)/, 'Navigation history must be updated on module changes');
assert.match(html, /panel\.hidden=true/, 'Module panel must close safely');

// Expose a gap to resolve before rollout rather than silently passing an absent usability requirement:
const hasActiveVisibility = /scrollIntoView\s*\(|\.scrollTo\s*\(/.test(
  html.slice(html.indexOf('(function groupNavigationVUX20261019()'), html.indexOf('function updateTopDateTimeV1906()'))
);
console.log('Static baseline OK: '+pages.length+' navigation modules, mobile overflow, same PWA version.');
console.log('Selected-module auto-visibility: '+(hasActiveVisibility?'static implementation present; device review required':'NOT implemented; device verification required'));
console.log('Required device checks: Honor Pad 9, Honor Magic 8 Pro, navigation to last module, print/PDF, passkey, page overlays, PWA update.');
