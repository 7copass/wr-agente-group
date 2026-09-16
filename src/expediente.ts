import { vendedores } from './config.js';

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const emMinutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Hora local de Santarém, não a do servidor — a inbox do Chatwoot está em UTC e isso desloca 3h. */
export function agoraLocal(quando = new Date()): { dia: number; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: vendedores.expediente.timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(quando);

  const pega = (t: string) => partes.find((p) => p.type === t)?.value ?? '0';
  const hora = Number(pega('hour')) % 24;
  return { dia: DIAS[pega('weekday')] ?? 0, minutos: hora * 60 + Number(pega('minute')) };
}

export function foraDoExpediente(quando = new Date()): boolean {
  const { dia, minutos } = agoraLocal(quando);
  if (!vendedores.expediente.dias_uteis.includes(dia)) return true;
  return minutos < emMinutos(vendedores.expediente.abre) || minutos >= emMinutos(vendedores.expediente.fecha);
}

export function dentroDaJanelaDeFollowup(quando = new Date()): boolean {
  const { minutos } = agoraLocal(quando);
  return minutos >= emMinutos(vendedores.followup.janela_inicio) && minutos < emMinutos(vendedores.followup.janela_fim);
}
