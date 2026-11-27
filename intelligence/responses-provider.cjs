'use strict';
module.exports = function responsesProvider(apiKey, transport = fetch) {
  if (!apiKey) throw Error('Fornecedor indisponível.');
  return async payload => {
    const result = await transport('https://api.openai.com/v1/responses', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!result.ok) throw Error('Resposta do fornecedor por reconciliar.');
    const data = await result.json();
    const text = (data.output || []).filter(item => item.type === 'message')
      .flatMap(item => item.content || []).filter(part => part.type === 'output_text').map(part => part.text).join('');
    return { ...data, text };
  };
};
