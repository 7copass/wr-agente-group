import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarResumo, linkDaConversa } from '../src/handoff.js';

test('resumo inclui o link da conversa quando fornecido', () => {
  const texto = montarResumo({ nome: 'Marcos' }, '+5593999999999', 'teste', 'https://x/conversations/9');
  assert.match(texto, /Conversa: https:\/\/x\/conversations\/9/);
  assert.match(texto, /Nome: Marcos/);
});

test('resumo sem link não quebra e não deixa linha vazia de conversa', () => {
  const texto = montarResumo({}, undefined, 'teste');
  assert.doesNotMatch(texto, /Conversa:/);
});

test('linkDaConversa monta a URL do app do Chatwoot', () => {
  const link = linkDaConversa(1049);
  assert.match(link, /\/app\/accounts\/\d+\/conversations\/1049$/);
});
