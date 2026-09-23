import { chatwoot } from './chatwoot.js';
import { env } from './env.js';
import { vendedores } from './config.js';
import { chaveTelefone } from './telefone.js';
import { montarResumo, linkDaConversa } from './handoff.js';
import { log } from './log.js';
import type { Estado } from './state.js';

export interface ConversaCandidata { id: number; inbox_id: number; created_at: number }

/**
 * Entre as conversas de um contato, prefere as das inboxes configuradas (normalmente só a de
 * WhatsApp) e pega a mais recente. Sem inbox configurada ou sem nenhuma bater, usa a mais
 * recente entre todas — melhor mandar pela conversa mais provável do que não mandar.
 */
export function escolherConversa(conversas: ConversaCandidata[], inboxIds: string[]): number | null {
  if (!conversas.length) return null;
  const naInbox = inboxIds.length ? conversas.filter((c) => inboxIds.includes(String(c.inbox_id))) : conversas;
  const lista = naInbox.length ? naInbox : conversas;
  return [...lista].sort((a, b) => b.created_at - a.created_at)[0].id;
}

/**
 * Acha a conversa de WhatsApp já existente para um número interno (ex.: o vendedor a avisar).
 * Não cria conversa nova: sem saber o identificador exato que a ponte de WhatsApp usa para
 * esse contato, criar uma às cegas arrisca mandar a mensagem para o número errado.
 */
async function conversaDoNumero(telefone: string): Promise<number | null> {
  const chave = chaveTelefone(telefone);
  // A busca do Chatwoot é por substring, e alguns contatos ficam salvos sem o nono dígito
  // (identifier "55<DDD><8 dígitos>"). Buscar pela chave — que já é DDD+8 dígitos — casa com
  // o número gravado com ou sem o 9 extra. Buscar pelo número bruto (com o 9) pode não achar
  // nada mesmo quando o contato existe.
  const contatos = await chatwoot.buscarContatos(chave);
  const contato = contatos.find((c) => chaveTelefone(c.phone_number ?? c.identifier ?? '') === chave);
  if (!contato) return null;

  const conversas = await chatwoot.listarConversasDoContato(contato.id);
  return escolherConversa(conversas, env.chatwoot.inboxIds);
}

/**
 * Avisa o vendedor configurado por WhatsApp assim que um lead é qualificado — pela mesma
 * ponte que o Chatwoot já usa para conversar com os clientes. Falha aqui nunca deve
 * atrapalhar o repasse do lead em si: só loga e segue.
 */
export async function notificarLeadQualificado(
  estado: Estado,
  telefoneCliente: string | undefined,
  conversaOriginalId: number,
): Promise<void> {
  const numero = vendedores.handoff.notificar_numero;
  if (!numero) return;

  try {
    const conversaId = await conversaDoNumero(numero);
    if (!conversaId) {
      log.warn(`notificação de lead qualificado não enviada: sem conversa de WhatsApp para ${numero}`);
      return;
    }
    const texto = montarResumo(
      estado,
      telefoneCliente,
      'lead qualificado: todos os campos obrigatórios preenchidos',
      linkDaConversa(conversaOriginalId),
    );
    await chatwoot.enviarMensagem(conversaId, `🔔 Novo lead qualificado\n\n${texto}`);
    log.info(`vendedor notificado no WhatsApp (conversa ${conversaId}) sobre a conversa ${conversaOriginalId}`);
  } catch (e) {
    log.error('falha ao notificar vendedor do lead qualificado', e);
  }
}
