'use strict';
const fs = require('node:fs');
const {isolatedProjectUrl} = require('../intelligence/worker-transport.cjs');

// The static preview receives only the public client configuration. Unknown
// previews get an empty configuration, including on a custom-domain alias.
if (process.env.VERCEL_ENV === 'preview') {
  const env = process.env;
  const permitted = env.VERCEL_GIT_COMMIT_REF === 'feature/intelligence-hybrid-foundation-20261126'
    && env.INTELLIGENCE_EXECUTION_MODE === 'simulation'
    && env.INTELLIGENCE_SUPABASE_URL === isolatedProjectUrl
    && env.INTELLIGENCE_ISOLATED_PROJECT_URL === isolatedProjectUrl
    && /^sb_publishable_[A-Za-z0-9_-]+$/.test(env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY || '');
  const config = permitted
    ? {url: isolatedProjectUrl, key: env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY}
    : {url: '', key: ''};
  const html = fs.readFileSync('index.html', 'utf8');
  const marker = 'const isolatedPreviewConfig=null;';
  if (html.split(marker).length !== 2) throw Error('Missing unique preview configuration marker');
  fs.writeFileSync('index.html', html.replace(marker, 'const isolatedPreviewConfig=' + JSON.stringify(config) + ';'));
}
