import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoDeRepasse, AVISO_HANDOFF, AVISO_HANDOFF_FORA } from '../src/mensagens.js';

test('troca resposta que termina em pergunta pelo aviso, porque ninguém vai responder', () => {
  assert.equal(textoDeRepasse('Qual valor de parcela você procura?', false), AVISO_HANDOFF);
});

test('fora do expediente não promete "só um momento"', () => {
  const t = textoDeRepasse('', true);
  assert.equal(t, AVISO_HANDOFF_FORA);
  assert.doesNotMatch(t, /só um momento/);
});

test('mantém a resposta que já avisa do consultor dentro do expediente', () => {
  const r = 'Vou te passar para um consultor da equipe agora.';
  assert.equal(textoDeRepasse(r, false), r);
});

test('complementa resposta informativa com o aviso de repasse', () => {
  const t = textoDeRepasse('Seu valor de entrada pode ser usado como lance.', false);
  assert.ok(t.startsWith('Seu valor de entrada'));
  assert.ok(t.endsWith(AVISO_HANDOFF));
});

test('à noite, mesmo citando consultor, deixa claro que o retorno não é imediato', () => {
  const t = textoDeRepasse('Vou te passar para um consultor.', true);
  assert.ok(t.endsWith(AVISO_HANDOFF_FORA));
});
