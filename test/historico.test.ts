import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desdeUltimoReinicio, turnoDe, type Turno } from '../src/historico.js';

const c = (texto: string): Turno => ({ autor: 'cliente', texto });
const a = (texto: string): Turno => ({ autor: 'alex', texto });

test('sem /reiniciar, mantém a conversa inteira', () => {
  const t = [c('oi'), a('olá'), c('quanto fica?')];
  assert.deepEqual(desdeUltimoReinicio(t), t);
});

test('descarta tudo até o último /reiniciar e a confirmação do Alex', () => {
  const t = [c('oi'), a('olá'), c('/reiniciar'), a('Conversa reiniciada'), c('quero a strada')];
  assert.deepEqual(desdeUltimoReinicio(t), [c('quero a strada')]);
});

test('usa o último /reiniciar quando há vários, sem diferenciar maiúsculas', () => {
  const t = [c('/reiniciar'), a('ok'), c('a'), c(' /REINICIAR '), a('ok'), c('b')];
  assert.deepEqual(desdeUltimoReinicio(t), [c('b')]);
});

test('/reiniciar escrito pelo Alex não conta', () => {
  const t = [c('oi'), a('/reiniciar'), c('e aí')];
  assert.deepEqual(desdeUltimoReinicio(t), t);
});

test('turnoDe classifica pelo formato numérico e textual do Chatwoot', () => {
  assert.deepEqual(turnoDe({ id: 1, content: 'oi', message_type: 0 }), c('oi'));
  assert.deepEqual(turnoDe({ id: 2, content: 'oi', message_type: 'incoming' }), c('oi'));
  assert.deepEqual(turnoDe({ id: 3, content: 'olá', message_type: 1, sender: { type: 'agent_bot' } }), a('olá'));
  assert.deepEqual(turnoDe({ id: 4, content: 'eu', message_type: 'outgoing', sender: { type: 'user' } }), { autor: 'vendedor', texto: 'eu' });
  assert.equal(turnoDe({ id: 5, content: 'nota', message_type: 1, private: true }), null);
  assert.equal(turnoDe({ id: 6, content: 'x', message_type: 2 }), null);
});
