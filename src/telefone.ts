/**
 * Reduz um número brasileiro a DDD + 8 dígitos, ignorando o +55 e o nono dígito.
 * O WhatsApp entrega alguns números sem o 9 extra (comum no Norte), então
 * "+55 91 98161-7148" e "559181617148" precisam ser o mesmo contato.
 */
export function chaveTelefone(bruto: string): string {
  let d = bruto.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d;
}

/** Allowlist vazia libera todos. Contato sem telefone válido nunca passa numa allowlist preenchida. */
export function numeroPermitido(telefone: string | null | undefined, allowlist: string[]): boolean {
  if (!allowlist.length) return true;
  const chave = chaveTelefone(telefone ?? '');
  if (chave.length !== 10) return false;
  return allowlist.some((n) => chaveTelefone(n) === chave);
}
