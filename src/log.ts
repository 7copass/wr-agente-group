const hora = () => new Date().toISOString().slice(11, 19);

export const log = {
  info: (msg: string, extra?: unknown) => console.log(`[${hora()}] ${msg}`, extra ?? ''),
  warn: (msg: string, extra?: unknown) => console.warn(`[${hora()}] ${msg}`, extra ?? ''),
  error: (msg: string, extra?: unknown) => console.error(`[${hora()}] ${msg}`, extra ?? ''),
};
