import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comEtiqueta, semEtiqueta, TAG_ATENDIMENTO_IA } from '../src/etiquetas.js';

test('adiciona sem duplicar e sem apagar as outras', () => {
  assert.deepEqual(comEtiqueta(['curioso'], TAG_ATENDIMENTO_IA), ['curioso', TAG_ATENDIMENTO_IA]);
  assert.deepEqual(comEtiqueta(['curioso', TAG_ATENDIMENTO_IA], TAG_ATENDIMENTO_IA), ['curioso', TAG_ATENDIMENTO_IA]);
});

test('remove só a etiqueta pedida, preserva as outras', () => {
  assert.deepEqual(semEtiqueta(['curioso', TAG_ATENDIMENTO_IA, 'fora_da_cidade'], TAG_ATENDIMENTO_IA), ['curioso', 'fora_da_cidade']);
  assert.deepEqual(semEtiqueta(['curioso'], TAG_ATENDIMENTO_IA), ['curioso']);
});
