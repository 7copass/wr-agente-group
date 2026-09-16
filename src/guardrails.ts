import type { Ofertas, Limites } from './config.js';

export interface Veredito { ok: boolean; motivo?: string }

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** "1.032,50" -> 1032.5 ; "80.000" -> 80000 ; "850" -> 850 */
export function parseValor(bruto: string): number {
  return Number(bruto.replace(/\./g, '').replace(',', '.'));
}

function valoresPermitidos(o: Ofertas, extras: number[]): Set<number> {
  const s = new Set<number>(extras);
  for (const p of o.planos) {
    s.add(p.credito);
    s.add(p.parcela);
  }
  if (o.piso_parcela) s.add(o.piso_parcela);
  return s;
}

/**
 * Última barreira antes de a mensagem sair. Não confia no modelo: confere cada número
 * contra a tabela de ofertas e cada frase contra a lista de proibições.
 *
 * `valoresDoCliente` são números que o próprio cliente citou na conversa — o agente pode
 * repeti-los ("você falou em R$ 850") sem que isso seja tratado como oferta.
 */
export function verificarSaida(
  texto: string,
  o: Ofertas,
  l: Limites,
  valoresDoCliente: number[] = [],
): Veredito {
  const plano = semAcento(texto);

  for (const f of l.frases_proibidas) {
    if (plano.includes(semAcento(f))) return { ok: false, motivo: `frase proibida: "${f}"` };
  }

  if (/«[^»]*»/.test(texto) || /\ba (?:preencher|confirmar)\b/i.test(texto)) {
    return { ok: false, motivo: 'a resposta usaria um campo de configuração ainda não preenchido' };
  }

  const permitidos = valoresPermitidos(o, valoresDoCliente);

  for (const m of texto.matchAll(/R\$\s*(\d[\d.]*(?:,\d{1,2})?)/gi)) {
    const v = parseValor(m[1]);
    if (!Number.isFinite(v)) return { ok: false, motivo: `valor ilegível: ${m[0]}` };
    if (!permitidos.has(v)) return { ok: false, motivo: `${m[0]} não está na tabela de ofertas` };
  }

  for (const m of texto.matchAll(/(\d{1,3})\s*mil\b/gi)) {
    const v = Number(m[1]) * 1000;
    if (!permitidos.has(v)) return { ok: false, motivo: `${m[0]} não está na tabela de ofertas` };
  }

  for (const m of texto.matchAll(/(\d{1,3})\s*%/g)) {
    if (!o.percentuais_permitidos.includes(Number(m[1]))) {
      return { ok: false, motivo: `percentual ${m[0]} não autorizado` };
    }
  }

  for (const m of texto.matchAll(/(\d{2,3})\s*x\b/gi)) {
    if (!o.planos.some((p) => p.prazo === Number(m[1]))) {
      return { ok: false, motivo: `prazo ${m[0]} não está na tabela de ofertas` };
    }
  }

  return { ok: true };
}

/** Números em R$ que o cliente citou, para o agente poder ecoá-los. */
export function valoresCitadosPelo(texto: string): number[] {
  const out: number[] = [];
  for (const m of texto.matchAll(/R?\$?\s*(\d[\d.]*(?:,\d{1,2})?)/gi)) {
    const v = parseValor(m[1]);
    if (Number.isFinite(v) && v >= 100) out.push(v);
  }
  for (const m of texto.matchAll(/(\d{1,3})\s*mil\b/gi)) out.push(Number(m[1]) * 1000);
  return out;
}
