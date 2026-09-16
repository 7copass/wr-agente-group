/** Textos fixos de repasse. Não passam pelo modelo: são a rede de segurança dele. */

export const AVISO_HANDOFF =
  'Perfeito! Já tenho as informações principais. Vou encaminhar seu atendimento para um de nossos consultores, só um momento 😊';

export const AVISO_HANDOFF_FORA =
  'Já deixei tudo anotado para o nosso consultor. Ele dá continuidade ao seu atendimento assim que estiver disponível 😊';

export const AVISO_BLOQUEIO =
  'Essa parte eu prefiro confirmar com um consultor para não te passar nada errado. Vou te encaminhar agora, só um momento 😊';

export const AVISO_BLOQUEIO_FORA =
  'Essa parte eu prefiro confirmar com um consultor para não te passar nada errado. Já deixei anotado e ele te responde assim que estiver disponível 😊';

/**
 * Texto que o cliente recebe quando a conversa vai para um humano.
 * Depois do repasse o Alex fica em silêncio, então a mensagem não pode terminar com uma
 * pergunta que ninguém vai responder, nem prometer "só um momento" de madrugada.
 */
export function textoDeRepasse(resposta: string, foraDoExpediente: boolean): string {
  const aviso = foraDoExpediente ? AVISO_HANDOFF_FORA : AVISO_HANDOFF;
  const limpa = resposta.trim();
  if (!limpa || limpa.includes('?')) return aviso;
  if (/consultor/i.test(limpa) && !foraDoExpediente) return limpa;
  return `${limpa} ${aviso}`;
}
