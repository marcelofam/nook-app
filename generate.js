// Função serverless do Nook.
// Protege a chave da Anthropic e exige um código de acesso válido.
// A chave e a lista de códigos ficam em variáveis de ambiente do Netlify,
// nunca no código que vai pro navegador.

exports.handler = async (event) => {
  // CORS básico (permite o app chamar a função)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Requisição inválida' }) };
  }

  const { access_code, prompt, max_tokens } = payload;

  // 1) Confere o código de acesso contra a lista de códigos válidos.
  // A lista vem da variável de ambiente ACCESS_CODES, separada por vírgulas.
  // Ex: "maria-2026,joao-2026,ana-2026"
  const validCodes = (process.env.ACCESS_CODES || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  if (!access_code || !validCodes.includes(access_code.trim())) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Código de acesso inválido. Confira com quem te indicou o Nook.' }),
    };
  }

  // 2) Valida o prompt.
  if (!prompt || typeof prompt !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pedido sem conteúdo.' }) };
  }

  // 3) Chama a Anthropic usando a chave secreta do servidor.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Servidor sem chave configurada.' }) };
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: max_tokens || 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: 'Erro na geração. Tente de novo.' }) };
    }
    // Devolve só o necessário pro app.
    return { statusCode: 200, headers, body: JSON.stringify({ content: data.content, stop_reason: data.stop_reason }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Falha ao gerar. Tente novamente.' }) };
  }
};
