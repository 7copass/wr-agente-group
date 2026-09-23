import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirControleIA, TAG_ATENDIMENTO_IA } from '../src/controle-ia.js';

test('conversa nova de verdade (sem status e sem histórico): segue, marca ativo, aplica a etiqueta', () => {
  assert.deepEqual(decidirControleIA(undefined, [], false), { seguir: true, ativar: true, aplicarTag: true });
});

test('conversa nova mas a etiqueta já estava lá: segue, marca ativo, não reaplica', () => {
  assert.deepEqual(decidirControleIA(undefined, [TAG_ATENDIMENTO_IA], false), { seguir: true, ativar: true, aplicarTag: false });
});

test('ativa e com a etiqueta: segue sem escrever nada de novo', () => {
  assert.deepEqual(decidirControleIA('ativo', [TAG_ATENDIMENTO_IA, 'curioso'], true), { seguir: true, ativar: false, aplicarTag: false });
});

test('ativa e a etiqueta sumiu: para e registra', () => {
  assert.deepEqual(decidirControleIA('ativo', ['curioso'], true), { seguir: false, registrarParada: true });
});

test('já parada e a etiqueta continua ausente: para sem regravar toda vez', () => {
  assert.deepEqual(decidirControleIA('aguardando_humano', [], true), { seguir: false, registrarParada: false });
});

test('BUG relatado: já parada e o time bota a etiqueta de volta -> retoma', () => {
  assert.deepEqual(decidirControleIA('aguardando_humano', [TAG_ATENDIMENTO_IA], true), { seguir: true, ativar: true, aplicarTag: false });
});

test('encerrado nunca retoma, mesmo com a etiqueta presente', () => {
  assert.deepEqual(decidirControleIA('encerrado', [TAG_ATENDIMENTO_IA], true), { seguir: false, registrarParada: false });
});

test('BUG relatado de novo: status zerado por engano, mas o Alex já tinha respondido -> não reaplica a etiqueta sozinho', () => {
  // Sem o histórico, isto pareceria "conversa nova" e reaplicaria a etiqueta na hora. Com o
  // histórico, sabemos que o Alex já falou aqui e a ausência da etiqueta é uma remoção real.
  assert.deepEqual(decidirControleIA(undefined, [], true), { seguir: false, registrarParada: true });
});

test('depois do /reiniciar, o histórico relevante fica vazio de novo: volta a valer como conversa nova', () => {
  // Quem chama já filtra o histórico para "desde o último /reiniciar" antes de calcular
  // jaRespondeuAntes — aqui simulamos esse resultado (false) depois de um reinício.
  assert.deepEqual(decidirControleIA(undefined, [], false), { seguir: true, ativar: true, aplicarTag: true });
});
