import type { CwMessage } from './chatwoot.js';

export interface Turno { autor: 'cliente' | 'alex' | 'vendedor'; texto: string }

/** Só para os números da allowlist: zera a qualificação e recomeça o teste do zero. */
export const COMANDO_REINICIAR = '/reiniciar';

export const ehEntrada = (t: unknown) => t === 'incoming' || t === 0;
export const ehSaida = (t: unknown) => t === 'outgoing' || t === 1;

export function turnoDe(m: CwMessage): Turno | null {
  const texto = (m.content ?? '').trim();
  if (!texto || m.private) return null;
  if (ehEntrada(m.message_type)) return { autor: 'cliente', texto };
  if (!ehSaida(m.message_type)) return null;
  return { autor: m.sender?.type === 'user' ? 'vendedor' : 'alex', texto };
}

export const ehReinicio = (texto: string) => texto.trim().toLowerCase() === COMANDO_REINICIAR;

/**
 * O que vem depois do último /reiniciar, sem a confirmação do Alex que o segue.
 * Assim o modelo trata a conversa como primeiro contato de novo.
 */
export function desdeUltimoReinicio(turnos: Turno[]): Turno[] {
  let inicio = 0;
  turnos.forEach((t, i) => {
    if (t.autor === 'cliente' && ehReinicio(t.texto)) inicio = i + 1;
  });
  while (inicio < turnos.length && turnos[inicio].autor === 'alex') inicio += 1;
  return turnos.slice(inicio);
}
