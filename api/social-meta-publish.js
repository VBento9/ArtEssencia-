const SUPABASE_URL = 'https://ihtsonqnnlrxvorfrarl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bBAzr698eotgn-QCq0kKWQ_szVceK5x';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function authToken(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

async function verifyOwner(token) {
  if (!token) return false;
  const userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }
  });
  if (!userResponse.ok) return false;
  const user = await userResponse.json().catch(() => null);
  if (!user?.id) return false;

  const ownerResponse = await fetch(SUPABASE_URL + '/rest/v1/rpc/artessencia_is_owner_v1', {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  if (!ownerResponse.ok) return false;
  return (await ownerResponse.json().catch(() => false)) === true;
}

async function loadPublication(token, id) {
  const url = SUPABASE_URL + '/rest/v1/artessencia_social_publications?id=eq.' +
    encodeURIComponent(id) +
    '&select=id,product_name,image_url,network,format,copy,hashtags,status,scheduled_for,published_at';
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + token,
      Accept: 'application/json'
    }
  });
  if (!response.ok) throw new Error('Não foi possível carregar a publicação.');
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function claimPublication(token, id) {
  const response = await fetch(
    SUPABASE_URL + '/rest/v1/artessencia_social_publications?id=eq.' + encodeURIComponent(id) +
      '&status=eq.approved&published_at=is.null',
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ published_at: new Date().toISOString() })
    }
  );
  if (!response.ok) throw new Error('Não foi possível reservar esta publicação.');
  const rows = await response.json().catch(() => []);
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('Esta publicação já foi processada ou está a ser processada.');
  }
}

async function releasePublicationClaim(token, id) {
  const response = await fetch(
    SUPABASE_URL + '/rest/v1/artessencia_social_publications?id=eq.' + encodeURIComponent(id) +
      '&status=eq.approved',
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ published_at: null })
    }
  );
  if (!response.ok) {
    console.error('social-meta-publish claim release failed', id);
  }
}

async function markPublished(token, id) {
  const response = await fetch(
    SUPABASE_URL + '/rest/v1/artessencia_social_publications?id=eq.' + encodeURIComponent(id) +
      '&status=eq.approved',
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ status: 'published' })
    }
  );
  if (!response.ok) {
    throw new Error('A publicação foi enviada, mas o estado final não pôde ser sincronizado. Não repitas a publicação; revê o histórico.');
  }
}

function graphBase() {
  const version = clean(process.env.META_GRAPH_VERSION, 20);
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error('META_GRAPH_VERSION não configurada.');
  }
  return 'https://graph.facebook.com/' + version;
}

async function metaPost(path, fields) {
  const params = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') params.set(key, String(value));
  });
  const response = await fetch(graphBase() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const code = clean(data?.error?.code, 80);
    const type = clean(data?.error?.type, 120);
    const message = clean(data?.error?.message, 500);
    console.error('meta publish failed', response.status, type, code, message);
    throw new Error('A Meta recusou a publicação.');
  }
  return data;
}

async function publishFacebook(row, accessToken, pageId) {
  const caption = [clean(row.copy, 4000), ...(Array.isArray(row.hashtags) ? row.hashtags : [])]
    .filter(Boolean)
    .join('\n\n');
  const result = await metaPost('/' + encodeURIComponent(pageId) + '/feed', {
    message: caption,
    access_token: accessToken
  });
  return { network: 'Facebook', externalId: clean(result?.id, 300) || null };
}

async function publishInstagram(row, accessToken, instagramAccountId) {
  const imageUrl = clean(row.image_url, 4000);
  if (!/^https:\/\//i.test(imageUrl)) {
    throw new Error('A publicação do Instagram precisa de uma imagem HTTPS.');
  }

  const caption = [clean(row.copy, 2200), ...(Array.isArray(row.hashtags) ? row.hashtags : [])]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 2200);

  const container = await metaPost('/' + encodeURIComponent(instagramAccountId) + '/media', {
    image_url: imageUrl,
    caption,
    access_token: accessToken
  });
  const creationId = clean(container?.id, 300);
  if (!creationId) throw new Error('A Meta não devolveu o identificador do conteúdo Instagram.');

  const published = await metaPost('/' + encodeURIComponent(instagramAccountId) + '/media_publish', {
    creation_id: creationId,
    access_token: accessToken
  });
  return {
    network: 'Instagram',
    containerId: creationId,
    externalId: clean(published?.id, 300) || null
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  const token = authToken(req);
  if (!(await verifyOwner(token))) {
    return json(res, 401, { ok: false, error: 'Não autorizado.' });
  }

  if (String(process.env.SOCIAL_META_PUBLISH_ENABLED || '').toLowerCase() !== 'true') {
    return json(res, 503, {
      ok: false,
      error: 'Publicação automática Meta ainda está desativada.'
    });
  }

  const accessToken = clean(process.env.META_ACCESS_TOKEN, 8000);
  const pageId = clean(process.env.META_PAGE_ID, 300);
  const instagramAccountId = clean(process.env.META_INSTAGRAM_ACCOUNT_ID, 300);

  if (!accessToken) {
    return json(res, 503, { ok: false, error: 'Ligação Meta não configurada.' });
  }

  const id = clean(req.body?.id, 100);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return json(res, 400, { ok: false, error: 'Publicação inválida.' });
  }

  try {
    const row = await loadPublication(token, id);
    if (!row) return json(res, 404, { ok: false, error: 'Publicação não encontrada.' });
    if (row.status !== 'approved') {
      return json(res, 409, { ok: false, error: 'Apenas propostas aprovadas podem ser publicadas.' });
    }
    if (row.format !== 'Publicação') {
      return json(res, 409, { ok: false, error: 'Nesta fase só é suportado o formato Publicação.' });
    }
    if (row.network === 'Instagram + Facebook') {
      return json(res, 409, {
        ok: false,
        error: 'Nesta fase publica uma rede de cada vez para evitar publicações parciais.'
      });
    }

    await claimPublication(token, id);
    let externalPublished = false;
    try {
      let result;
      if (row.network === 'Instagram') {
        if (!instagramAccountId) throw new Error('Instagram Meta ainda não configurado.');
        result = await publishInstagram(row, accessToken, instagramAccountId);
      } else if (row.network === 'Facebook') {
        if (!pageId) throw new Error('Página Facebook ainda não configurada.');
        result = await publishFacebook(row, accessToken, pageId);
      } else {
        throw new Error('Rede social não suportada.');
      }

      externalPublished = true;
      await markPublished(token, id);
      return json(res, 200, { ok: true, result });
    } catch (publishError) {
      if (!externalPublished) await releasePublicationClaim(token, id);
      throw publishError;
    }
  } catch (error) {
    console.error('social-meta-publish', error?.message || error);
    return json(res, 502, {
      ok: false,
      error: clean(error?.message || 'Não foi possível publicar na Meta.', 500)
    });
  }
}
