import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  desdeUltimoReinicio,
  ehMensagemDeAnuncio,
  ehNossoBot,
  humanoFalouNosUltimos,
  turnoDe,
  type IdentidadeBot,
  type Turno,
} from '../src/historico.js';

const ALEX: IdentidadeBot = { id: 36, nome: 'Alex' };
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

test('turnoDe classifica pelo formato numérico e textual do Chatwoot', () => {
  assert.deepEqual(turnoDe({ id: 1, content: 'oi', message_type: 0 }, ALEX), c('oi'));
  assert.deepEqual(turnoDe({ id: 2, content: 'oi', message_type: 'incoming' }, ALEX), c('oi'));
  assert.deepEqual(turnoDe({ id: 3, content: 'olá', message_type: 1, sender: { type: 'agent_bot', id: 36 } }, ALEX), a('olá'));
  assert.equal(turnoDe({ id: 5, content: 'nota', message_type: 1, private: true }, ALEX), null);
  assert.equal(turnoDe({ id: 6, content: 'x', message_type: 2 }, ALEX), null);
});

test('agente do Chatwoot conta como vendedor', () => {
  const t = turnoDe({ id: 4, content: 'eu assumo', message_type: 'outgoing', sender: { type: 'user', id: 105 } }, ALEX);
  assert.deepEqual(t, { autor: 'vendedor', texto: 'eu assumo' });
});

test('BUG real: vendedor digitando no celular chega como OUTRO agent_bot e não pode virar fala do Alex', () => {
  const m = { id: 7, content: 'Vamos fechar hoje?', message_type: 1, sender: { type: 'agent_bot', id: 25, name: 'Consórcio Volkswagen' } };
  assert.deepEqual(turnoDe(m, ALEX), { autor: 'vendedor', texto: 'Vamos fechar hoje?' });
  assert.equal(ehNossoBot(m.sender, ALEX), false);
});

test('sem id configurado, reconhece o nosso bot pelo nome', () => {
  const porNome: IdentidadeBot = { id: null, nome: 'Alex' };
  assert.ok(ehNossoBot({ type: 'agent_bot', id: 99, name: 'Alex' }, porNome));
  assert.equal(ehNossoBot({ type: 'agent_bot', id: 25, name: 'Consórcio Volkswagen' }, porNome), false);
});

test('reconhece o bloco de lead de anúncio da ponte', () => {
  assert.ok(ehMensagemDeAnuncio('⚠ **Mensagem de Anuncio!**\nTexto Anuncio: SIMULE SUA PARCELA'));
  assert.ok(ehMensagemDeAnuncio('Mensagem de Anúncio'));
  assert.equal(ehMensagemDeAnuncio('oi, quero saber do consórcio'), false);
});

test('humanoFalouNosUltimos ignora o nosso bot e respeita a janela', () => {
  const agora = 1_000_000;
  const msgs = [
    { id: 1, content: 'olá', message_type: 1, created_at: agora - 60, sender: { type: 'agent_bot', id: 36 } },
    { id: 2, content: 'oi', message_type: 0, created_at: agora - 30 },
  ];
  assert.equal(humanoFalouNosUltimos(msgs, ALEX, 30, agora), false, 'só o nosso bot falou');

  const comHumano = [...msgs, { id: 3, content: 'eu assumo', message_type: 1, created_at: agora - 120, sender: { type: 'agent_bot', id: 25 } }];
  assert.ok(humanoFalouNosUltimos(comHumano, ALEX, 30, agora), 'humano falou há 2 min');
  assert.equal(humanoFalouNosUltimos(comHumano, ALEX, 1, agora), false, 'humano falou fora da janela de 1 min');
});
