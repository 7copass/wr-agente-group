import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limparSegredo, problemaNoSegredo } from '../src/segredo.js';

test('remove quebra de linha e espaço colados junto com a chave', () => {
  assert.equal(limparSegredo('sk-proj-abc123\n'), 'sk-proj-abc123');
  assert.equal(limparSegredo(' sk-proj-abc\r\n123 '), 'sk-proj-abc123');
  assert.equal(limparSegredo('sk-proj-abc\t123'), 'sk-proj-abc123');
});

test('chave limpa tem formato válido', () => {
  assert.equal(problemaNoSegredo('sk-proj-abc_123-XYZ'), null);
});

test('aponta caractere que não é espaço e sobrevive à limpeza, sem mostrar a chave', () => {
  const p = problemaNoSegredo(limparSegredo('sk-proj-abc…'));
  assert.equal(p, 'caractere inválido na posição 12 (U+2026)');
  assert.doesNotMatch(p!, /sk-proj/);
});

test('vazio é reportado', () => {
  assert.equal(problemaNoSegredo(''), 'vazio');
});
