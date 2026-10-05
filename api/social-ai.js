const OPENAI_URL = 'https://api.openai.com/v1/responses';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Método não permitido.' });
  }

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
        model: process.env.OPENAI_SOCIAL_MODEL || 'gpt-5.6',
        instructions: instruction,
        input: [{ role: 'user', content: userContent }],
        max_output_tokens: 900
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('social-ai upstream', response.status, data?.error?.type || 'error');
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
        hashtags: Array.isArray(proposal.hashtags) ? proposal.hashtags.map(x => clean(x, 80)).filter(Boolean).slice(0, 20) : [],
        visualContext: clean(proposal.visualContext, 800),
        rationale: clean(proposal.rationale, 800)
      }
    });
  } catch (error) {
    console.error('social-ai request failed', error?.message || error);
    return json(res, 502, { ok: false, error: 'Serviço de IA temporariamente indisponível.' });
  }
}
