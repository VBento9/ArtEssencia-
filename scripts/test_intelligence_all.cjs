'use strict';
// Run locally from repository root; no production access.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tests=fs.readdirSync(path.join(root,'tests')).filter(x=>/^intelligence-.*\.test\.cjs$/.test(x)).sort().map(x=>path.join('tests',x));
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
if(!tests.length)throw Error('No Intelligence tests');
run(['--test',...tests]);
for(const name of fs.readdirSync(path.join(root,'intelligence')).filter(n=>/\.(js|cjs)$/.test(n)))run(['--check',path.join('intelligence',name)]);
if(process.argv.includes('--sql'))run(['scripts/test_intelligence_count_sql.cjs']);
else console.log('SQL fixture not run. Add --sql with local PGlite installed.');
