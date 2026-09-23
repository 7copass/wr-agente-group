import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolherConversa, type ConversaCandidata } from '../src/notificacao.js';

const c = (id: number, inbox: number, created: number): ConversaCandidata => ({ id, inbox_id: inbox, created_at: created });

test('prefere a inbox configurada mesmo se não for a mais recente', () => {
  const conversas = [c(1, 43, 100), c(2, 99, 200)];
  assert.equal(escolherConversa(conversas, ['43']), 1);
});

test('entre conversas da mesma inbox, pega a mais recente', () => {
  const conversas = [c(1, 43, 100), c(2, 43, 300), c(3, 43, 200)];
  assert.equal(escolherConversa(conversas, ['43']), 2);
});

test('sem inbox configurada, usa a mais recente entre todas', () => {
  const conversas = [c(1, 43, 100), c(2, 99, 300)];
  assert.equal(escolherConversa(conversas, []), 2);
});

test('nenhuma conversa bate com a inbox configurada: cai para a mais recente de qualquer uma', () => {
  const conversas = [c(1, 10, 100), c(2, 20, 300)];
  assert.equal(escolherConversa(conversas, ['43']), 2);
});

test('sem nenhuma conversa, não escolhe nada', () => {
  assert.equal(escolherConversa([], ['43']), null);
});
