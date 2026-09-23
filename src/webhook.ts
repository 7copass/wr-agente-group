import { timingSafeEqual } from 'node:crypto';
import { env } from './env.js';
import { chatwoot, type CwConversation, type CwMessage } from './chatwoot.js';
import { ofertas, limites } from './config.js';
import { CAMPOS, lerEstado, prontoParaHandoff, type Estado } from './state.js';
import { responder } from './brain.js';
import { verificarSaida, valoresCitadosPelo } from './guardrails.js';
import { foraDoExpediente } from './expediente.js';
import { escalar } from './handoff.js';
import { notificarLeadQualificado } from './notificacao.js';
import { log } from './log.js';
import { AVISO_BLOQUEIO, AVISO_BLOQUEIO_FORA, textoDeRepasse } from './mensagens.js';
import { numeroPermitido } from './telefone.js';
import { desdeUltimoReinicio, ehEntrada, ehReinicio, ehSaida, turnoDe, type Turno } from './historico.js';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function autorizado(token: string | null | undefined): boolean {
  const esperado = Buffer.from(env.webhookSecret);
  const recebido = Buffer.from(token ?? '');
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

async function enviar(conversaId: number, texto: string): Promise<void> {
  if (!texto.trim()) return;
  if (env.dryRun) {
    log.info(`[DRY_RUN] conversa ${conversaId} receberia: ${texto}`);
    return;
  }
  await chatwoot.enviarMensagem(conversaId, texto);
}

async function reiniciar(conversaId: number): Promise<void> {
  const limpo: Record<string, string> = { status_agente: '' };
  for (const campo of CAMPOS) limpo[campo] = '';
  await chatwoot.gravarAtributos(conversaId, limpo);
  await enviar(conversaId, 'Conversa reiniciada. Pode mandar sua primeira mensagem como se fosse um cliente novo 🙂');
  log.info(`conversa ${conversaId}: reiniciada pelo testador`);
}

async function processar(conversa: CwConversation, mensagens: CwMessage[]): Promise<void> {
  const conversaId = conversa.id;
  const estado = lerEstado(conversa);

  if (estado.status_agente === 'aguardando_humano' || estado.status_agente === 'encerrado') {
    log.info(`conversa ${conversaId} ignorada: status ${estado.status_agente}`);
    return;
  }

  const turnos = mensagens.map(turnoDe).filter((t): t is Turno => t !== null);
  const historico = desdeUltimoReinicio(turnos).slice(-30);
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
    const qualificado = !r.escalar; // motivo automático: todos os campos obrigatórios preenchidos
    const motivo = r.escalar?.motivo ?? 'lead qualificado: todos os campos obrigatórios preenchidos';
    await escalar(conversaId, motivo, atualizado, telefone, !fora);
    log.info(`conversa ${conversaId} escalada: ${motivo}`);
    // Só avisa o vendedor por WhatsApp quando o motivo é ter qualificado o lead, não em
    // qualquer escalonamento (pedido de humano, guardrail etc.) — como o usuário pediu.
    if (qualificado) await notificarLeadQualificado(atualizado, telefone, conversaId);
  }
}

/**
 * Trata um evento de message_created do webhook da conta. Não guarda nada em memória:
 * funciona igual num servidor comum e numa função serverless.
 */
export async function tratarEvento(evento: Record<string, any>): Promise<void> {
  if (evento?.event !== 'message_created' || evento.private) return;

  const conversaId = Number(evento.conversation?.id);
  if (!conversaId) return;

  const inboxes = env.chatwoot.inboxIds;
  const inboxDoEvento = String(evento.conversation?.inbox_id ?? evento.inbox?.id ?? '');
  if (inboxes.length && !inboxes.includes(inboxDoEvento)) return;

  const doCliente = ehEntrada(evento.message_type);
  const doVendedor = ehSaida(evento.message_type) && evento.sender?.type === 'user';
  if (!doCliente && !doVendedor) return;

  // Allowlist ANTES de qualquer escrita ou espera. Rodando na inbox de produção, conversa de
  // lead real nunca é tocada: nem atributo, nem etiqueta, nem mensagem. Telefone vem da API.
  const conversa = await chatwoot.obterConversa(conversaId);
  if (!numeroPermitido(conversa.meta?.sender?.phone_number, env.allowlist)) return;

  if (doVendedor) {
    await chatwoot.gravarAtributos(conversaId, { status_agente: 'aguardando_humano' });
    log.info(`conversa ${conversaId}: humano assumiu, Alex silenciado`);
    return;
  }

  if (ehReinicio(String(evento.content ?? ''))) {
    await reiniciar(conversaId);
    return;
  }

  // Debounce sem memória: espera o cliente parar de digitar e só segue se esta ainda
  // for a última mensagem dele. Se chegou outra, a execução dela é que responde.
  await esperar(env.debounceMs);

  const [atual, mensagens] = await Promise.all([
    chatwoot.obterConversa(conversaId),
    chatwoot.listarMensagens(conversaId),
  ]);

  const ultimaDoCliente = [...mensagens].reverse().find((m) => ehEntrada(m.message_type));
  if (ultimaDoCliente && ultimaDoCliente.id !== Number(evento.id)) {
    log.info(`conversa ${conversaId}: chegou mensagem mais nova, a execução dela responde`);
    return;
  }

  await processar(atual, mensagens);
}
