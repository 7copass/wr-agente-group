import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirControleIA, TAG_ATENDIMENTO_IA } from '../src/controle-ia.js';

test('conversa nova, sem etiqueta: segue, marca ativo e aplica a etiqueta', () => {
  assert.deepEqual(decidirControleIA(undefined, []), { seguir: true, ativar: true, aplicarTag: true });
});

test('conversa nova mas a etiqueta já estava lá: segue, marca ativo, não reaplica', () => {
  assert.deepEqual(decidirControleIA(undefined, [TAG_ATENDIMENTO_IA]), { seguir: true, ativar: true, aplicarTag: false });
});

test('ativa e com a etiqueta: segue sem escrever nada de novo', () => {
  assert.deepEqual(decidirControleIA('ativo', [TAG_ATENDIMENTO_IA, 'curioso']), { seguir: true, ativar: false, aplicarTag: false });
});

test('ativa e a etiqueta sumiu: para e registra', () => {
  assert.deepEqual(decidirControleIA('ativo', ['curioso']), { seguir: false, registrarParada: true });
});

test('já parada e a etiqueta continua ausente: para sem regravar toda vez', () => {
  assert.deepEqual(decidirControleIA('aguardando_humano', []), { seguir: false, registrarParada: false });
});

test('BUG relatado: já parada e o time bota a etiqueta de volta -> retoma', () => {
  assert.deepEqual(decidirControleIA('aguardando_humano', [TAG_ATENDIMENTO_IA]), { seguir: true, ativar: true, aplicarTag: false });
});

test('encerrado nunca retoma, mesmo com a etiqueta presente', () => {
  assert.deepEqual(decidirControleIA('encerrado', [TAG_ATENDIMENTO_IA]), { seguir: false, registrarParada: false });
});
