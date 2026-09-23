import type { CwConversation } from './chatwoot.js';

export const CAMPOS = [
  'nome',
  'cidade',
  'veiculo_interesse',
  'faixa_parcela',
  'tem_entrada',
  'modalidade',
  'uso_veiculo',
  'melhor_horario',
  'observacoes',
] as const;

export type Campo = (typeof CAMPOS)[number];

/** Os 5 da seção 6.4: é o mínimo para o lead ser considerado quente e ir ao vendedor. */
export const CAMPOS_HANDOFF: Campo[] = ['nome', 'cidade', 'veiculo_interesse', 'faixa_parcela', 'tem_entrada'];

/**
 * ativo              — Alex conduzindo.
 * aguardando_humano  — Alex repassou, ou um humano respondeu. Ele volta se o humano sumir.
 * desligado          — o time tirou a etiqueta. Só volta se alguém puser a etiqueta de novo.
 * encerrado          — fim definitivo (nada grava este status ainda).
 */
export type StatusAgente = 'ativo' | 'aguardando_humano' | 'desligado' | 'encerrado';

export type Estado = Partial<Record<Campo, string>> & {
  status_agente?: StatusAgente;
  score_qualificacao?: number;
  origem_anuncio?: string;
};

export function lerEstado(conversa: CwConversation): Estado {
  const bruto = (conversa.custom_attributes ?? {}) as Record<string, unknown>;
  const estado: Estado = {};
  for (const campo of CAMPOS) {
    const v = bruto[campo];
    if (typeof v === 'string' && v.trim()) estado[campo] = v.trim();
  }
  if (typeof bruto.status_agente === 'string') estado.status_agente = bruto.status_agente as StatusAgente;
  if (typeof bruto.score_qualificacao === 'number') estado.score_qualificacao = bruto.score_qualificacao;
  if (typeof bruto.origem_anuncio === 'string') estado.origem_anuncio = bruto.origem_anuncio;
  return estado;
}

export const faltando = (e: Estado): Campo[] => CAMPOS_HANDOFF.filter((c) => !e[c]);
export const prontoParaHandoff = (e: Estado): boolean => faltando(e).length === 0;
