'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const vm = require('node:vm');
const {isolatedProjectUrl} = require('../intelligence/worker-transport.cjs');
test('preview pins public Cloud configuration even with stale storage or a custom alias', t => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-preview-'));
  t.after(() => fs.rmSync(cwd, {recursive:true, force:true}));
  const source = fs.readFileSync('index.html', 'utf8');
  const env = {VERCEL_ENV:'preview', VERCEL_GIT_COMMIT_REF:'feature/intelligence-hybrid-foundation-20261126',
    INTELLIGENCE_EXECUTION_MODE:'simulation', INTELLIGENCE_SUPABASE_URL:isolatedProjectUrl,
    INTELLIGENCE_ISOLATED_PROJECT_URL:isolatedProjectUrl, INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
  const target = path.join(cwd, 'index.html');
  for (const [overrides, expected] of [[{},isolatedProjectUrl],[{INTELLIGENCE_EXECUTION_MODE:'trial',INTELLIGENCE_OPENAI_API_KEY:'fixture-not-public'},isolatedProjectUrl],[{INTELLIGENCE_SUPABASE_URL:'https://wrong.example'},''],
    [{INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_fixture'},''],[{VERCEL_GIT_COMMIT_REF:'other'},''],[{VERCEL_ENV:'production'},null]]) {
    fs.writeFileSync(target, source);
    execFileSync(process.execPath,[path.resolve('scripts/build_intelligence_preview.cjs')],{cwd,env:{...env,...overrides}});
    const built = fs.readFileSync(path.join(cwd,'public/index.html'),'utf8');
    if(expected===null){assert.equal(built,source);continue;}
    assert.ok(built.includes('<h1>Ambiente de ensaio</h1>'));assert.ok(!built.includes('fixture-not-public'));
    assert.ok(built.includes(expected?'Utiliza a conta de teste ArtEssencia':'Configuração de ensaio indisponível'));
    assert.ok(built.includes("error?.code==='invalid_credentials'"));
    assert.ok(!built.includes('<p>Autentica-te com a conta ArtEssencia para aceder ao Backoffice.</p>'));
    const configCode=built.match(/const isolatedPreviewConfig=.*\nfunction cloudCfg\(\).*\n/)[0];
    for(const value of ['{"url":"stale","key":"stale","email":"old"}','invalid']) {
      const config=vm.runInNewContext(configCode+'cloudCfg()', {CLOUD_CFG:'fixture',localStorage:{getItem:()=>value}});
      assert.equal(config.url,expected);
      assert.equal(config.key,expected?'sb_publishable_fixture':'');
    }
  }
});
