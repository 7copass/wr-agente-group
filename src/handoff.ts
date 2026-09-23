import { chatwoot } from './chatwoot.js';
import { env } from './env.js';
import { vendedores } from './config.js';
import type { Estado } from './state.js';
import { TAG_ATENDIMENTO_IA, semEtiqueta } from './etiquetas.js';

const rotulos: Record<string, string> = {
  nome: 'Nome',
  cidade: 'Cidade',
  veiculo_interesse: 'Veículo',
  faixa_parcela: 'Parcela que cabe',
  tem_entrada: 'Entrada / lance',
  modalidade: 'Modalidade',
  uso_veiculo: 'Uso',
  melhor_horario: 'Melhor horário',
  observacoes: 'Observações',
};

export const linkDaConversa = (conversaId: number): string =>
  `${env.chatwoot.url}/app/accounts/${env.chatwoot.accountId}/conversations/${conversaId}`;

export function montarResumo(
  estado: Estado,
  telefone: string | undefined,
  motivo: string,
  linkConversa?: string,
): string {
  const linhas = Object.entries(rotulos)
    .map(([chave, rotulo]) => {
      const v = estado[chave as keyof Estado];
      return v ? `- ${rotulo}: ${v}` : `- ${rotulo}: —`;
    })
    .join('\n');

  return [
    '*Repasse do Alex*',
    telefone ? `- Telefone: ${telefone}` : null,
    linhas,
    `- Motivo do repasse: ${motivo}`,
    linkConversa ? `- Conversa: ${linkConversa}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Escolhe o próximo vendedor. Sem rodízio configurado, cai no responsável padrão.
 * Na Vercel a posição do rodízio não sobrevive entre execuções: rodízio justo exige banco.
 */
let posicao = 0;
export function proximoResponsavel(): number {
  const fila = vendedores.handoff.rodizio;
  if (!fila.length) return vendedores.handoff.responsavel_padrao;
  const escolhido = fila[posicao % fila.length];
  posicao += 1;
  return escolhido;
}

/**
 * Marca que a IA parou de atender: grava o status e tira a etiqueta atendimento_ia (sem
 * apagar as demais). Chamado tanto quando o Alex escala quanto quando um humano assume.
 */
export async function pararIA(conversaId: number): Promise<void> {
  await chatwoot.gravarAtributos(conversaId, { status_agente: 'aguardando_humano' });
  const atuais = await chatwoot.listarEtiquetas(conversaId);
  const semTag = semEtiqueta(atuais, TAG_ATENDIMENTO_IA);
  if (semTag.length !== atuais.length) await chatwoot.aplicarEtiquetas(conversaId, semTag);
}

export async function escalar(
  conversaId: number,
  motivo: string,
  estado: Estado,
  telefone: string | undefined,
  atribuir: boolean,
): Promise<void> {
  await chatwoot.enviarNotaPrivada(conversaId, montarResumo(estado, telefone, motivo, linkDaConversa(conversaId)));
  await pararIA(conversaId);
  await chatwoot.abrirConversa(conversaId);
  if (atribuir) await chatwoot.atribuir(conversaId, proximoResponsavel());
}
