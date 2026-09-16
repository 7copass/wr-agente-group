/**
 * Chaves e tokens nunca têm espaço. Colar no painel da Vercel costuma trazer quebra de linha
 * ou espaço junto, e isso vira "not a legal HTTP header value" só na hora da chamada.
 */
export const limparSegredo = (bruto: string): string => bruto.replace(/\s+/g, '');

/** Descreve o problema sem revelar o valor. `null` quando o formato é válido. */
export function problemaNoSegredo(valor: string): string | null {
  if (!valor) return 'vazio';
  const i = [...valor].findIndex((c) => c < '!' || c > '~');
  if (i === -1) return null;
  const codigo = [...valor][i].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
  return `caractere inválido na posição ${i + 1} (U+${codigo})`;
}
