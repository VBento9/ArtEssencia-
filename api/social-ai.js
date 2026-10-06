const OPENAI_URL = 'https://api.openai.com/v1/responses';
const SUPABASE_URL = 'https://ihtsonqnnlrxvorfrarl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bBAzr698eotgn-QCq0kKWQ_szVceK5x';

async function verifyUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token } });
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
  return res.end(JSON.stringify(body));
}

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function outputText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && part.text) return part.text;
    }
  }
  return '';
}

function normalizeFact(value) {
  return clean(value, 4000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function filterSupportedHashtags(hashtags, context) {
  const facts = normalizeFact([context.name, context.description].filter(Boolean).join(' '));
  const materialTerms = ['resina', 'jesmonite', 'ceramica', 'barro', 'cera', 'soja', 'parafina', 'gesso', 'acrilico', 'epoxi', 'epoxy'];
  return (Array.isArray(hashtags) ? hashtags : [])
    .map(x => clean(x, 80))
    .filter(Boolean)
    .filter(tag => {
      const normalizedTag = normalizeFact(tag);
      const compactTag = normalizedTag.replace(/[^a-z0-9]/g, '');
      const mentioned = materialTerms.filter(term => compactTag.includes(term));
      return mentioned.length === 0 || mentioned.every(term => {
        const literal = new RegExp('(^|[^a-z0-9])' + term + '([^a-z0-9]|$)');
        return literal.test(facts);
      });
    })
    .slice(0, 20);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  if (!(await verifyUser(req))) return json(res, 401, { ok: false, error: 'Não autorizado.' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res, 503, { ok: false, error: 'IA ainda não configurada.' });

  const body = req.body || {};
  const product = body.product || {};
  const imageUrl = clean(product.imageUrl, 4000);
  const name = clean(product.name, 160);
  if (!name) return json(res, 400, { ok: false, error: 'Produto inválido.' });

  const context = {
    name,
    description: clean(product.description, 1500),
    category: clean(product.category, 160),
    price: Number(product.price) || 0,
    network: clean(body.network, 80),
    format: clean(body.format, 80),
    goal: clean(body.goal, 120),
    tone: clean(body.tone, 80)
  };

  const instruction = [
    'És o assistente editorial da marca artesanal portuguesa ArtEssencia.',
    'Cria uma proposta de conteúdo em português de Portugal.',
    'Analisa a fotografia quando estiver disponível e adapta o conteúdo ao ambiente visual, produto e eventual contexto sazonal.',
    'Não inventes características, materiais, fragrâncias, preços, coleções ou promoções que não estejam nos dados ou claramente visíveis.',
    'Na comunicação pública nunca uses as expressões "vela em molde" ou "velas em molde"; prefere "vela artesanal", "peça artesanal" ou uma designação pública fornecida nos dados.',
    'Mantém um tom natural, cuidado e artesanal, evitando linguagem genérica, exagerada ou demasiado comercial quando não for pedida.',
    'Se a fotografia sugerir uma ocasião ou ambiente sazonal, podes adaptar o texto ao contexto visual, mas não afirmes que pertence a uma coleção específica sem esse dado.',
    'Aplica exatamente as mesmas regras factuais às hashtags: não acrescentes materiais, fragrâncias, técnicas, coleções ou características que não constem explicitamente dos dados do produto.',
    'Uma aparência visual nunca é prova suficiente do material; só menciones um material quando estiver explicitamente indicado nos dados fornecidos.',
    'A proposta será sempre revista por uma pessoa antes de qualquer publicação.',
    'Responde APENAS JSON válido com as chaves copy, hashtags, visualContext e rationale.',
    'hashtags deve ser um array de strings. rationale deve ser curto.'
  ].join(' ');

  const userContent = [{
    type: 'input_text',
    text: 'Dados do produto e pedido editorial: ' + JSON.stringify(context)
  }];
  if (/^https:\/\//i.test(imageUrl)) userContent.push({ type: 'input_image', image_url: imageUrl });

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SOCIAL_MODEL || 'gpt-5.5',
        instructions: instruction,
        input: [{ role: 'user', content: userContent }],
        max_output_tokens: 900
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('social-ai upstream', response.status, data?.error?.type || 'error', clean(data?.error?.code || '', 120), clean(data?.error?.message || '', 500));
      return json(res, 502, { ok: false, error: 'Não foi possível gerar a proposta de IA.' });
    }

    const raw = outputText(data).trim();
    let proposal;
    try { proposal = JSON.parse(raw); }
    catch { return json(res, 502, { ok: false, error: 'A IA devolveu uma resposta inválida.' }); }

    return json(res, 200, {
      ok: true,
      proposal: {
        copy: clean(proposal.copy, 4000),
        hashtags: filterSupportedHashtags(proposal.hashtags, context),
        visualContext: clean(proposal.visualContext, 800),
        rationale: clean(proposal.rationale, 800)
      }
    });
  } catch (error) {
    console.error('social-ai request failed', error?.message || error);
    return json(res, 502, { ok: false, error: 'Serviço de IA temporariamente indisponível.' });
  }
}
