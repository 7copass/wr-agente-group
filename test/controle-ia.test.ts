import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirControleIA, TAG_ATENDIMENTO_IA, type SituacaoConversa } from '../src/controle-ia.js';

const sit = (p: Partial<SituacaoConversa>): SituacaoConversa => ({
  statusAgente: undefined,
  etiquetas: [],
  jaRespondeuAntes: false,
  humanoFalouRecentemente: false,
  ...p,
});

test('conversa nova: assume e aplica a etiqueta', () => {
  assert.deepEqual(decidirControleIA(sit({})), { seguir: true, ativar: true, aplicarTag: true });
});

test('conversa nova que já veio etiquetada pela automação: assume sem reaplicar', () => {
  assert.deepEqual(decidirControleIA(sit({ etiquetas: [TAG_ATENDIMENTO_IA] })), { seguir: true, ativar: true, aplicarTag: false });
});

test('em andamento com etiqueta: segue sem escrita extra', () => {
  const d = decidirControleIA(sit({ statusAgente: 'ativo', etiquetas: [TAG_ATENDIMENTO_IA, 'curioso'], jaRespondeuAntes: true }));
  assert.deepEqual(d, { seguir: true, ativar: false, aplicarTag: false });
});

test('time tirou a etiqueta: para e registra desligado', () => {
  const d = decidirControleIA(sit({ statusAgente: 'ativo', etiquetas: ['curioso'], jaRespondeuAntes: true }));
  assert.deepEqual(d, { seguir: false, novoStatus: 'desligado' });
});

test('desligado pelo time continua parado, mesmo sem humano por perto', () => {
  assert.deepEqual(decidirControleIA(sit({ statusAgente: 'desligado', jaRespondeuAntes: true })), { seguir: false });
});

test('desligado pelo time volta quando alguém repõe a etiqueta', () => {
  const d = decidirControleIA(sit({ statusAgente: 'desligado', etiquetas: [TAG_ATENDIMENTO_IA], jaRespondeuAntes: true }));
  assert.deepEqual(d, { seguir: true, ativar: true, aplicarTag: false });
});

test('repassado e humano respondendo agora: o Alex fica fora', () => {
  const d = decidirControleIA(sit({ statusAgente: 'aguardando_humano', jaRespondeuAntes: true, humanoFalouRecentemente: true }));
  assert.deepEqual(d, { seguir: false });
});

test('PROBLEMA REAL: repassado, humano sumiu e o cliente continua falando -> o Alex volta', () => {
  const d = decidirControleIA(sit({ statusAgente: 'aguardando_humano', jaRespondeuAntes: true, humanoFalouRecentemente: false }));
  assert.deepEqual(d, { seguir: true, ativar: true, aplicarTag: true });
});

test('status zerado por engano mas o Alex já falou, sem etiqueta: para', () => {
  const d = decidirControleIA(sit({ jaRespondeuAntes: true }));
  assert.deepEqual(d, { seguir: false, novoStatus: 'desligado' });
});

test('encerrado é definitivo', () => {
  assert.deepEqual(decidirControleIA(sit({ statusAgente: 'encerrado', etiquetas: [TAG_ATENDIMENTO_IA] })), { seguir: false });
});
