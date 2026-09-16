import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarSaida, valoresCitadosPelo, parseValor } from '../src/guardrails.js';
import type { Ofertas, Limites } from '../src/config.js';

const ofertas: Ofertas = {
  vigencia: 'teste',
  piso_parcela: null,
  lance_embutido_max_pct: 25,
  planos: [
    { credito: 80000, prazo: 80, parcela: 1032.5 },
    { credito: 80000, prazo: 100, parcela: 727.89 },
  ],
  percentuais_permitidos: [25],
  campanhas_vigentes: [],
};

const limites: Limites = {
  proibido: [],
  frase_credito: '',
  frases_proibidas: ['credito esta garantido', 'isento de juros'],
};

const ok = (t: string, extras: number[] = []) => verificarSaida(t, ofertas, limites, extras).ok;

test('parseValor entende o formato brasileiro', () => {
  assert.equal(parseValor('1.032,50'), 1032.5);
  assert.equal(parseValor('80.000'), 80000);
  assert.equal(parseValor('850'), 850);
});

test('deixa passar valor que está na tabela', () => {
  assert.ok(ok('A carta de R$ 80.000 em 100x fica em R$ 727,89. É uma simulação.'));
});

test('bloqueia parcela que o modelo inventou', () => {
  const v = verificarSaida('Fica em R$ 699,90 por mês.', ofertas, limites);
  assert.equal(v.ok, false);
  assert.match(v.motivo!, /não está na tabela/);
});

test('bloqueia crédito fora da tabela escrito como mil', () => {
  assert.equal(ok('Consigo uma carta de 60 mil para você.'), false);
});

test('permite ecoar o valor que o próprio cliente falou', () => {
  assert.equal(ok('Você falou em R$ 850, certo?'), false);
  assert.equal(ok('Você falou em R$ 850, certo?', [850]), true);
});

test('bloqueia frase proibida mesmo sem acento e em caixa alta', () => {
  assert.equal(ok('SEU CREDITO ESTA GARANTIDO'), false);
  assert.equal(ok('Você é isento de juros no consórcio.'), false);
});

test('bloqueia resposta que usaria configuração não preenchida', () => {
  assert.equal(ok('Nosso endereço é «a confirmar».'), false);
});

test('bloqueia percentual não autorizado', () => {
  assert.equal(ok('Com 40% de lance você tem mais chance.'), false);
  assert.ok(ok('O lance embutido é de até 25%.'));
});

test('bloqueia prazo que não existe na tabela', () => {
  assert.equal(ok('Dá para fazer em 120x.'), false);
});

test('valoresCitadosPelo captura o que o cliente falou', () => {
  assert.deepEqual(valoresCitadosPelo('consigo pagar 850 por mês'), [850]);
  assert.ok(valoresCitadosPelo('tenho 14 mil de entrada').includes(14000));
});
