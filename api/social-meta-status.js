const SUPABASE_URL = 'https://ihtsonqnnlrxvorfrarl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bBAzr698eotgn-QCq0kKWQ_szVceK5x';

async function verifyUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }
  });
  if (!response.ok) return false;
  const user = await response.json().catch(() => null);
  if (!user?.id) return false;
  const ownerResponse = await fetch(SUPABASE_URL + '/rest/v1/rpc/artessencia_is_owner_v1', {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!ownerResponse.ok) return false;
  return (await ownerResponse.json().catch(() => false)) === true;
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function configured(name) {
  return Boolean(String(process.env[name] || '').trim());
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  if (!(await verifyUser(req))) {
    return json(res, 401, { ok: false, error: 'Não autorizado.' });
  }

  const accessToken = configured('META_ACCESS_TOKEN');
  const pageId = configured('META_PAGE_ID');
  const instagramAccountId = configured('META_INSTAGRAM_ACCOUNT_ID');

  return json(res, 200, {
    ok: true,
    provider: 'Meta',
    configured: {
      accessToken,
      pageId,
      instagramAccountId
    },
    ready: {
      facebook: accessToken && pageId,
      instagram: accessToken && instagramAccountId
    },
    publishingEnabled: false
  });
}
