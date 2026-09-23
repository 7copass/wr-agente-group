import { timingSafeEqual } from 'node:crypto';
import { env } from './env.js';
import { chatwoot, type CwConversation, type CwMessage } from './chatwoot.js';
import { ofertas, limites, persona } from './config.js';
import { CAMPOS, faltando, lerEstado, prontoParaHandoff, type Estado } from './state.js';
import { responder } from './brain.js';
import { verificarSaida, valoresCitadosPelo } from './guardrails.js';
import { foraDoExpediente } from './expediente.js';
import { escalar, pararIA } from './handoff.js';
import { notificarLeadQualificado } from './notificacao.js';
import { log } from './log.js';
import { DESVIO_SEM_REPASSE, textoDeRepasse } from './mensagens.js';
import { numeroPermitido } from './telefone.js';
import {
  desdeUltimoReinicio,
  ehEntrada,
  ehNossoBot,
  ehReinicio,
  ehSaida,
  humanoFalouNosUltimos,
  turnoDe,
  type IdentidadeBot,
  type Turno,
} from './historico.js';
import { TAG_ATENDIMENTO_IA, comEtiqueta } from './etiquetas.js';
import { decidirControleIA } from './controle-ia.js';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Se um humano falou com o cliente neste intervalo, ele está no comando: o Alex não retoma. */
const MINUTOS_DE_RESPEITO_AO_HUMANO = 30;

const identidadeDoBot = async (): Promise<IdentidadeBot> => ({
  id: await chatwoot.identificarBot(),
  nome: persona.nome,
});

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

async function processar(conversa: CwConversation, mensagens: CwMessage[], bot: IdentidadeBot): Promise<void> {
  const conversaId = conversa.id;
  const estado = lerEstado(conversa);

  const turnos = mensagens.map((m) => turnoDe(m, bot)).filter((t): t is Turno => t !== null);
  const historico = desdeUltimoReinicio(turnos).slice(-30);
  if (!historico.length) return;

  // A etiqueta atendimento_ia é o controle manual do time, conferido a cada mensagem — não
  // só na primeira. Sem ela o Alex não responde, mesmo que já tenha parado antes por outro
  // motivo; com ela, ele responde, inclusive retomando uma conversa que já tinha soltado.
  // "Já respondeu antes" olha o histórico (desde o último /reiniciar) em vez de só o status
  // gravado, para tirar a etiqueta continuar valendo mesmo se o status ficar inconsistente.
  const etiquetasAtuais = await chatwoot.listarEtiquetas(conversaId);
  const humanoFalouRecentemente = humanoFalouNosUltimos(mensagens, bot, MINUTOS_DE_RESPEITO_AO_HUMANO);
  const decisao = decidirControleIA({
    statusAgente: estado.status_agente,
    etiquetas: etiquetasAtuais,
    jaRespondeuAntes: historico.some((t) => t.autor === 'alex'),
    humanoFalouRecentemente,
  });

  if (!decisao.seguir) {
    if (decisao.novoStatus && decisao.novoStatus !== estado.status_agente) {
      await chatwoot.gravarAtributos(conversaId, { status_agente: decisao.novoStatus });
    }
    const motivo = humanoFalouRecentemente ? 'humano atendendo agora' : `status ${estado.status_agente ?? '—'} / sem a etiqueta`;
    log.info(`conversa ${conversaId} ignorada: ${motivo}`);
    return;
  }
  if (decisao.aplicarTag) await chatwoot.aplicarEtiquetas(conversaId, comEtiqueta(etiquetasAtuais, TAG_ATENDIMENTO_IA));
  if (decisao.ativar) {
    await chatwoot.gravarAtributos(conversaId, { status_agente: 'ativo' });
    if (estado.status_agente === 'aguardando_humano') {
      log.info(`conversa ${conversaId}: Alex retomou — cliente falou e nenhum humano respondeu há ${MINUTOS_DE_RESPEITO_AO_HUMANO} min`);
    }
  }

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
  if (r.etiqueta) {
    const atual = await chatwoot.listarEtiquetas(conversaId);
    const comCategoria = comEtiqueta(atual, r.etiqueta);
    if (comCategoria.length !== atual.length) await chatwoot.aplicarEtiquetas(conversaId, comCategoria);
  }

  const atualizado: Estado = { ...estado, ...novos };
  const veredito = verificarSaida(r.resposta, ofertas, limites, valoresDoCliente);

  if (!veredito.ok) {
    // Barrar a resposta NÃO é motivo para largar o lead: o Alex desvia do que não pode dizer
    // e continua o filtro. Só o lead pronto (ou pedido explícito de humano) faz o repasse.
    log.warn(`resposta bloqueada na conversa ${conversaId}: ${veredito.motivo}`);
    await chatwoot.enviarNotaPrivada(
      conversaId,
      `*Alex bloqueou a própria resposta*\nMotivo: ${veredito.motivo}\nTexto barrado: ${r.resposta}`,
    );
    const pendente = faltando(atualizado)[0];
    if (!pendente) {
      // O lead ficou completo justamente nesta mensagem: desvia do que foi barrado, mas
      // entrega o lead assim mesmo em vez de perder o repasse por causa do bloqueio.
      await enviar(conversaId, textoDeRepasse(DESVIO_SEM_REPASSE, fora));
      await escalar(conversaId, 'lead qualificado (resposta barrada pelo guardrail)', atualizado, telefone, !fora);
      await notificarLeadQualificado(atualizado, telefone, conversaId);
      return;
    }
    await enviar(conversaId, [DESVIO_SEM_REPASSE, persona.perguntas_por_campo?.[pendente]].filter(Boolean).join(' '));
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

  const bot = await identidadeDoBot();
  const doCliente = ehEntrada(evento.message_type);
  // Qualquer saída que não seja do nosso bot é gente: agente do Chatwoot ou o vendedor
  // digitando no celular (que chega com o token de outro agent_bot).
  const doVendedor = ehSaida(evento.message_type) && !ehNossoBot(evento.sender, bot);
  if (!doCliente && !doVendedor) return;

  // Allowlist ANTES de qualquer escrita ou espera. Rodando na inbox de produção, conversa de
  // lead real nunca é tocada: nem atributo, nem etiqueta, nem mensagem. Telefone vem da API.
  const conversa = await chatwoot.obterConversa(conversaId);
  if (!numeroPermitido(conversa.meta?.sender?.phone_number, env.allowlist)) return;

  if (doVendedor) {
    await pararIA(conversaId);
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

  await processar(atual, mensagens, bot);
}
