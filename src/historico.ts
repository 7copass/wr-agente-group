import type { CwMessage } from './chatwoot.js';

export interface Turno { autor: 'cliente' | 'alex' | 'vendedor'; texto: string }

/** Quem é o nosso bot no Chatwoot, para separar o que é nosso do que veio de outro lugar. */
export interface IdentidadeBot { id?: number | null; nome: string }

/** Só para os números da allowlist: zera a qualificação e recomeça o teste do zero. */
export const COMANDO_REINICIAR = '/reiniciar';

/** Marcas que a ponte de WhatsApp coloca no bloco de lead vindo de anúncio. */
const MARCAS_ANUNCIO = ['mensagem de anuncio', 'mensagem de anúncio', 'texto anuncio', 'texto anúncio'];

export const ehEntrada = (t: unknown) => t === 'incoming' || t === 0;
export const ehSaida = (t: unknown) => t === 'outgoing' || t === 1;

export function ehMensagemDeAnuncio(texto: string): boolean {
  const plano = texto.toLowerCase();
  return MARCAS_ANUNCIO.some((marca) => plano.includes(marca));
}

/**
 * Mensagem de saída que não é do nosso bot veio de gente — inclusive do vendedor respondendo
 * direto pelo aplicativo do WhatsApp: a ponte publica essas mensagens no Chatwoot usando o
 * token de OUTRO agent_bot, não como usuário do Chatwoot. Sem esta checagem o Alex não
 * percebe que um humano entrou e fala por cima dele.
 */
export function ehNossoBot(sender: CwMessage['sender'], bot: IdentidadeBot): boolean {
  if (sender?.type !== 'agent_bot') return false;
  if (bot.id != null) return sender.id === bot.id;
  return (sender.name ?? '').trim().toLowerCase() === bot.nome.trim().toLowerCase();
}

export function turnoDe(m: CwMessage, bot: IdentidadeBot): Turno | null {
  const texto = (m.content ?? '').trim();
  if (!texto || m.private) return null;
  if (ehEntrada(m.message_type)) return { autor: 'cliente', texto };
  if (!ehSaida(m.message_type)) return null;
  return { autor: ehNossoBot(m.sender, bot) ? 'alex' : 'vendedor', texto };
}

/** Algum humano falou com o cliente nos últimos N minutos? (created_at do Chatwoot é em segundos) */
export function humanoFalouNosUltimos(
  mensagens: CwMessage[],
  bot: IdentidadeBot,
  minutos: number,
  agoraEmSegundos: number = Date.now() / 1000,
): boolean {
  const limite = agoraEmSegundos - minutos * 60;
  return mensagens.some(
    (m) => ehSaida(m.message_type) && !m.private && !ehNossoBot(m.sender, bot) && (m.created_at ?? 0) >= limite,
  );
}

export const ehReinicio = (texto: string) => texto.trim().toLowerCase() === COMANDO_REINICIAR;

/**
 * O que vem depois do último /reiniciar, sem a confirmação do Alex que o segue.
 * Assim o modelo trata a conversa como primeiro contato de novo.
 */
export function desdeUltimoReinicio(turnos: Turno[]): Turno[] {
  let inicio = 0;
  turnos.forEach((t, i) => {
    if (t.autor === 'cliente' && ehReinicio(t.texto)) inicio = i + 1;
  });
  while (inicio < turnos.length && turnos[inicio].autor === 'alex') inicio += 1;
  return turnos.slice(inicio);
}
