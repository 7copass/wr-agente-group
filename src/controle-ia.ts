import { TAG_ATENDIMENTO_IA } from './etiquetas.js';

export type DecisaoControle =
  | { seguir: true; ativar: boolean; aplicarTag: boolean }
  | { seguir: false; registrarParada: boolean };

/**
 * A etiqueta atendimento_ia é o controle manual do time, conferido a cada mensagem — não só
 * na primeira vez. Sem isso, depois que o Alex parasse uma vez (por qualquer motivo:
 * handoff, tag removida, humano respondeu), a checagem antiga de status nunca mais deixava
 * a etiqueta ser reavaliada, e adicionar a tag de volta não tinha efeito nenhum — foi
 * exatamente o bug relatado pelo usuário.
 *
 * Regra: sem a tag, o Alex não responde, não importa por que parou antes. Com a tag, ele
 * responde — inclusive retomando uma conversa que ele mesmo tinha soltado. "encerrado" é a
 * única exceção definitiva (hoje nada do código ainda grava esse status).
 */
export function decidirControleIA(
  statusAgente: string | undefined,
  etiquetas: string[],
  jaRespondeuAntes: boolean,
  cliqueDeAnuncio = false,
): DecisaoControle {
  if (statusAgente === 'encerrado') return { seguir: false, registrarParada: false };

  const temTag = etiquetas.includes(TAG_ATENDIMENTO_IA);

  // Um clique novo no anúncio é um lead pago chegando agora, mesmo que a conversa já tenha
  // sido repassada antes. Ficar calado nesse caso é o pior resultado possível, então o Alex
  // retoma. Quem chama só marca isto como true se nenhum humano falou com o cliente há pouco.
  if (cliqueDeAnuncio) return { seguir: true, ativar: true, aplicarTag: !temTag };
  // "Já começou" não é só olhar o status gravado — que pode ter sido zerado por engano (já
  // aconteceu num teste) ou por /reiniciar — mas também se o Alex já respondeu nesta janela
  // de conversa. Assim, tirar a tag é respeitado mesmo se o status ficou inconsistente.
  const jaComecou = Boolean(statusAgente) || jaRespondeuAntes;

  if (!jaComecou) return { seguir: true, ativar: true, aplicarTag: !temTag };
  if (!temTag) return { seguir: false, registrarParada: statusAgente !== 'aguardando_humano' };
  if (statusAgente === 'aguardando_humano') return { seguir: true, ativar: true, aplicarTag: false };
  return { seguir: true, ativar: false, aplicarTag: false };
}

export { TAG_ATENDIMENTO_IA };
