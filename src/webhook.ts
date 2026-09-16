import { timingSafeEqual } from 'node:crypto';
import { env } from './env.js';
import { chatwoot, type CwConversation, type CwMessage } from './chatwoot.js';
import { ofertas, limites } from './config.js';
import { lerEstado, prontoParaHandoff, type Estado } from './state.js';
import { responder, type Turno } from './brain.js';
import { verificarSaida, valoresCitadosPelo } from './guardrails.js';
import { foraDoExpediente } from './expediente.js';
import { escalar } from './handoff.js';
import { log } from './log.js';
import { AVISO_BLOQUEIO, AVISO_BLOQUEIO_FORA, textoDeRepasse } from './mensagens.js';
import { numeroPermitido } from './telefone.js';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ehEntrada = (t: unknown) => t === 'incoming' || t === 0;
const ehSaida = (t: unknown) => t === 'outgoing' || t === 1;

export function autorizado(token: string | null | undefined): boolean {
  const esperado = Buffer.from(env.webhookSecret);
  const recebido = Buffer.from(token ?? '');
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

function turnoDe(m: CwMessage): Turno | null {
  const texto = (m.content ?? '').trim();
  if (!texto || m.private) return null;
  if (ehEntrada(m.message_type)) return { autor: 'cliente', texto };
  if (!ehSaida(m.message_type)) return null;
  return { autor: m.sender?.type === 'user' ? 'vendedor' : 'alex', texto };
}

async function enviar(conversaId: number, texto: string): Promise<void> {
  if (!texto.trim()) return;
  if (env.dryRun) {
    log.info(`[DRY_RUN] conversa ${conversaId} receberia: ${texto}`);
    return;
  }
  await chatwoot.enviarMensagem(conversaId, texto);
}

async function processar(conversa: CwConversation, mensagens: CwMessage[]): Promise<void> {
  const conversaId = conversa.id;
  const estado = lerEstado(conversa);

  if (estado.status_agente === 'aguardando_humano' || estado.status_agente === 'encerrado') {
    log.info(`conversa ${conversaId} ignorada: status ${estado.status_agente}`);
    return;
  }

  const historico = mensagens.map(turnoDe).filter((t): t is Turno => t !== null).slice(-30);
  if (!historico.length) return;

  const valoresDoCliente = historico
    .filter((t) => t.autor === 'cliente')
    .flatMap((t) => valoresCitadosPelo(t.texto));

  const fora = foraDoExpediente();
  const telefone = conversa.meta?.sender?.phone_number;

  const r = await responder(historico, estado, fora);

  const novos: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.campos)) {
    if (typeof v === 'string' && v.trim()) novos[k] = v.trim();
  }
  if (Object.keys(novos).length) await chatwoot.gravarAtributos(conversaId, novos);
  if (r.etiqueta) await chatwoot.aplicarEtiquetas(conversaId, [r.etiqueta]);

  const atualizado: Estado = { ...estado, ...novos };
  const veredito = verificarSaida(r.resposta, ofertas, limites, valoresDoCliente);

  if (!veredito.ok) {
    log.warn(`resposta bloqueada na conversa ${conversaId}: ${veredito.motivo}`);
    await chatwoot.enviarNotaPrivada(
      conversaId,
      `*Alex bloqueou a própria resposta*\nMotivo: ${veredito.motivo}\nTexto barrado: ${r.resposta}`,
    );
    await enviar(conversaId, fora ? AVISO_BLOQUEIO_FORA : AVISO_BLOQUEIO);
    await escalar(conversaId, veredito.motivo ?? 'guardrail', atualizado, telefone, !fora);
    return;
  }

  const precisaHumano = Boolean(r.escalar) || prontoParaHandoff(atualizado);
  await enviar(conversaId, precisaHumano ? textoDeRepasse(r.resposta, fora) : r.resposta);

  if (precisaHumano) {
    const motivo = r.escalar?.motivo ?? 'lead qualificado: todos os campos obrigatórios preenchidos';
    await escalar(conversaId, motivo, atualizado, telefone, !fora);
    log.info(`conversa ${conversaId} escalada: ${motivo}`);
  }
}

/**
 * Trata um evento do agent_bot do Chatwoot. Não guarda nada em memória: funciona igual
 * num servidor comum e numa função serverless, em que cada evento é uma execução isolada.
 */
export async function tratarEvento(evento: Record<string, any>): Promise<void> {
  if (evento?.event !== 'message_created' || evento.private) return;

  const conversaId = Number(evento.conversation?.id);
  if (!conversaId) return;

  const inboxes = env.chatwoot.inboxIds;
  const inboxDoEvento = String(evento.conversation?.inbox_id ?? evento.inbox?.id ?? '');
  if (inboxes.length && !inboxes.includes(inboxDoEvento)) return;

  if (ehSaida(evento.message_type)) {
    if (evento.sender?.type === 'user') {
      await chatwoot.gravarAtributos(conversaId, { status_agente: 'aguardando_humano' });
      log.info(`conversa ${conversaId}: humano assumiu, Alex silenciado`);
    }
    return;
  }

  if (!ehEntrada(evento.message_type)) return;

  // Debounce sem memória: espera o cliente parar de digitar e só segue se esta ainda
  // for a última mensagem dele. Se chegou outra, a execução dela é que responde.
  await esperar(env.debounceMs);

  const [conversa, mensagens] = await Promise.all([
    chatwoot.obterConversa(conversaId),
    chatwoot.listarMensagens(conversaId),
  ]);

  // Telefone vem da API, não do corpo do evento.
  if (!numeroPermitido(conversa.meta?.sender?.phone_number, env.allowlist)) {
    log.info(`conversa ${conversaId} ignorada: contato fora da allowlist`);
    return;
  }

  const ultimaDoCliente = [...mensagens].reverse().find((m) => ehEntrada(m.message_type));
  if (ultimaDoCliente && ultimaDoCliente.id !== Number(evento.id)) {
    log.info(`conversa ${conversaId}: chegou mensagem mais nova, a execução dela responde`);
    return;
  }

  await processar(conversa, mensagens);
}
