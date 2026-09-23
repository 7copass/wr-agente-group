/**
 * O endpoint de etiquetas do Chatwoot SUBSTITUI a lista inteira a cada chamada — não adiciona.
 * Estas funções operam sobre a lista atual para nunca apagar uma etiqueta de outra origem
 * (time, outro sistema) só porque o Alex mexeu em uma etiqueta específica.
 */

/** Etiqueta que representa "esta conversa está sendo atendida pela IA". Time remove para parar o Alex. */
export const TAG_ATENDIMENTO_IA = 'atendimento_ia';

export function comEtiqueta(atuais: string[], nova: string): string[] {
  return atuais.includes(nova) ? atuais : [...atuais, nova];
}

export function semEtiqueta(atuais: string[], remover: string): string[] {
  return atuais.filter((e) => e !== remover);
}
