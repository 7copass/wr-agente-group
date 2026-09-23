import { test } from 'node:test';
import assert from 'node:assert/strict';

test('gravarAtributos mescla com o que já existe, não substitui', async () => {
  const chamadas: { method: string; body: unknown }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = String(typeof input === 'string' ? input : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    chamadas.push({ method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === 'GET' && /\/conversations\/1$/.test(url)) {
      return new Response(JSON.stringify({ id: 1, custom_attributes: { nome: 'Marcos', cidade: 'Itaituba' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const { chatwoot } = await import('../src/chatwoot.js');
    await chatwoot.gravarAtributos(1, { faixa_parcela: 'até 850' });
  } finally {
    globalThis.fetch = real;
  }

  const escrita = chamadas.find((c) => c.method === 'POST');
  assert.deepEqual((escrita?.body as any).custom_attributes, {
    nome: 'Marcos',
    cidade: 'Itaituba',
    faixa_parcela: 'até 850',
  });
});
