import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveTelefone, numeroPermitido } from '../src/telefone.js';

const lista = ['91981617148', '93984009798'];

test('mesmo número com e sem +55, com e sem o nono dígito, vira a mesma chave', () => {
  const k = chaveTelefone('91981617148');
  assert.equal(chaveTelefone('+55 91 98161-7148'), k);
  assert.equal(chaveTelefone('5591981617148'), k);
  assert.equal(chaveTelefone('559181617148'), k);
});

test('libera os dois números da allowlist como o Chatwoot entrega', () => {
  assert.ok(numeroPermitido('+5591981617148', lista));
  assert.ok(numeroPermitido('+5593984009798', lista));
});

test('libera quando o WhatsApp manda sem o nono dígito', () => {
  assert.ok(numeroPermitido('+559181617148', lista));
});

test('bloqueia qualquer outro número', () => {
  assert.equal(numeroPermitido('+5593992236367', lista), false);
  assert.equal(numeroPermitido('+5591981617149', lista), false);
});

test('bloqueia contato sem telefone quando há allowlist', () => {
  assert.equal(numeroPermitido(undefined, lista), false);
  assert.equal(numeroPermitido('', lista), false);
});

test('allowlist vazia libera todos', () => {
  assert.ok(numeroPermitido('+5593992236367', []));
});
