import { waitUntil } from '@vercel/functions';
import { autorizado, tratarEvento } from '../src/webhook.js';
import { log } from '../src/log.js';

/** Responde 200 na hora para o Chatwoot e termina o trabalho em segundo plano. */
export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  if (!autorizado(token)) return Response.json({ ok: false }, { status: 401 });

  const evento = (await request.json().catch(() => null)) as Record<string, any> | null;
  if (evento) {
    waitUntil(tratarEvento(evento).catch((e) => log.error('falha ao tratar evento', e)));
  }
  return Response.json({ ok: true });
}
