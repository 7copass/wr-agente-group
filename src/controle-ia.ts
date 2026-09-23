import { TAG_ATENDIMENTO_IA } from './etiquetas.js';

export type DecisaoControle =
  | { seguir: true; ativar: boolean; aplicarTag: boolean }
  | { seguir: false; novoStatus?: 'aguardando_humano' | 'desligado' };

export interface SituacaoConversa {
  statusAgente: string | undefined;
  etiquetas: string[];
  /** O Alex já respondeu nesta janela de conversa (desde o último /reiniciar). */
  jaRespondeuAntes: boolean;
  /** Algum humano falou com o cliente há pouco tempo — então ele está no comando agora. */
  humanoFalouRecentemente: boolean;
}

/**
 * Decide, a cada mensagem do cliente, se o Alex responde.
 *
 * Duas coisas o calam, e elas são diferentes de propósito:
 *   - o time tirar a etiqueta atendimento_ia (status "desligado"): decisão explícita de gente,
 *     só volta quando alguém repuser a etiqueta;
 *   - o Alex ter repassado, ou um humano ter respondido ("aguardando_humano"): o humano tem a
 *     preferência enquanto estiver ali, mas se ele sumir e o cliente continuar falando, o Alex
 *     volta — senão o cliente fica conversando sozinho, que é exatamente o problema que este
 *     projeto existe para resolver.
 */
export function decidirControleIA(s: SituacaoConversa): DecisaoControle {
  const temTag = s.etiquetas.includes(TAG_ATENDIMENTO_IA);

  if (s.statusAgente === 'encerrado') return { seguir: false };

  // Desligado pelo time: só a etiqueta traz de volta.
  if (s.statusAgente === 'desligado') {
    return temTag ? { seguir: true, ativar: true, aplicarTag: false } : { seguir: false };
  }

  // Conversa nova de verdade: assume e marca com a etiqueta.
  if (!s.statusAgente && !s.jaRespondeuAntes) {
    return { seguir: true, ativar: true, aplicarTag: !temTag };
  }

  // Repassado ou humano respondeu: o humano manda enquanto estiver presente.
  if (s.statusAgente === 'aguardando_humano') {
    if (s.humanoFalouRecentemente) return { seguir: false };
    return { seguir: true, ativar: true, aplicarTag: !temTag };
  }

  // Sobrou: conversa já em andamento. Sem etiqueta aqui significa que alguém a tirou.
  if (!temTag) return { seguir: false, novoStatus: 'desligado' };
  return { seguir: true, ativar: s.statusAgente !== 'ativo', aplicarTag: false };
}

export { TAG_ATENDIMENTO_IA };
